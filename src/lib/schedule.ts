import { addDays, format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { sql, type SqlBool } from 'kysely'
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
  encodeRepeatPattern,
  getJstTimeOffsetMs,
  msToIntervalStr,
  findFirstPatternDate,
  listPatternDates,
  hasRepeatLimit,
  expandRepeatEntries,
  dummyKey,
  findBookedFacilityIds,
  type FacilityBooking,
} from './repeat'
import { makeDateJst, toJstDateStr, toJstTimeStr } from './jst'

// 表示から除外する map の status。#212（AIPO との status の扱いの違い）で見直すまでは従来通り
const HIDDEN_MAP_STATUSES = ['D', 'C']
// ダミー（繰り返しの出現を打ち消す子レコード）の map に付く status（AIPO insertDummySchedule 準拠）
const DUMMY_MAP_STATUS = 'D'
// 繰り返しの親ではない repeat_pattern（'N' = 繰り返しなし、'S' = 終日・期間指定）
const NON_REPEAT_PATTERNS = ['N', 'S']
// 一覧ビュー（一覧モード）の表示日数（AIPO ScheduleListContainer.SCHEDULE_LIST_DATE_LIMIT 準拠）
export const LIST_VIEW_DAYS = 7

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

// 表示用クエリの共通部分: 指定ユーザーが参加者（type='U'）の予定。他ユーザーの完全非公開は除外する
function selectVisibleSchedules(loginUserId: number, userIds: number[]) {
  return db
    .selectFrom('eip_t_schedule as s')
    .innerJoin('eip_t_schedule_map as sm', 'sm.schedule_id', 's.schedule_id')
    .innerJoin('turbine_user as u', 'u.user_id', 'sm.user_id')
    .where('sm.user_id', 'in', userIds)
    .where('sm.type', '=', 'U')
    .where('sm.status', 'not in', HIDDEN_MAP_STATUSES)
    // 他ユーザーの完全非公開予定は取得しない。自分の予定は public_flag 問わず全て取得する
    .where((eb) =>
      eb.or([
        eb('sm.user_id', '=', loginUserId),
        eb('s.public_flag', '!=', 'C'),
      ])
    )
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
}

type VisibleScheduleRow = {
  schedule_id: number
  name: string | null
  note: string | null
  place: string | null
  start_date_text: string
  end_date_text: string
  public_flag: string | null
  repeat_pattern: string | null
  parent_id: number | null
  owner_id: number | null
  view_user_id: number
  view_user_name: string
}

// DB 行 → MultiUserScheduleEntry。他ユーザーの非公開予定はタイトル・メモ・場所をマスキングする（AIPO 準拠）
function toMultiUserEntry(row: VisibleScheduleRow, loginUserId: number): MultiUserScheduleEntry {
  const isOtherUser = row.view_user_id !== loginUserId
  const isMasked = isOtherUser && row.public_flag === 'P'
  return {
    scheduleId: row.schedule_id,
    name: isMasked ? '非公開' : (row.name ?? ''),
    note: isMasked ? null : (row.note ?? null),
    place: isMasked ? null : (row.place ?? null),
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
    occurrenceDate: null,
    repeatStartDate: null,
    repeatEndDate: null,
  }
}

/**
 * 指定した繰り返しの親のダミー（出現の打ち消し）を「親 ID + 日付」のキー集合で返す。
 * 表示用クエリは status='D' を除外しているためダミーは取得できず、別クエリで取る。
 * 照合に表示ユーザーは使わない（後から参加者に追加したユーザーにも打ち消しを効かせるため。仕様書 Phase F 参照）
 */
async function fetchDummyKeys(parentIds: number[], fromDateStr: string, toDateStr: string): Promise<Set<string>> {
  if (parentIds.length === 0) return new Set()
  const rows = await db
    .selectFrom('eip_t_schedule as s')
    .innerJoin('eip_t_schedule_map as sm', 'sm.schedule_id', 's.schedule_id')
    .where('s.parent_id', 'in', parentIds)
    .where('sm.status', '=', DUMMY_MAP_STATUS)
    // ダミーの start_date は出現日の 00:00。日付の文字列比較で範囲を絞る
    .where(sql`s.start_date::date::text`, '>=', fromDateStr)
    .where(sql`s.start_date::date::text`, '<=', toDateStr)
    .select(['s.parent_id', sql<string>`s.start_date::date::text`.as('date_text')])
    .execute()
  return new Set(rows.map((r) => dummyKey(r.parent_id ?? 0, r.date_text)))
}

