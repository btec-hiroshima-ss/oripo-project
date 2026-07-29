import { sql } from 'kysely'
import { db } from './db'
import { logger } from './logger'
import type {
  ScheduleEntry,
  ScheduleDetail,
  ScheduleInput,
  ScheduleUser,
  ScheduleGroup,
  MultiUserScheduleEntry,
} from './schedule.types'

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

export async function getScheduleDetail(scheduleId: number): Promise<ScheduleDetail> {
  // 登録者・更新者を turbine_user から取得
  const row = await db
    .selectFrom('eip_t_schedule as s')
    .innerJoin('turbine_user as cu', 'cu.user_id', 's.create_user_id')
    .innerJoin('turbine_user as uu', 'uu.user_id', 's.update_user_id')
    .where('s.schedule_id', '=', scheduleId)
    .select([
      sql<string>`cu.last_name || ' ' || cu.first_name`.as('creator_name'),
      sql<string>`s.create_date::text`.as('create_date_text'),
      sql<string>`uu.last_name || ' ' || uu.first_name`.as('updater_name'),
      sql<string>`s.update_date::text`.as('update_date_text'),
    ])
    .executeTakeFirstOrThrow()

  // 参加者名一覧（type='U' の全員）
  const participants = await db
    .selectFrom('eip_t_schedule_map as sm')
    .innerJoin('turbine_user as u', 'u.user_id', 'sm.user_id')
    .where('sm.schedule_id', '=', scheduleId)
    .where('sm.type', '=', 'U')
    .where('sm.status', 'not in', ['D', 'C'])
    .select([sql<string>`u.last_name || ' ' || u.first_name`.as('name')])
    .execute()

  // Server Action 経由で Date を返すと JSON シリアライズで文字列になりクライアント側で
  // getTime() が呼べなくなる。JST 文字列のまま返してコンポーネント側でパースする。
  return {
    creatorName: row.creator_name,
    creatorDateJst: row.create_date_text,
    updaterName: row.updater_name,
    updaterDateJst: row.update_date_text,
    participantNames: participants.map((p) => p.name),
  }
}

