import { addDays, format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { sql } from 'kysely'
import { db } from './db'
import { logger } from './logger'
import type {
  ScheduleEntry,
  ScheduleDetail,
  ScheduleInput,
  RepeatScheduleInput,
  ScheduleUser,
  ScheduleGroup,
  MultiUserScheduleEntry,
  FacilityWithGroup,
} from './schedule.types'
import {
  calcOccurrenceDates,
  encodeRepeatPattern,
  getJstTimeOffsetMs,
  msToIntervalStr,
} from './repeat'

// DB は Asia/Tokyo のタイムゾーンで "timestamp without time zone" カラムに JST を格納している。
// Node.js の pg クライアントは timezone 情報なしの timestamp を UTC として扱うためズレが生じる。
// そのため start_date::text で文字列として取得し、以下の関数で JST として解釈する。

/** JST 日時文字列 "YYYY-MM-DD HH:MM:SS" → UTC Date */
export function parseJst(str: string): Date {
  return new Date(str.replace(' ', 'T') + '+09:00')
}

/** UTC Date → "YYYY-MM-DD HH:MM:SS"（JST）。DB への書き込みや比較に使用する。 */
export function toJstStr(date: Date): string {
  return format(toZonedTime(date, 'Asia/Tokyo'), 'yyyy-MM-dd HH:mm:ss')
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

/**
 * AIPO 独自シーケンスから N 件の PK を一括取得する。
 * 繰り返し予定の子レコード一括 INSERT 前に使用する。
 * generate_series で1クエリにまとめることで N+1 を回避する。
 */
async function nextNSeqIds(seqName: string, count: number): Promise<number[]> {
  if (count === 0) return []
  const rows = await db
    .selectFrom(sql`generate_series(1, ${count})`.as('gs'))
    .select(sql<number>`nextval(${sql.lit(seqName)})`.as('seq_id'))
    .execute()
  return rows.map((r) => Number(r.seq_id))
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

  // 予約設備名一覧（type='F' の全件）
  const facilities = await db
    .selectFrom('eip_t_schedule_map as sm')
    .innerJoin('eip_m_facility as f', 'f.facility_id', 'sm.user_id')
    .where('sm.schedule_id', '=', scheduleId)
    .where('sm.type', '=', 'F')
    .select(['f.facility_name'])
    .execute()

  // Server Action 経由で Date を返すと JSON シリアライズで文字列になりクライアント側で
  // getTime() が呼べなくなる。JST 文字列のまま返してコンポーネント側でパースする。
  return {
    creatorName: row.creator_name,
    creatorDateJst: row.create_date_text,
    updaterName: row.updater_name,
    updaterDateJst: row.update_date_text,
    participantNames: participants.map((p) => p.name),
    facilityNames: facilities.map((f) => f.facility_name ?? ''),
  }
}

export async function addSchedule(userId: number, input: ScheduleInput): Promise<ScheduleEntry> {
  const scheduleId = await nextSeqId('pk_eip_t_schedule')

  const nowStr = toJstStr(new Date())
  const startStr = toJstStr(input.startDate)
  // all-day: 通常は start_date = end_date（AIPO 準拠）
  // 期間で指定: periodEndDate が指定された場合は (periodEndDate + 1日) 00:00 JST を exclusive end として格納する
  let endStr: string
  if (input.isAllDay) {
    if (input.periodEndDate) {
      // periodEndDate は "YYYY-MM-DDT00:00:00+09:00" で渡される JST 深夜0時。
      // +24h で翌日 JST 深夜0時（exclusive end）になる。
      // new Date(year, month, day+1) はサーバー local timezone に依存するため使わない。
      endStr = toJstStr(addDays(input.periodEndDate, 1))
    } else {
      endStr = startStr
    }
  } else {
    endStr = toJstStr(input.endDate)
  }

  await db.insertInto('eip_t_schedule').values({
    schedule_id: scheduleId,
    name: input.name,
    note: input.note ?? null,
    place: input.place ?? null,
    start_date: startStr,
    end_date: endStr,
    public_flag: input.publicFlag,
    // repeat_pattern: 'S' = 終日/期間で指定、'N' = 繰り返しなし（AIPO 仕様）
    repeat_pattern: input.isAllDay ? 'S' : 'N',
    parent_id: 0,
    edit_flag: 'T',   // 'T' = 編集可（AIPO の boolean 表現: 'T'rue）
    mail_flag: 'N',   // 'N' = メール通知なし（AIPO の boolean 表現: 'N'o）
    owner_id: userId,
    create_user_id: userId,
    update_user_id: userId,
    create_date: nowStr,
    update_date: nowStr,
  }).execute()

  // 参加者登録: 作成者（O=オーナー）+ 指定参加者（T=承認済み）
  await insertScheduleParticipants(scheduleId, userId, input.participantIds ?? [])
  // 設備予約登録
  await insertScheduleFacilities(scheduleId, input.facilityIds ?? [])

  logger.info({ event: 'schedule.create', userId, scheduleId }, 'スケジュール追加')

  // 戻り値の endDate: 期間で指定の場合は exclusive end を返す（表示側で範囲判定に使用）
  let returnEndDate: Date
  if (input.isAllDay) {
    returnEndDate = input.periodEndDate
      ? addDays(input.periodEndDate, 1)
      : input.startDate
  } else {
    returnEndDate = input.endDate
  }
  return {
    scheduleId,
    name: input.name,
    note: input.note ?? null,
    place: input.place ?? null,
    startDate: input.startDate,
    endDate: returnEndDate,
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
 * Phase C で addRepeatSchedule からも呼び出すため export する。
 */
export async function insertScheduleParticipants(
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
      // status: 'O' = オーナー（作成者）、'T' = 承認済み参加者（AIPO 仕様）
      status: uid === ownerId ? 'O' : 'T',
      common_category_id: 1,
    }).execute()
  }
}

/**
 * 設備を eip_t_schedule_map に登録するヘルパー。
 * type='F', user_id=facility_id。status='O' は AIPO の実データに基づく固定値。
 */
async function insertScheduleFacilities(scheduleId: number, facilityIds: number[]): Promise<void> {
  if (facilityIds.length === 0) return
  const mapIds = await nextNSeqIds('pk_eip_t_schedule_map', facilityIds.length)
  await db.insertInto('eip_t_schedule_map').values(
    facilityIds.map((fid, i) => ({
      id: mapIds[i],
      schedule_id: scheduleId,
      user_id: fid,
      // type='F': AIPO で設備を区別するフラグ（'U'=ユーザー参加者）
      type: 'F' as const,
      // status='O': AIPO の実DBレコードに基づく固定値（設備予約は常に O）
      status: 'O',
      common_category_id: 1,
    }))
  ).execute()
}

export async function updateSchedule(
  scheduleId: number,
  userId: number,
  input: ScheduleInput
): Promise<ScheduleEntry> {
  const nowStr = toJstStr(new Date())
  const startStr = toJstStr(input.startDate)
  let endStr: string
  if (input.isAllDay) {
    if (input.periodEndDate) {
      endStr = toJstStr(addDays(input.periodEndDate, 1))
    } else {
      endStr = startStr
    }
  } else {
    endStr = toJstStr(input.endDate)
  }

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

  // 参加者・設備を全削除して再登録（AIPO 準拠のシンプルな全更新）
  await db.deleteFrom('eip_t_schedule_map').where('schedule_id', '=', scheduleId).execute()
  await insertScheduleParticipants(scheduleId, userId, input.participantIds ?? [])
  await insertScheduleFacilities(scheduleId, input.facilityIds ?? [])

  logger.info({ event: 'schedule.update', userId, scheduleId }, 'スケジュール更新')

  let returnEndDate: Date
  if (input.isAllDay) {
    returnEndDate = input.periodEndDate
      ? addDays(input.periodEndDate, 1)
      : input.startDate
  } else {
    returnEndDate = input.endDate
  }
  return {
    scheduleId,
    name: input.name,
    note: input.note ?? null,
    place: input.place ?? null,
    startDate: input.startDate,
    endDate: returnEndDate,
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
 * ログインユーザーが作成したマイグループを取得する。
 * AIPO の ALEipUtils.getMyGroups() 相当（owner_id = userId で絞り込む）。
 * 週・日グループビューのフィルターに使用する。
 */
export async function getMyGroups(userId: number): Promise<ScheduleGroup[]> {
  const rows = await db
    .selectFrom('turbine_group')
    .select(['group_id', 'group_alias_name'])
    // AIPO 準拠: owner_id = userId（自分が作成したグループのみ）
    .where('owner_id', '=', userId)
    .where('group_id', 'not in', [1, 2, 3])
    .where('group_alias_name', 'is not', null)
    .orderBy('group_alias_name', 'asc')
    .execute()

  return rows.map((r) => ({
    groupId: r.group_id,
    groupName: r.group_alias_name ?? '',
  }))
}

/**
 * ユーザー選択モーダル用グループ一覧を取得する。
 * AIPO の schedule-form-select-group.vm 準拠:
 * - 部署（owner_id=1: admin 管理のシステムグループ）
 * - マイグループ（owner_id=userId: ログインユーザーが作成したグループ）
 * 他ユーザーが作成したグループは表示しない。
 */
export async function getGroupList(userId: number): Promise<ScheduleGroup[]> {
  const rows = await db
    .selectFrom('turbine_group')
    .select(['group_id', 'group_alias_name', 'owner_id'])
    .where('group_id', 'not in', [1, 2, 3])
    .where('group_alias_name', 'is not', null)
    // 部署（owner_id=1）またはマイグループ（owner_id=userId）のみ
    .where((eb) => eb.or([
      eb('owner_id', '=', 1),
      eb('owner_id', '=', userId),
    ]))
    // 部署を先に表示し、その中でアルファベット順
    .orderBy('owner_id', 'asc')
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

// ===========================================================
// Phase C: 繰り返し予定
// ===========================================================

/**
 * 繰り返し予定を作成する。
 *
 * Oripo の事前展開方式:
 *   AIPO は動的生成（子レコードは編集・削除時のみ作成）だが、
 *   Oripo は実装を単純にするため全出現分の子レコードを一括作成する。
 *
 * 親レコード（parent_id=0）は eip_t_schedule_map に登録しない。
 * 週ビューには子レコード（repeat_pattern='N'）のみが表示される。
 */
export async function addRepeatSchedule(userId: number, input: RepeatScheduleInput): Promise<void> {
  const occurrences = calcOccurrenceDates({
    repeatType: input.repeatType,
    // AIPO 準拠: limitStartDate が指定された場合、その日から出現日を生成する（limit_start_date 相当）
    firstStart: input.limitStartDate ?? input.startDate,
    weekDays: input.weekDays,
    limitEndDate: input.limitEndDate ?? null,
  })

  if (occurrences.length === 0) throw new Error('繰り返し出現日が0件です')

  const startOffsetMs = getJstTimeOffsetMs(input.startDate)
  const endOffsetMs = getJstTimeOffsetMs(input.endDate)
  const startIntervalStr = msToIntervalStr(startOffsetMs)
  const endIntervalStr = msToIntervalStr(endOffsetMs)

  // 最初の出現日の JST 日付から毎月の日付を算出（毎月繰り返しパターン用）
  const firstJstDay = toZonedTime(occurrences[0], 'Asia/Tokyo').getDate()
  const hasLimit = input.limitEndDate != null
  const repeatPattern = encodeRepeatPattern(
    input.repeatType,
    hasLimit,
    input.weekDays,
    input.repeatType === 'monthly' ? firstJstDay : undefined,
  )

  const nowStr = toJstStr(new Date())
  const firstMidnight = occurrences[0]
  const lastMidnight = occurrences[occurrences.length - 1]

  // 親レコードの start/end: limit=ありは最終出現の終了時刻、なしは最初の出現の終了時刻（AIPO 準拠）
  const parentStartStr = toJstStr(new Date(firstMidnight.getTime() + startOffsetMs))
  const parentEndBase = hasLimit ? lastMidnight : firstMidnight
  const parentEndStr = toJstStr(new Date(parentEndBase.getTime() + endOffsetMs))

  // 親レコード作成
  const parentId = await nextSeqId('pk_eip_t_schedule')
  await db.insertInto('eip_t_schedule').values({
    schedule_id: parentId,
    name: input.name,
    note: input.note ?? null,
    place: input.place ?? null,
    start_date: parentStartStr,
    end_date: parentEndStr,
    public_flag: input.publicFlag,
    repeat_pattern: repeatPattern,
    parent_id: 0,
    edit_flag: 'T',   // 'T' = 編集可（AIPO の boolean 表現: 'T'rue）
    mail_flag: 'N',   // 'N' = メール通知なし（AIPO の boolean 表現: 'N'o）
    owner_id: userId,
    create_user_id: userId,
    update_user_id: userId,
    create_date: nowStr,
    update_date: nowStr,
  }).execute()

  // 子レコード一括 INSERT（generate_series で N 件の PK を一括取得）
  const childCount = occurrences.length
  const childIds = await nextNSeqIds('pk_eip_t_schedule', childCount)

  await db.insertInto('eip_t_schedule').values(
    occurrences.map((dayMidnight, i) => ({
      schedule_id: childIds[i],
      name: input.name,
      note: input.note ?? null,
      place: input.place ?? null,
      start_date: toJstStr(new Date(dayMidnight.getTime() + startOffsetMs)),
      end_date: toJstStr(new Date(dayMidnight.getTime() + endOffsetMs)),
      public_flag: input.publicFlag,
      repeat_pattern: 'N',
      parent_id: parentId,
      edit_flag: 'T',
      mail_flag: 'N',
      owner_id: userId,
      create_user_id: userId,
      update_user_id: userId,
      create_date: nowStr,
      update_date: nowStr,
    }))
  ).execute()

  // 参加者を全子レコードに一括登録
  const allParticipantIds = Array.from(new Set([userId, ...(input.participantIds ?? [])]))
  const totalMapCount = childCount * allParticipantIds.length
  const mapIds = await nextNSeqIds('pk_eip_t_schedule_map', totalMapCount)

  let mapIdx = 0
  await db.insertInto('eip_t_schedule_map').values(
    childIds.flatMap((childId) =>
      allParticipantIds.map((uid) => ({
        id: mapIds[mapIdx++],
        schedule_id: childId,
        user_id: uid,
        type: 'U' as const,
        status: uid === userId ? 'O' : 'T',
        common_category_id: 1,
      }))
    )
  ).execute()

  // 設備予約を全子レコードに一括登録
  const facilityIds = input.facilityIds ?? []
  if (facilityIds.length > 0) {
    const facilityMapCount = childCount * facilityIds.length
    const facilityMapIds = await nextNSeqIds('pk_eip_t_schedule_map', facilityMapCount)
    let fMapIdx = 0
    await db.insertInto('eip_t_schedule_map').values(
      childIds.flatMap((childId) =>
        facilityIds.map((fid) => ({
          id: facilityMapIds[fMapIdx++],
          schedule_id: childId,
          user_id: fid,
          type: 'F' as const,
          status: 'O',
          common_category_id: 1,
        }))
      )
    ).execute()
  }

  logger.info({ event: 'schedule.repeat.create', userId, parentId, count: childCount }, '繰り返しスケジュール追加')
}

/**
 * 繰り返し予定のうち、1件だけを更新する（「この予定のみ変更」）。
 * 子レコードを通常の updateSchedule と同様に更新する。
 * 繰り返し種別・パターンは変更しない（child の repeat_pattern='N' を維持）。
 */
export async function updateRepeatOne(
  scheduleId: number,
  userId: number,
  input: ScheduleInput,
): Promise<void> {
  const nowStr = toJstStr(new Date())
  const startStr = toJstStr(input.startDate)
  const endStr = input.isAllDay ? startStr : toJstStr(input.endDate)

  await db.updateTable('eip_t_schedule')
    .set({
      name: input.name,
      note: input.note ?? null,
      place: input.place ?? null,
      start_date: startStr,
      end_date: endStr,
      public_flag: input.publicFlag,
      // 子レコードの repeat_pattern は 'N' のまま維持する（親パターンとは独立）
      update_user_id: userId,
      update_date: nowStr,
    })
    .where('schedule_id', '=', scheduleId)
    .where('owner_id', '=', userId)
    .execute()

  await db.deleteFrom('eip_t_schedule_map').where('schedule_id', '=', scheduleId).execute()
  await insertScheduleParticipants(scheduleId, userId, input.participantIds ?? [])
  await insertScheduleFacilities(scheduleId, input.facilityIds ?? [])

  logger.info({ event: 'schedule.repeat.updateOne', userId, scheduleId }, '繰り返しスケジュール単件更新')
}

/**
 * 繰り返し予定の全件を一括更新する（「全ての予定を変更」）。
 *
 * 繰り返し種別・終了条件は変更不可。変更可能: タイトル・場所・内容・公開区分・開始/終了時刻。
 * 時刻変更は date_trunc('day', start_date) + interval で各日の日付を維持したまま時刻のみ置き換える。
 * DB の timestamp は JST 格納のため、DB 側の date_trunc は正しく JST 深夜0時を返す。
 */
export async function updateRepeatAll(
  parentId: number,
  userId: number,
  input: ScheduleInput,
): Promise<void> {
  const nowStr = toJstStr(new Date())
  const startIntervalStr = msToIntervalStr(getJstTimeOffsetMs(input.startDate))
  const endIntervalStr = msToIntervalStr(getJstTimeOffsetMs(input.endDate))

  // 全子レコードを一括更新（各日の date_trunc('day', ...) に新しい時間 interval を加算）
  await db.updateTable('eip_t_schedule')
    .set({
      name: input.name,
      note: input.note ?? null,
      place: input.place ?? null,
      public_flag: input.publicFlag,
      start_date: sql`date_trunc('day', start_date) + ${startIntervalStr}::interval`,
      end_date: sql`date_trunc('day', end_date) + ${endIntervalStr}::interval`,
      update_user_id: userId,
      update_date: nowStr,
    })
    .where('parent_id', '=', parentId)
    .where('owner_id', '=', userId)
    .execute()

  // 親レコードも名前・場所・内容・公開区分を更新（start/end はそのまま）
  await db.updateTable('eip_t_schedule')
    .set({
      name: input.name,
      note: input.note ?? null,
      place: input.place ?? null,
      public_flag: input.publicFlag,
      update_user_id: userId,
      update_date: nowStr,
    })
    .where('schedule_id', '=', parentId)
    .where('owner_id', '=', userId)
    .execute()

  // 参加者・設備の更新: タイプ別に個別削除→再挿入する
  // participantIds と facilityIds を一括削除すると、片方だけ更新する際に
  // もう片方が消えるデータ消失が起きるため、type='U' / type='F' を分けて操作する
  if (input.participantIds !== undefined || input.facilityIds !== undefined) {
    const children = await db.selectFrom('eip_t_schedule')
      .select('schedule_id')
      .where('parent_id', '=', parentId)
      .execute()

    const childIds = children.map((c) => c.schedule_id)
    if (childIds.length > 0) {
      if (input.participantIds !== undefined) {
        await db.deleteFrom('eip_t_schedule_map')
          .where('schedule_id', 'in', childIds)
          .where('type', '=', 'U')
          .execute()

        const allParticipantIds = Array.from(new Set([userId, ...input.participantIds]))
        const mapIds = await nextNSeqIds('pk_eip_t_schedule_map', childIds.length * allParticipantIds.length)
        let mapIdx = 0
        await db.insertInto('eip_t_schedule_map').values(
          childIds.flatMap((childId) =>
            allParticipantIds.map((uid) => ({
              id: mapIds[mapIdx++],
              schedule_id: childId,
              user_id: uid,
              type: 'U' as const,
              status: uid === userId ? 'O' : 'T',
              common_category_id: 1,
            }))
          )
        ).execute()
      }

      if (input.facilityIds !== undefined) {
        await db.deleteFrom('eip_t_schedule_map')
          .where('schedule_id', 'in', childIds)
          .where('type', '=', 'F')
          .execute()

        if (input.facilityIds.length > 0) {
          const facilityMapIds = await nextNSeqIds('pk_eip_t_schedule_map', childIds.length * input.facilityIds.length)
          let fIdx = 0
          await db.insertInto('eip_t_schedule_map').values(
            childIds.flatMap((childId) =>
              (input.facilityIds ?? []).map((fid) => ({
                id: facilityMapIds[fIdx++],
                schedule_id: childId,
                user_id: fid,
                type: 'F' as const,
                status: 'O',
                common_category_id: 1,
              }))
            )
          ).execute()
        }
      }
    }
  }

  logger.info({ event: 'schedule.repeat.updateAll', userId, parentId }, '繰り返しスケジュール全更新')
}

/**
 * 繰り返し予定のうち1件のみを削除する（「この予定のみ削除」）。
 * 親レコードと他の子レコードはそのまま残る。
 */
export async function deleteRepeatOne(scheduleId: number, userId: number): Promise<void> {
  await db.deleteFrom('eip_t_schedule_map').where('schedule_id', '=', scheduleId).execute()
  await db.deleteFrom('eip_t_schedule')
    .where('schedule_id', '=', scheduleId)
    .where('owner_id', '=', userId)
    .execute()

  logger.info({ event: 'schedule.repeat.deleteOne', userId, scheduleId }, '繰り返しスケジュール単件削除')
}

// ===========================================================
// Phase D: 日/月/一覧ビュー・設備予約
// ===========================================================

/**
 * 一覧ビュー用: 指定日以降の予定を開始日時昇順で取得する。
 * getWeekSchedulesMulti は日付範囲フィルタ用途のため、一覧ビューは ORDER BY + LIMIT で別途実装する。
 */
export async function getListSchedules(
  loginUserId: number,
  userIds: number[],
  from: Date,
  limit: number,
  offset: number,
  /** キーワード部分一致フィルター（AIPO: `target_keyword`）。空文字・未指定は全件対象 */
  keyword?: string,
): Promise<MultiUserScheduleEntry[]> {
  if (userIds.length === 0) return []

  const fromStr = toJstStr(from)
  // AIPO と同じ %keyword% 部分一致（ScheduleUtils.getScheduleList 準拠）
  const kw = keyword?.trim() ?? ''

  let query = db
    .selectFrom('eip_t_schedule as s')
    .innerJoin('eip_t_schedule_map as sm', 'sm.schedule_id', 's.schedule_id')
    .innerJoin('turbine_user as u', 'u.user_id', 'sm.user_id')
    .where('sm.user_id', 'in', userIds)
    .where('sm.type', '=', 'U')
    .where('sm.status', 'not in', ['D', 'C'])
    .where((eb) =>
      eb.or([
        eb('sm.user_id', '=', loginUserId),
        eb('s.public_flag', '!=', 'C'),
      ])
    )
    // 一覧ビュー: 指定日以降が開始する予定（end_date ではなく start_date 基準）
    .where(sql`s.start_date::text`, '>=', fromStr)

  if (kw !== '') {
    const pattern = `%${kw}%`
    query = query.where((eb) =>
      eb.or([
        eb(sql`s.name`, 'ilike', pattern),
        eb(sql`s.place`, 'ilike', pattern),
        eb(sql`s.note`, 'ilike', pattern),
      ])
    )
  }

  const rows = await query
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
    .orderBy(sql`s.start_date::text`, 'asc')
    .limit(limit)
    .offset(offset)
    .execute()

  return rows.map((row) => {
    const isOtherUser = row.view_user_id !== loginUserId
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
 * 設備一覧をグループ情報付きで取得する（設備ピッカー用）。
 * sort 昇順で返す。グループ未所属の設備は groupName=null。
 */
export async function getFacilities(): Promise<FacilityWithGroup[]> {
  const rows = await db
    .selectFrom('eip_m_facility as f')
    .leftJoin('eip_m_facility_group_map as gm', 'gm.facility_id', 'f.facility_id')
    .leftJoin('eip_m_facility_group as g', 'g.group_id', 'gm.group_id')
    .select([
      'f.facility_id',
      'f.facility_name',
      'g.group_name',
      'f.sort',
    ])
    .orderBy('f.sort', 'asc')
    .execute()

  return rows.map((r) => ({
    facilityId: r.facility_id,
    facilityName: r.facility_name ?? '',
    groupName: r.group_name ?? null,
    sort: r.sort ?? 0,
  }))
}

/**
 * 指定日時に予約済みの設備 ID セットを返す（空き確認用）。
 * 開始時刻 < endDate かつ 終了時刻 > startDate で重複判定（半開区間）。
 */
export async function getBookedFacilityIds(
  startDate: Date,
  endDate: Date,
  // 編集中のスケジュール自身を除外することで「自分の設備が使用中」と誤判定されないようにする
  excludeScheduleId?: number,
): Promise<number[]> {
  const startStr = toJstStr(startDate)
  const endStr = toJstStr(endDate)

  let query = db
    .selectFrom('eip_t_schedule_map as sm')
    .innerJoin('eip_t_schedule as s', 's.schedule_id', 'sm.schedule_id')
    .where('sm.type', '=', 'F')
    // 繰り返し予定の親レコードは end_date がシリーズ全体の終端（数年先）になるため除外する。
    // AIPO は parent_id=0 を「親なし」として使用するため、
    // root 親（repeat_pattern != 'N' かつ parent_id = 0）のみを除外する。
    .where(sql`(s.repeat_pattern = 'N' OR s.parent_id != 0)`)
    // 時刻が重複する予定を検索（exclusive end の半開区間）
    .where(sql`s.start_date::text`, '<', endStr)
    .where(sql`s.end_date::text`, '>', startStr)
    .select(['sm.user_id as facility_id'])

  if (excludeScheduleId !== undefined) {
    query = query.where('s.schedule_id', '!=', excludeScheduleId)
  }

  const rows = await query.execute()
  return rows.map((r) => r.facility_id)
}

/**
 * 編集フォーム初期値用: スケジュールの現在の予約設備 ID リストを取得する。
 */
export async function getScheduleFacilityIds(scheduleId: number): Promise<number[]> {
  const rows = await db
    .selectFrom('eip_t_schedule_map')
    .select('user_id')
    .where('schedule_id', '=', scheduleId)
    .where('type', '=', 'F')
    .execute()

  return rows.map((r) => r.user_id)
}

/**
 * 繰り返し予定の全件（親 + 全子）を削除する（「全ての予定を削除」）。
 */
export async function deleteRepeatAll(parentId: number, userId: number): Promise<void> {
  const children = await db.selectFrom('eip_t_schedule')
    .select('schedule_id')
    .where('parent_id', '=', parentId)
    .execute()

  const childIds = children.map((c) => c.schedule_id)

  if (childIds.length > 0) {
    await db.deleteFrom('eip_t_schedule_map').where('schedule_id', 'in', childIds).execute()
    await db.deleteFrom('eip_t_schedule').where('parent_id', '=', parentId).execute()
  }

  // 親レコード削除（schedule_map なし）
  await db.deleteFrom('eip_t_schedule')
    .where('schedule_id', '=', parentId)
    .where('owner_id', '=', userId)
    .execute()

  logger.info({ event: 'schedule.repeat.deleteAll', userId, parentId }, '繰り返しスケジュール全削除')
}
