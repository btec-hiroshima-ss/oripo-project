import { sql } from 'kysely'
import { db } from './db'
import { logger } from './logger'
import type { ScheduleEntry, ScheduleInput } from './schedule.types'

// DB は Asia/Tokyo のタイムゾーンで "timestamp without time zone" カラムに JST を格納している。
// Node.js の pg クライアントは timezone 情報なしの timestamp を UTC として扱うためズレが生じる。
// そのため start_date::text で文字列として取得し、以下の関数で JST として解釈する。

/** JST 日時文字列 "YYYY-MM-DD HH:MM:SS" → UTC Date */
export function parseJst(str: string): Date {
  return new Date(str.replace(' ', 'T') + '+09:00')
}

/** UTC Date → "YYYY-MM-DD HH:MM:SS"（JST）。DB への書き込みや比較に使用する。 */
export function toJstStr(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 19).replace('T', ' ')
}

// AIPO 独自シーケンスから次の PK を取得する。
// eip_t_schedule / eip_t_schedule_map は column DEFAULT がないため必ずこの関数で採番する。
async function nextSeqId(seqName: string): Promise<number> {
  // db.selectFrom(...).executeTakeFirstOrThrow() を通すことでテスト時のモックが効くようにする
  const row = await db
    .selectFrom(
      sql`(SELECT nextval(${seqName}) AS seq_id)`.as('sq')
    )
    .select(sql<number>`sq.seq_id`.as('seq_id'))
    .executeTakeFirstOrThrow()
  return Number(row.seq_id)
}

export async function getWeekSchedules(
  userId: number,
  from: Date,
  to: Date
): Promise<ScheduleEntry[]> {
  const fromStr = toJstStr(from)
  const toStr = toJstStr(to)

  const rows = await db
    .selectFrom('eip_t_schedule as s')
    .innerJoin('eip_t_schedule_map as sm', 'sm.schedule_id', 's.schedule_id')
    .where('sm.user_id', '=', userId)
    .where('sm.type', '=', 'U')
    // 削除・キャンセル済みの参加者レコードを除外する
    .where('sm.status', 'not in', ['D', 'C'])
    // 週範囲と重複する予定: start < 週末 かつ end >= 週始
    // all-day は start_date = end_date のため >= を使う（>だと週初日がヒットしない）
    .where(sql`s.start_date::text`, '<', toStr)
    .where(sql`s.end_date::text`, '>=', fromStr)
    .select([
      's.schedule_id',
      's.name',
      's.note',
      's.place',
      sql<string>`s.start_date::text`.as('start_date_text'),
      sql<string>`s.end_date::text`.as('end_date_text'),
      's.public_flag',
      's.repeat_pattern',
      's.parent_id',
      's.owner_id',
    ])
    .execute()

  return rows.map((row) => ({
    scheduleId: row.schedule_id,
    name: row.name ?? '',
    note: row.note ?? null,
    place: row.place ?? null,
    startDate: parseJst(row.start_date_text),
    endDate: parseJst(row.end_date_text),
    publicFlag: (row.public_flag ?? 'O') as 'O' | 'P' | 'C',
    repeatPattern: row.repeat_pattern ?? 'N',
    isAllDay: row.repeat_pattern === 'S',
    parentId: row.parent_id ?? 0,
    isOwner: row.owner_id === userId,
    ownerId: row.owner_id ?? 0,
  }))
}

export async function addSchedule(userId: number, input: ScheduleInput): Promise<ScheduleEntry> {
  // 2 テーブル分のシーケンスを逐次取得（並列だとテスト時のモック順序が不定になるため）
  const scheduleId = await nextSeqId('pk_eip_t_schedule')
  const mapId = await nextSeqId('pk_eip_t_schedule_map')

  const nowStr = toJstStr(new Date())
  const startStr = toJstStr(input.startDate)
  // all-day は AIPO 準拠で start_date = end_date
  const endStr = input.isAllDay ? startStr : toJstStr(input.endDate)

  await db.insertInto('eip_t_schedule').values({
    schedule_id: scheduleId,
    name: input.name,
    note: input.note ?? null,
    place: input.place ?? null,
    start_date: startStr,
    end_date: endStr,
    public_flag: input.publicFlag,
    // 終日: 'S' / 通常: 'N'（AIPO の repeat_pattern 仕様準拠）
    repeat_pattern: input.isAllDay ? 'S' : 'N',
    parent_id: 0,
    edit_flag: 'T',
    mail_flag: 'N',
    owner_id: userId,
    create_user_id: userId,
    update_user_id: userId,
    create_date: nowStr,
    update_date: nowStr,
  }).execute()

  await db.insertInto('eip_t_schedule_map').values({
    id: mapId,
    schedule_id: scheduleId,
    user_id: userId,
    type: 'U',
    // 作成者は O（オーナー）として登録する
    status: 'O',
    // common_category_id=1（未分類）: AIPO の全レコードが 1 を使用しており、0 は FK 違反になる
    common_category_id: 1,
  }).execute()

  logger.info({ event: 'schedule.create', userId, scheduleId }, 'スケジュール追加')

  const endDate = input.isAllDay ? input.startDate : input.endDate
  return {
    scheduleId,
    name: input.name,
    note: input.note ?? null,
    place: input.place ?? null,
    startDate: input.startDate,
    endDate,
    publicFlag: input.publicFlag,
    repeatPattern: input.isAllDay ? 'S' : 'N',
    isAllDay: input.isAllDay,
    parentId: 0,
    isOwner: true,
    ownerId: userId,
  }
}

export async function updateSchedule(
  scheduleId: number,
  userId: number,
  input: ScheduleInput
): Promise<ScheduleEntry> {
  const nowStr = toJstStr(new Date())
  const startStr = toJstStr(input.startDate)
  const endStr = input.isAllDay ? startStr : toJstStr(input.endDate)

  await db
    .updateTable('eip_t_schedule')
    .set({
      name: input.name,
      note: input.note ?? null,
      place: input.place ?? null,
      start_date: startStr,
      end_date: endStr,
      public_flag: input.publicFlag,
      repeat_pattern: input.isAllDay ? 'S' : 'N',
      update_user_id: userId,
      update_date: nowStr,
    })
    // owner_id 条件: 自分が作成者でない予定は更新できない（AIPO 準拠）
    .where('schedule_id', '=', scheduleId)
    .where('owner_id', '=', userId)
    .execute()

  logger.info({ event: 'schedule.update', userId, scheduleId }, 'スケジュール更新')

  const endDate = input.isAllDay ? input.startDate : input.endDate
  return {
    scheduleId,
    name: input.name,
    note: input.note ?? null,
    place: input.place ?? null,
    startDate: input.startDate,
    endDate,
    publicFlag: input.publicFlag,
    repeatPattern: input.isAllDay ? 'S' : 'N',
    isAllDay: input.isAllDay,
    parentId: 0,
    isOwner: true,
    ownerId: userId,
  }
}

export async function deleteSchedule(scheduleId: number, userId: number): Promise<void> {
  // schedule_map を先に削除してから schedule 本体を削除（参照整合性）
  await db.deleteFrom('eip_t_schedule_map').where('schedule_id', '=', scheduleId).execute()
  // owner_id 条件: 自分が作成者でない予定は削除できない（AIPO 準拠）
  await db
    .deleteFrom('eip_t_schedule')
    .where('schedule_id', '=', scheduleId)
    .where('owner_id', '=', userId)
    .execute()

  logger.info({ event: 'schedule.delete', userId, scheduleId }, 'スケジュール削除')
}