/**
 * 表示期間 [from, to) の予定を取得し、繰り返しを出現に展開して返す（週・日・月・ブロック・一覧の各ビュー共通）。
 *
 * AIPO と同じ動的展開方式（Phase F / #211）:
 *   繰り返し予定は親レコードだけを持ち、子レコードは個別変更・個別削除（ダミー）にしか存在しない。
 *   そのため通常予定と繰り返しの親を別々に取得し、親から表示期間内の出現を計算する。
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

  // 通常予定（個別変更レコードを含む）: 範囲と重複するもの。start < 範囲末 かつ end >= 範囲始
  // all-day は start_date = end_date のため >= を使う（>だと初日がヒットしない）
  const normalRows = await selectVisibleSchedules(loginUserId, userIds)
    .where('s.repeat_pattern', 'in', NON_REPEAT_PATTERNS)
    .where(sql`s.start_date::text`, '<', toStr)
    .where(sql`s.end_date::text`, '>=', fromStr)
    .execute()

  // 繰り返しの親: 範囲内に出現し得るもの（AIPO getScheduleList は全期間の親を取得するが、明らかに範囲外のものは除く）
  //   - 開始日が範囲末より前
  //   - 終了日あり（末尾 L）は end_date（= 最終回の終了時刻）が範囲始以降。終了日なし（末尾 N）は無期限
  const parentRows = await selectVisibleSchedules(loginUserId, userIds)
    .where('s.repeat_pattern', 'not in', NON_REPEAT_PATTERNS)
    .where(sql`s.start_date::text`, '<', toStr)
    .where((eb) =>
      eb.or([
        eb(sql`right(s.repeat_pattern, 1)`, '=', 'N'),
        eb(sql`s.end_date::text`, '>=', fromStr),
      ])
    )
    .execute()

  const normalEntries = normalRows.map((row) => toMultiUserEntry(row, loginUserId))
  const parentEntries = parentRows.map((row) => toMultiUserEntry(row, loginUserId))
  const parentIds = Array.from(new Set(parentEntries.map((p) => p.scheduleId)))
  const dummyKeys = await fetchDummyKeys(parentIds, toJstDateStr(from), toJstDateStr(to))

  return [...normalEntries, ...expandRepeatEntries(parentEntries, dummyKeys, from, to)]
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

// 「この予定のみ変更 / 削除」「全ての予定を変更 / 削除」の対象となる、ログインユーザーが owner の繰り返しの親を取得する
async function getOwnedRepeatParent(parentId: number, userId: number) {
  const rows = await db
    .selectFrom('eip_t_schedule')
    .where('schedule_id', '=', parentId)
    .where('owner_id', '=', userId)
    .select(['schedule_id', 'edit_flag'])
    .execute()
  return rows[0]
}

// 親の参加ユーザー・設備の map（ダミーの作成と、個別変更レコードの status 引き継ぎに使う）
async function getParentMaps(parentId: number) {
  const rows = await db
    .selectFrom('eip_t_schedule_map')
    .where('schedule_id', '=', parentId)
    .select(['user_id', 'type', 'status'])
    .execute()
  return {
    userStatus: new Map(rows.filter((r) => r.type === 'U').map((r) => [r.user_id, r.status ?? 'T'])),
    facilityIds: rows.filter((r) => r.type === 'F').map((r) => r.user_id),
  }
}

/**
 * ダミー（その日の出現を打ち消す子レコード）を作成する。AIPO ScheduleUtils.insertDummySchedule 準拠。
 * name='dummy'、start_date = end_date = 出現日 00:00、参加ユーザー・設備の map はすべて status='D'。
 */