export async function addSchedule(userId: number, input: ScheduleInput): Promise<ScheduleEntry> {
  const scheduleId = await nextSeqId('pk_eip_t_schedule')

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

  // 参加者登録: 作成者（O=オーナー）+ 指定参加者（T=承認済み）
  await insertScheduleParticipants(scheduleId, userId, input.participantIds ?? [])

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

/**
 * 参加者を eip_t_schedule_map へ一括登録するヘルパー。
 * 作成者は status='O'（オーナー）、その他は status='T'（承認済み）。
 * common_category_id=1 は AIPO の全レコードが 1 を使用しており、0 は FK 違反になる。
 */
async function insertScheduleParticipants(
  scheduleId: number,
  ownerId: number,
  extraParticipantIds: number[]
): Promise<void> {
  // 作成者＋参加者の重複を除去してリスト化
  const allIds = Array.from(new Set([ownerId, ...extraParticipantIds]))

  for (const uid of allIds) {
    const mapId = await nextSeqId('pk_eip_t_schedule_map')
    await db.insertInto('eip_t_schedule_map').values({
      id: mapId,
      schedule_id: scheduleId,
      user_id: uid,
      type: 'U',
      status: uid === ownerId ? 'O' : 'T',
      common_category_id: 1,
    }).execute()
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

  // 参加者を全削除して再登録（AIPO 準拠のシンプルな全更新）
  await db.deleteFrom('eip_t_schedule_map').where('schedule_id', '=', scheduleId).execute()
  await insertScheduleParticipants(scheduleId, userId, input.participantIds ?? [])

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

// ===========================================================
// Phase B: マルチユーザービュー・ユーザーピッカー用関数
// ===========================================================

/**
 * 複数ユーザーの週スケジュールを一括取得する。
 * 他ユーザーの public_flag='C'（完全非公開）は除外し、'P'（非公開）は name="非公開" に置き換える。
 * N+1 回避のため IN 句でまとめて取得し、JS 側で viewUserId を付与する。
 */
export async function getWeekSchedulesMulti(
  loginUserId: number,
  userIds: number[],
  from: Date,
  to: Date
): Promise<MultiUserScheduleEntry[]> {
  if (userIds.length === 0) return []

  const fromStr = toJstStr(from)
  const toStr = toJstStr(to)

  const rows = await db
    .selectFrom('eip_t_schedule as s')
    .innerJoin('eip_t_schedule_map as sm', 'sm.schedule_id', 's.schedule_id')
    .innerJoin('turbine_user as u', 'u.user_id', 'sm.user_id')
    .where('sm.user_id', 'in', userIds)
    .where('sm.type', '=', 'U')
    .where('sm.status', 'not in', ['D', 'C'])
    // 他ユーザーの完全非公開予定は取得しない
    // 自分の予定は public_flag 問わず全て取得する
    .where((eb) =>
      eb.or([
        eb('sm.user_id', '=', loginUserId),
        eb('s.public_flag', '!=', 'C'),
      ])
    )
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
      'sm.user_id as view_user_id',
      sql<string>`u.last_name || ' ' || u.first_name`.as('view_user_name'),
    ])
    .execute()

  return rows.map((row) => {
    const isOtherUser = row.view_user_id !== loginUserId
    // 他ユーザーの非公開予定はタイトルをマスキングする（AIPO 準拠）
    const maskedName = isOtherUser && row.public_flag === 'P' ? '非公開' : (row.name ?? '')
    const maskedNote = isOtherUser && row.public_flag === 'P' ? null : (row.note ?? null)
    const maskedPlace = isOtherUser && row.public_flag === 'P' ? null : (row.place ?? null)

    return {
      scheduleId: row.schedule_id,
      name: maskedName,
      note: maskedNote,
      place: maskedPlace,
      startDate: parseJst(row.start_date_text),
      endDate: parseJst(row.end_date_text),
      publicFlag: (row.public_flag ?? 'O') as 'O' | 'P' | 'C',
      repeatPattern: row.repeat_pattern ?? 'N',
      isAllDay: row.repeat_pattern === 'S',
      parentId: row.parent_id ?? 0,
      isOwner: row.owner_id === loginUserId,
      ownerId: row.owner_id ?? 0,
      viewUserId: row.view_user_id,
      viewUserName: row.view_user_name,
    }
  })
}

/**
 * ログインユーザーの氏名を取得する。
 * ウィジェットの自分チップ表示に使用する（スケジュールが0件の週でも名前を表示するため）。
 */
export async function getLoginUserName(userId: number): Promise<string> {
  const row = await db
    .selectFrom('turbine_user')
    .select(sql<string>`last_name || ' ' || first_name`.as('full_name'))
    .where('user_id', '=', userId)
    .executeTakeFirst()
  return row?.full_name ?? ''
}

/**
 * ユーザーピッカー用のアクティブユーザー一覧を取得する。
 * disabled='T' のユーザー、システムアカウント（admin, anon）を除外する。
 */
export async function getScheduleUsers(): Promise<ScheduleUser[]> {
  const rows = await db
    .selectFrom('turbine_user')
    .select([
      'user_id',
      sql<string>`last_name || ' ' || first_name`.as('full_name'),
      sql<string>`COALESCE(last_name_kana, '') || ' ' || COALESCE(first_name_kana, '')`.as('full_name_kana'),
    ])
    // disabled='T' は AIPO の無効ユーザーフラグ
    .where('disabled', '!=', 'T')
    // システムアカウントを除外（user_id=1=admin, user_id=3=anon）
    .where('user_id', 'not in', [1, 3])
    .orderBy(sql`COALESCE(last_name_kana, '') || COALESCE(first_name_kana, '')`, 'asc')
    .execute()

  return rows.map((r) => ({ userId: r.user_id, fullName: r.full_name }))
}

/**
 * グループ一覧を取得する（システムグループ除外、alias_name ありのみ）。
 * turbine_group はユーザーが作成した個人グループも含むため alias_name で絞り込む。
 */
export async function getGroupList(): Promise<ScheduleGroup[]> {
  const rows = await db
    .selectFrom('turbine_group')
    .select(['group_id', 'group_alias_name'])
    // システムグループ（Jetspeed=1, LoginUser=2, Facility=3）を除外
    .where('group_id', 'not in', [1, 2, 3])
    // alias_name がないグループ（旧データ等）は除外
    .where('group_alias_name', 'is not', null)
    .orderBy('group_alias_name', 'asc')
    .execute()

  return rows.map((r) => ({
    groupId: r.group_id,
    groupName: r.group_alias_name ?? '',
  }))
}

/**
 * グループメンバーのアクティブユーザー一覧を取得する。
 * turbine_user_group_role 経由でグループ所属ユーザーを絞り込む。
 */
export async function getGroupMembers(groupId: number): Promise<ScheduleUser[]> {
  const rows = await db
    .selectFrom('turbine_user_group_role as ugr')
    .innerJoin('turbine_user as u', 'u.user_id', 'ugr.user_id')
    .select([
      'u.user_id',
      sql<string>`u.last_name || ' ' || u.first_name`.as('full_name'),
      sql<string>`COALESCE(u.last_name_kana, '') || ' ' || COALESCE(u.first_name_kana, '')`.as('full_name_kana'),
    ])
    .where('ugr.group_id', '=', groupId)
    .where('u.disabled', '!=', 'T')
    .where('u.user_id', 'not in', [1, 3])
    .orderBy(sql`COALESCE(u.last_name_kana, '') || COALESCE(u.first_name_kana, '')`, 'asc')
    .execute()

  return rows.map((r) => ({ userId: r.user_id, fullName: r.full_name }))
}

/**
 * 編集フォーム初期値用: スケジュールの現在の参加者一覧を取得する。
 * owner（status='O'）と参加者（status='T'）を区別せず全員返す。
 */
export async function getScheduleParticipantIds(scheduleId: number): Promise<number[]> {
  const rows = await db
    .selectFrom('eip_t_schedule_map')
    .select('user_id')
    .where('schedule_id', '=', scheduleId)
    .where('type', '=', 'U')
    .where('status', 'not in', ['D', 'C'])
    .execute()

  return rows.map((r) => r.user_id)
}