async function insertDummySchedule(
  parentId: number,
  ownerId: number,
  occurrenceDate: string,
  userIds: number[],
  facilityIds: number[],
): Promise<void> {
  const nowStr = toJstStr(new Date())
  const dateStr = `${occurrenceDate} 00:00:00`
  const dummyId = await nextSeqId('pk_eip_t_schedule')
  await db.insertInto('eip_t_schedule').values({
    schedule_id: dummyId,
    name: 'dummy',
    note: '',
    place: '',
    start_date: dateStr,
    end_date: dateStr,
    // AIPO のダミーは非公開・共有メンバー編集不可で作成される
    public_flag: 'P',
    repeat_pattern: 'N',
    parent_id: parentId,
    edit_flag: 'F',
    mail_flag: 'N',
    owner_id: ownerId,
    create_user_id: ownerId,
    update_user_id: ownerId,
    create_date: nowStr,
    update_date: nowStr,
  }).execute()

  const targets = [
    ...userIds.map((id) => ({ id, type: 'U' as const })),
    ...facilityIds.map((id) => ({ id, type: 'F' as const })),
  ]
  if (targets.length === 0) return
  const mapIds = await nextNSeqIds('pk_eip_t_schedule_map', targets.length)
  await db.insertInto('eip_t_schedule_map').values(
    targets.map((t, i) => ({
      id: mapIds[i],
      schedule_id: dummyId,
      user_id: t.id,
      type: t.type,
      status: DUMMY_MAP_STATUS,
      common_category_id: 1,
    }))
  ).execute()
}

/**
 * 繰り返し予定を作成する（Phase F: AIPO と同じ動的展開方式）。
 *
 * 親レコード 1 件と、親の参加ユーザー・設備の map だけを登録する。出現は表示のたびに計算するため子レコードは作らない。
 * 親の start_date / end_date の格納ルール（AIPO 準拠）:
 *   start_date = 最初の出現の開始時刻、end_date = 終了日あり → 最後の出現の終了時刻 / 終了日なし → 最初の出現の終了時刻
 */
export async function addRepeatSchedule(userId: number, input: RepeatScheduleInput): Promise<void> {
  const hasLimit = input.limitEndDate != null
  // AIPO 準拠: limitStartDate が指定された場合、その日から出現日を数える（limit_start_date 相当）
  const limitStartStr = toJstDateStr(input.limitStartDate ?? input.startDate)
  const repeatPattern = encodeRepeatPattern(
    input.repeatType,
    hasLimit,
    input.weekDays,
    // 毎月は開始日の日付を毎月の日付にする
    input.repeatType === 'monthly' ? Number(limitStartStr.slice(8, 10)) : undefined,
  )

  const firstDate = findFirstPatternDate(repeatPattern, limitStartStr)
  const lastDate = hasLimit
    ? listPatternDates(repeatPattern, limitStartStr, toJstDateStr(input.limitEndDate as Date)).at(-1)
    : firstDate
  if (!firstDate || !lastDate || lastDate < firstDate) throw new Error('繰り返し出現日が0件です')

  const nowStr = toJstStr(new Date())
  const parentId = await nextSeqId('pk_eip_t_schedule')
  await db.insertInto('eip_t_schedule').values({
    schedule_id: parentId,
    name: input.name,
    note: input.note ?? null,
    place: input.place ?? null,
    start_date: toJstStr(makeDateJst(firstDate, toJstTimeStr(input.startDate))),
    end_date: toJstStr(makeDateJst(lastDate, toJstTimeStr(input.endDate))),
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

  // AIPO 準拠: 親にも参加ユーザー・設備の map を登録する（Phase C では登録していなかった）
  await insertScheduleParticipants(parentId, userId, input.participantIds ?? [])
  await insertScheduleFacilities(parentId, input.facilityIds ?? [])

  logger.info({ event: 'schedule.repeat.create', userId, parentId }, '繰り返しスケジュール追加')
}

/**
 * 繰り返し予定のうち 1 回だけを変更する（「この予定のみ変更」）。AIPO ScheduleFormData（個別日程の変更）準拠。
 *
 * 1. 入力内容で個別変更レコード（parent_id = 親 ID、repeat_pattern='N'）を作成する
 * 2. 出現日にダミーを作成し、元の出現を打ち消す
 */
export async function updateRepeatOne(
  parentId: number,
  occurrenceDate: string,
  userId: number,
  input: ScheduleInput,
): Promise<void> {
  const parent = await getOwnedRepeatParent(parentId, userId)
  // owner 以外は変更できない（AIPO 準拠）
  if (!parent) throw new Error('繰り返し予定が見つかりません')
  const parentMaps = await getParentMaps(parentId)

  const nowStr = toJstStr(new Date())
  const startStr = toJstStr(input.startDate)
  const endStr = input.isAllDay ? startStr : toJstStr(input.endDate)
  const childId = await nextSeqId('pk_eip_t_schedule')
  await db.insertInto('eip_t_schedule').values({
    schedule_id: childId,
    name: input.name,
    note: input.note ?? null,
    place: input.place ?? null,
    start_date: startStr,
    end_date: endStr,
    public_flag: input.publicFlag,
    // 個別変更レコードは独立した予定として扱うため 'N'（AIPO 準拠）
    repeat_pattern: 'N',
    parent_id: parentId,
    // AIPO 準拠: 共有メンバーによる編集可否は親から引き継ぐ
    edit_flag: parent.edit_flag ?? 'T',
    mail_flag: 'N',
    owner_id: userId,
    create_user_id: userId,
    update_user_id: userId,
    create_date: nowStr,
    update_date: nowStr,
  }).execute()

  // 参加ユーザーの status: オーナー 'O'、それ以外は親の status を引き継ぎ、親に無いユーザーは 'T'
  // （AIPO ScheduleFormData L1483–1499 準拠）
  const participantIds = Array.from(new Set([userId, ...(input.participantIds ?? [])]))
  const mapIds = await nextNSeqIds('pk_eip_t_schedule_map', participantIds.length)
  await db.insertInto('eip_t_schedule_map').values(
    participantIds.map((uid, i) => ({
      id: mapIds[i],
      schedule_id: childId,
      user_id: uid,
      type: 'U' as const,
      status: uid === userId ? 'O' : (parentMaps.userStatus.get(uid) ?? 'T'),
      common_category_id: 1,
    }))
  ).execute()
  await insertScheduleFacilities(childId, input.facilityIds ?? [])

  // ダミーは親の参加ユーザー・設備と、今回追加した参加ユーザーに作成する（AIPO ScheduleFormData L1550–1560 準拠）
  const dummyUserIds = Array.from(new Set([...parentMaps.userStatus.keys(), ...participantIds]))
  await insertDummySchedule(parentId, userId, occurrenceDate, dummyUserIds, parentMaps.facilityIds)

  logger.info({ event: 'schedule.repeat.updateOne', userId, parentId, childId }, '繰り返しスケジュール単件更新')
}

/**
 * 繰り返し予定の全件を変更する（「全ての予定を変更」）。
 *
 * 親レコードのタイトル・場所・内容・公開区分と、参加ユーザー・設備の map を更新する。
 * 時刻は親の start_date / end_date の時:分だけを置き換え、日付部分（繰り返しの開始日・終了日）は変えない。
 * 編集フォームの日付はクリックした出現日のため、日付ごと保存すると繰り返しの開始日が上書きされて
 * それ以前の回が消えてしまうため（仕様書 Phase F 参照）。
 * ダミー・個別変更レコードは変更しない（AIPO 準拠。個別に削除・変更した回はそのまま維持される）。
 */
export async function updateRepeatAll(
  parentId: number,
  userId: number,
  input: ScheduleInput,
): Promise<void> {
  const parent = await getOwnedRepeatParent(parentId, userId)
  if (!parent) throw new Error('繰り返し予定が見つかりません')

  const nowStr = toJstStr(new Date())
  const startIntervalStr = msToIntervalStr(getJstTimeOffsetMs(input.startDate))
  const endIntervalStr = msToIntervalStr(getJstTimeOffsetMs(input.endDate))

  // DB の timestamp は JST 格納のため、date_trunc('day', ...) は JST 深夜0時を返す
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
    .where('schedule_id', '=', parentId)
    .where('owner_id', '=', userId)
    .execute()

  // 参加者・設備はタイプ別に削除→再登録する。一括削除すると、片方だけ更新する際にもう片方が消えるため
  if (input.participantIds !== undefined) {
    await db.deleteFrom('eip_t_schedule_map')
      .where('schedule_id', '=', parentId)
      .where('type', '=', 'U')
      .execute()
    await insertScheduleParticipants(parentId, userId, input.participantIds)
  }
  if (input.facilityIds !== undefined) {
    await db.deleteFrom('eip_t_schedule_map')
      .where('schedule_id', '=', parentId)
      .where('type', '=', 'F')
      .execute()
    await insertScheduleFacilities(parentId, input.facilityIds)
  }

  logger.info({ event: 'schedule.repeat.updateAll', userId, parentId }, '繰り返しスケジュール全更新')
}

/**
 * 繰り返し予定のうち 1 回だけを削除する（「この予定のみ削除」）。AIPO deleteMemberAllRangeOneday 準拠。
 * 出現日にダミーを作成するだけで、親レコードは変更しない。
 */
export async function deleteRepeatOne(parentId: number, occurrenceDate: string, userId: number): Promise<void> {
  const parent = await getOwnedRepeatParent(parentId, userId)
  if (!parent) throw new Error('繰り返し予定が見つかりません')
  const parentMaps = await getParentMaps(parentId)
  await insertDummySchedule(parentId, userId, occurrenceDate, [...parentMaps.userStatus.keys()], parentMaps.facilityIds)

  logger.info({ event: 'schedule.repeat.deleteOne', userId, parentId }, '繰り返しスケジュール単件削除')
}

// ===========================================================
// Phase D: 日/月/一覧ビュー・設備予約
// ===========================================================

/**
 * 一覧ビュー（一覧モード）: from から LIST_VIEW_DAYS 日間の予定を、繰り返しを出現に展開して開始日時の昇順で返す。
 * AIPO ScheduleListSelectData / ScheduleListContainer 準拠（指定日から 7 日間を日付ごとに表示する）。
 */
export async function getListSchedules(
  loginUserId: number,
  userIds: number[],
  from: Date,
): Promise<MultiUserScheduleEntry[]> {
  const to = addDays(from, LIST_VIEW_DAYS)
  const entries = await getWeekSchedulesMulti(loginUserId, userIds, from, to)
  return entries.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
}

/**
 * 一覧ビュー（検索モード）: タイトル・場所・メモの部分一致で、日付で区切らずに予定を検索する。
 * AIPO ScheduleSearchSelectData / getScheduleList（検索モード）準拠:
 *   - 日付の条件は付けない（過去の予定も対象）
 *   - 開始日時の降順（ORDER BY start_date DESC）
 *   - 繰り返しは出現に展開せず、親レコード 1 件として返す（ダミーは表示用の status 条件で除外される）
 */
export async function searchSchedules(
  loginUserId: number,
  userIds: number[],
  keyword: string,
  limit: number,
  offset: number,
): Promise<MultiUserScheduleEntry[]> {
  const kw = keyword.trim()
  if (userIds.length === 0 || kw === '') return []

  // AIPO と同じ %keyword% 部分一致
  const pattern = `%${kw}%`
  const rows = await selectVisibleSchedules(loginUserId, userIds)
    .where((eb) =>
      eb.or([
        eb(sql`s.name`, 'ilike', pattern),
        eb(sql`s.place`, 'ilike', pattern),
        eb(sql`s.note`, 'ilike', pattern),
      ])
    )
    .orderBy(sql`s.start_date::text`, 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  return rows.map((row) => toMultiUserEntry(row, loginUserId))
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
 * 設備の空き確認: 指定日時に予約済みの設備 ID を返す（#204）。
 *
 * 繰り返し予定の出現も予約として扱う（Phase F）。作成・変更しようとしている予定が繰り返しの場合（repeat 指定時）は、
 * その全出現について空きを確認する（AIPO isDuplicateFacilitySchedule 準拠）。判定は repeat.ts の findBookedFacilityIds。
 *
 * @param excludeScheduleId 編集中の予定（自分の設備を「使用中」と誤判定しないため）。繰り返しの場合は親 ID
 * @param excludeDate 「この予定のみ変更」の場合の出現日。指定するとその日の出現だけを除外する
 * @param repeat 作成・変更しようとしている予定が繰り返しの場合の繰り返し設定
 */
export async function getBookedFacilityIds(
  startDate: Date,
  endDate: Date,
  excludeScheduleId?: number,
  excludeDate?: string,
  repeat?: { pattern: string; limitStartDate: Date; limitEndDate: Date | null },
): Promise<number[]> {
  // 既存予約を取得する範囲。対象が繰り返しなら繰り返しの期間全体（終了日なしは上限なし）
  const rangeStartStr = repeat ? `${toJstDateStr(repeat.limitStartDate)} 00:00:00` : toJstStr(startDate)
  const rangeEndStr: string | null = repeat
    ? (repeat.limitEndDate ? `${toJstDateStr(addDays(repeat.limitEndDate, 1))} 00:00:00` : null)
    : toJstStr(endDate)

  const selectFacilityBookings = () => db
    .selectFrom('eip_t_schedule_map as sm')
    .innerJoin('eip_t_schedule as s', 's.schedule_id', 'sm.schedule_id')
    .where('sm.type', '=', 'F')
    // ダミーの設備 map（status='D'）は予約ではない
    .where('sm.status', '!=', DUMMY_MAP_STATUS)
    .select([
      's.schedule_id',
      'sm.user_id as facility_id',
      sql<string>`s.start_date::text`.as('start_date_text'),
      sql<string>`s.end_date::text`.as('end_date_text'),
      's.repeat_pattern',
    ])

  // 通常予定（個別変更レコードを含む）: 範囲と時刻が重なり得るもの（半開区間: start < 範囲末 かつ end > 範囲始）
  let normalQuery = selectFacilityBookings()
    .where('s.repeat_pattern', 'in', NON_REPEAT_PATTERNS)
    .where(sql`s.end_date::text`, '>', rangeStartStr)
  if (rangeEndStr) normalQuery = normalQuery.where(sql`s.start_date::text`, '<', rangeEndStr)

  // 繰り返しの親: 範囲内に出現し得るもの（終了日ありは end_date が範囲始以降、終了日なしは無期限）
  let parentQuery = selectFacilityBookings()
    .where('s.repeat_pattern', 'not in', NON_REPEAT_PATTERNS)
    .where((eb) =>
      eb.or([
        eb(sql`right(s.repeat_pattern, 1)`, '=', 'N'),
        eb(sql`s.end_date::text`, '>=', rangeStartStr),
      ])
    )
  if (rangeEndStr) parentQuery = parentQuery.where(sql`s.start_date::text`, '<', rangeEndStr)

  const normalRows = await normalQuery.execute()
  const parentRows = await parentQuery.execute()

  const toBooking = (r: (typeof normalRows)[number]): FacilityBooking => ({
    scheduleId: r.schedule_id,
    facilityId: r.facility_id,
    startDate: parseJst(r.start_date_text),
    endDate: parseJst(r.end_date_text),
    repeatPattern: r.repeat_pattern ?? 'N',
  })
  const bookings = [...normalRows.map(toBooking), ...parentRows.map(toBooking)]

  // ダミーの取得範囲: 繰り返しの親が出現し得る範囲。終了日なしの対象どうしは repeat.ts の確認期間まで見る
  const parentIds = Array.from(new Set(parentRows.map((r) => r.schedule_id)))
  const dummyFrom = rangeStartStr.slice(0, 10)
  const dummyTo = rangeEndStr ? rangeEndStr.slice(0, 10) : '9999-12-31'
  const dummyKeys = await fetchDummyKeys(parentIds, dummyFrom, dummyTo)

  return findBookedFacilityIds(
    { startDate, endDate, repeat },
    bookings,
    dummyKeys,
    { scheduleId: excludeScheduleId, date: excludeDate },
  )
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
 * 繰り返し予定を削除する（「全ての予定を削除」）。AIPO ScheduleFormData.deleteSchedule 準拠。
 *
 * 親レコードとその map、および同じ親のダミーを削除する。
 * 個別変更レコードは削除しない（AIPO 準拠。独立した予定として残る）。
 */
export async function deleteRepeatAll(parentId: number, userId: number): Promise<void> {
  const parent = await getOwnedRepeatParent(parentId, userId)
  if (!parent) throw new Error('繰り返し予定が見つかりません')

  const dummies = await db.selectFrom('eip_t_schedule as s')
    .innerJoin('eip_t_schedule_map as sm', 'sm.schedule_id', 's.schedule_id')
    .where('s.parent_id', '=', parentId)
    .where('sm.status', '=', DUMMY_MAP_STATUS)
    .select('s.schedule_id')
    .execute()
  const dummyIds = Array.from(new Set(dummies.map((d) => d.schedule_id)))

  // map → 本体の順に削除する（参照整合性）
  await db.deleteFrom('eip_t_schedule_map').where('schedule_id', 'in', [parentId, ...dummyIds]).execute()
  if (dummyIds.length > 0) {
    await db.deleteFrom('eip_t_schedule').where('schedule_id', 'in', dummyIds).execute()
  }
  await db.deleteFrom('eip_t_schedule')
    .where('schedule_id', '=', parentId)
    .where('owner_id', '=', userId)
    .execute()

  logger.info({ event: 'schedule.repeat.deleteAll', userId, parentId }, '繰り返しスケジュール全削除')
}
