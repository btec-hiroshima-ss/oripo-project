/**
 * 繰り返し予定ユーティリティ
 *
 * AIPO の repeat_pattern エンコード規則と、Phase F（#211）で戻した AIPO 準拠の動的展開方式に基づく。
 * 繰り返し予定は親レコードだけを保存し、表示・空き確認のたびにここで出現を計算する。
 * DB の timestamp は JST で格納されており、日付計算はすべて JST 基準で行う。
 * DB に依存しない純粋関数だけを置き、schedule.ts から呼び出す（モックなしでテストできるようにするため）。
 */

import { formatInTimeZone } from 'date-fns-tz'
import { makeDateJst, toJstDateStr, toJstTimeStr } from './jst'

export type RepeatType = 'daily' | 'weekly' | 'monthly'

// 1日のミリ秒数
const DAY_MS = 24 * 60 * 60 * 1000
// JST = UTC+9
const JST_OFFSET_MS = 9 * 60 * 60 * 1000
// 終了日なしの繰り返しどうしの重なりを確認する日数。
// 曜日 × 日付（1〜31日）が一致する日の間隔は最大でも約 1.66 年（608 日）のため、3 年あれば必ず一巡する
export const UNLIMITED_OVERLAP_WINDOW_DAYS = 3 * 366
// 新規作成時に最初の出現日を探す日数。毎月 31 日指定でも 1 年以内に必ず出現する
const FIRST_OCCURRENCE_SEARCH_DAYS = 366

/**
 * UTC Date から JST 深夜0時の UTC Date を返す。
 * DB の start_date::date_trunc('day', ...) と同じ基準点として使用する。
 */
export function getJstMidnightUtc(utcDate: Date): Date {
  const jstMs = utcDate.getTime() + JST_OFFSET_MS
  const jstMidnightMs = Math.floor(jstMs / DAY_MS) * DAY_MS
  return new Date(jstMidnightMs - JST_OFFSET_MS)
}

/**
 * UTC Date の JST 深夜0時からの経過ミリ秒を返す。
 * "HH:MM 形式の時刻部分" を抽出する用途。
 * date_trunc('day', ...) + この値 = 新しい時刻という計算に使う。
 */
export function getJstTimeOffsetMs(utcDate: Date): number {
  return (utcDate.getTime() + JST_OFFSET_MS) % DAY_MS
}

/**
 * ミリ秒数を "HH:MM:SS" 形式の interval 文字列に変換する。
 * date_trunc('day', start_date) + 'HH:MM:SS'::interval で JST 時刻を指定するために使う。
 */
export function msToIntervalStr(ms: number): string {
  // ms を UTC epoch として Date に変換し、UTC 基準で "HH:mm:ss" にフォーマットする
  return formatInTimeZone(new Date(ms), 'UTC', 'HH:mm:ss')
}

/**
 * RepeatScheduleInput から repeat_pattern 文字列を生成する。
 *
 * AIPO エンコード規則:
 *   毎日: D{L|N}
 *   毎週: W{日月火水木金土の0/1 × 7文字}{L|N}
 *   毎月: M{2桁日}{L|N}
 *   L = 終了日あり、N = 終了日なし
 */
export function encodeRepeatPattern(
  repeatType: RepeatType,
  hasLimit: boolean,
  weekDays?: boolean[],  // [日, 月, 火, 水, 木, 金, 土]
  monthDay?: number,     // 1-31
): string {
  const limitChar = hasLimit ? 'L' : 'N'
  if (repeatType === 'daily') return `D${limitChar}`
  if (repeatType === 'weekly') {
    const bits = (weekDays ?? new Array(7).fill(false)).map((b) => (b ? '1' : '0')).join('')
    return `W${bits}${limitChar}`
  }
  // monthly
  const day = String(monthDay ?? 1).padStart(2, '0')
  return `M${day}${limitChar}`
}

/**
 * repeat_pattern 文字列をパースして繰り返し設定を返す。
 * フォームの初期値表示（編集時）に使用する。
 */
export function decodeRepeatPattern(pattern: string): {
  repeatType: RepeatType | 'none'
  weekDays?: boolean[]  // [日, 月, 火, 水, 木, 金, 土]
  monthDay?: number
  hasLimit: boolean
} {
  if (!pattern || pattern === 'N' || pattern === 'S') {
    return { repeatType: 'none', hasLimit: false }
  }
  const hasLimit = pattern.at(-1) === 'L'
  if (pattern.startsWith('D')) {
    return { repeatType: 'daily', hasLimit }
  }
  if (pattern.startsWith('W') && pattern.length >= 9) {
    const bits = pattern.slice(1, 8)
    const weekDays = bits.split('').map((b) => b === '1')
    return { repeatType: 'weekly', weekDays, hasLimit }
  }
  if (pattern.startsWith('M') && pattern.length >= 4) {
    const monthDay = parseInt(pattern.slice(1, 3), 10)
    return { repeatType: 'monthly', monthDay, hasLimit }
  }
  return { repeatType: 'none', hasLimit: false }
}

// ===========================================================
// Phase F（#211）: 動的展開
// ===========================================================

/** "YYYY-MM-DD" に日数を加える。日付だけを扱うため UTC で計算してタイムゾーンの影響を避ける */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** from〜to（両端を含む、"YYYY-MM-DD"）の日付を順に返す */
function eachDateStr(from: string, to: string): string[] {
  const result: string[] = []
  for (let d = from; d <= to; d = addDaysToDateStr(d, 1)) result.push(d)
  return result
}

/**
 * 日付だけでパターンに一致するかを判定する（期間の判定はしない）。
 * AIPO ScheduleUtils.isView の曜日・日付判定部分に相当。
 */
function matchesPatternDay(dateStr: string, pattern: string): boolean {
  const d = new Date(`${dateStr}T00:00:00Z`)
  switch (pattern[0]) {
    case 'D':
      return true
    case 'W':
      // pattern[1]〜[7] が日〜土。AIPO は '0' 以外を一致とみなす
      return pattern[1 + d.getUTCDay()] !== '0'
    case 'M':
      // その日が無い月（例: 31 日指定の 4 月）は出現しない。月末への繰り上げはしない（AIPO 準拠）
      return parseInt(pattern.slice(1, 3), 10) === d.getUTCDate()
    default:
      // 'N'（繰り返しなし）・'S'（期間指定）は繰り返しではない
      return false
  }
}

/** 終了日あり（末尾 L）かどうか */
export function hasRepeatLimit(pattern: string): boolean {
  return pattern.at(-1) === 'L'
}

/** repeat_pattern が繰り返しの親を表すか（'N'・'S' 以外） */
export function isRepeatPattern(pattern: string): boolean {
  return pattern !== 'N' && pattern !== 'S' && pattern !== ''
}

/**
 * 指定日（JST "YYYY-MM-DD"）が繰り返しの出現日かを判定する。AIPO ScheduleUtils.isView 準拠。
 *
 * - 終了日あり: 親の start_date の日付〜end_date の日付（両端を含む）の範囲内のみ
 * - 終了日なし: 親の start_date の日付以降のみ。
 *   AIPO の isView は終了日なしの場合に開始日を判定せず開始日より前にも出現するが、
 *   不具合と判断し Oripo では開始日より前には出現させない（2026-10-01 ユーザー確認済み）
 */
export function isRepeatMatch(dateStr: string, pattern: string, parentStart: Date, parentEnd: Date): boolean {
  if (dateStr < toJstDateStr(parentStart)) return false
  if (hasRepeatLimit(pattern) && dateStr > toJstDateStr(parentEnd)) return false
  return matchesPatternDay(dateStr, pattern)
}

/**
 * 出現日に親の開始・終了の時:分（JST）を組み合わせた日時を返す（AIPO ScheduleWeekContainer 準拠）。
 * 親の end_date は終了日あり（L）の場合は最終日なので、日付は使わず時:分だけを使う。
 */
export function occurrenceRange(dateStr: string, parentStart: Date, parentEnd: Date): { startDate: Date; endDate: Date } {
  return {
    startDate: makeDateJst(dateStr, toJstTimeStr(parentStart)),
    endDate: makeDateJst(dateStr, toJstTimeStr(parentEnd)),
  }
}

/** ダミー（出現の打ち消し）を照合するキー。表示ユーザーは見ず「親 ID + 日付」で照合する（仕様書 Phase F 参照） */
export function dummyKey(parentId: number, dateStr: string): string {
  return `${parentId}:${dateStr}`
}

/**
 * パターンに一致する日付を from〜to（両端を含む）の範囲で返す。親の期間は判定しない。
 * 新規作成時に最初・最後の出現日を求めるために使う。
 */
export function listPatternDates(pattern: string, from: string, to: string): string[] {
  return eachDateStr(from, to).filter((d) => matchesPatternDay(d, pattern))
}

/** 新規作成時: from 以降で最初にパターンに一致する日付（見つからなければ null） */
export function findFirstPatternDate(pattern: string, from: string): string | null {
  return listPatternDates(pattern, from, addDaysToDateStr(from, FIRST_OCCURRENCE_SEARCH_DAYS))[0] ?? null
}

type RepeatParentLike = {
  scheduleId: number
  startDate: Date
  endDate: Date
  repeatPattern: string
}

/**
 * 繰り返しの親を、表示期間 [from, to) に入る出現に展開する（各ビュー共通）。
 *
 * - 同じ親 ID のダミーがある日付の出現は除外する（AIPO ScheduleDayContainer.addResultData 準拠）
 * - 期間との重なりは従来の通常予定と同じ「start < to かつ end >= from」で判定する
 *   （長さ 0 の出現でも期間の初日に表示されるようにするため >= を使う）
 * - 出現の scheduleId は親の ID のまま、parentId は 0、occurrenceDate に出現日、
 *   repeatStartDate / repeatEndDate に親の start_date / end_date を入れる
 */
export function expandRepeatEntries<T extends RepeatParentLike>(
  parents: T[],
  dummyKeys: Set<string>,
  from: Date,
  to: Date,
): (T & { occurrenceDate: string; parentId: number; repeatStartDate: Date; repeatEndDate: Date })[] {
  const dates = eachDateStr(toJstDateStr(from), toJstDateStr(to))
  const result: (T & { occurrenceDate: string; parentId: number; repeatStartDate: Date; repeatEndDate: Date })[] = []
  for (const parent of parents) {
    for (const dateStr of dates) {
      if (!isRepeatMatch(dateStr, parent.repeatPattern, parent.startDate, parent.endDate)) continue
      if (dummyKeys.has(dummyKey(parent.scheduleId, dateStr))) continue
      const { startDate, endDate } = occurrenceRange(dateStr, parent.startDate, parent.endDate)
      if (!(startDate < to && endDate >= from)) continue
      result.push({
        ...parent,
        startDate,
        endDate,
        parentId: 0,
        occurrenceDate: dateStr,
        // 「全ての予定を変更」で繰り返しの期間を使うため、親の開始日・終了日を残す
        repeatStartDate: parent.startDate,
        repeatEndDate: parent.endDate,
      })
    }
  }
  return result
}

// -----------------------------------------------------------
// 設備の空き確認（#204）
// -----------------------------------------------------------

/** 空き確認の対象となる既存の設備予約（eip_t_schedule_map type='F' 1 件分） */
export type FacilityBooking = {
  scheduleId: number
  facilityId: number
  startDate: Date
  endDate: Date
  repeatPattern: string
}

/** 作成・変更しようとしている予定 */
export type AvailabilityTarget = {
  startDate: Date
  endDate: Date
  /** 繰り返しの場合のみ。全出現について空きを確認する */
  repeat?: { pattern: string; limitStartDate: Date; limitEndDate: Date | null }
}

/** 空き確認から除外する予定。date を指定するとその日の出現だけを除外する（「この予定のみ変更」用） */
export type AvailabilityExclude = { scheduleId?: number; date?: string }

/** 半開区間 [aStart, aEnd) と [bStart, bEnd) が重なるか。長さ 0 の区間はどれとも重ならない */
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd
}

/**
 * 既存の設備予約（通常予定・繰り返しの親）と対象の予定が重なる設備 ID を返す。
 *
 * 対象・既存のどちらが繰り返しでも、出現日を計算して重なりを判定する（AIPO isDuplicateFacilitySchedule 準拠）。
 * 終了日なしの繰り返しどうしは、両方の開始日のうち遅い方から UNLIMITED_OVERLAP_WINDOW_DAYS 日を確認する。
 * AIPO は終了日なしどうしで時刻が重なれば日付を見ずに重複とみなすが、実際には一度も重ならない
 * 組み合わせまで使用中になるため、Oripo は出現日を計算する（仕様書 Phase F 参照）。
 */
export function findBookedFacilityIds(
  target: AvailabilityTarget,
  bookings: FacilityBooking[],
  dummyKeys: Set<string>,
  exclude: AvailabilityExclude = {},
): number[] {
  // 対象の繰り返しを親と同じ形（日付は期間、時:分は対象の時刻）にそろえ、isRepeatMatch・occurrenceRange を共用する
  const targetRepeat = target.repeat
    ? {
        pattern: target.repeat.pattern,
        start: makeDateJst(toJstDateStr(target.repeat.limitStartDate), toJstTimeStr(target.startDate)),
        end: makeDateJst(toJstDateStr(target.repeat.limitEndDate ?? target.repeat.limitStartDate), toJstTimeStr(target.endDate)),
      }
    : null

  // 対象の、指定日における時間帯（出現しない日は null）
  const targetRangeOn = (dateStr: string): { startDate: Date; endDate: Date } | null => {
    if (!targetRepeat) return { startDate: target.startDate, endDate: target.endDate }
    if (!isRepeatMatch(dateStr, targetRepeat.pattern, targetRepeat.start, targetRepeat.end)) return null
    return occurrenceRange(dateStr, targetRepeat.start, targetRepeat.end)
  }

  // 対象が出現し得る日付範囲（終了日なしの繰り返しは上限なし = null）
  const targetFrom = toJstDateStr(targetRepeat ? targetRepeat.start : target.startDate)
  const targetTo: string | null = targetRepeat
    ? (hasRepeatLimit(targetRepeat.pattern) ? toJstDateStr(targetRepeat.end) : null)
    : toJstDateStr(target.endDate)

  const booked = new Set<number>()
  for (const b of bookings) {
    if (booked.has(b.facilityId)) continue

    if (!isRepeatPattern(b.repeatPattern)) {
      // 通常予定: 日付指定なしの除外指定（予定の編集時）だけが対象
      if (exclude.scheduleId === b.scheduleId && exclude.date === undefined) continue
      // 対象が繰り返しでない場合は日付に関係なく区間で判定する（日をまたぐ予定にも対応するため）。
      // 繰り返しの場合は、既存予定がかかる各日について対象の出現と比べる
      const hit = targetRepeat
        ? eachDateStr(toJstDateStr(b.startDate), toJstDateStr(b.endDate)).some((d) => {
            const r = targetRangeOn(d)
            return r !== null && overlaps(r.startDate, r.endDate, b.startDate, b.endDate)
          })
        : overlaps(target.startDate, target.endDate, b.startDate, b.endDate)
      if (hit) booked.add(b.facilityId)
      continue
    }

    // 既存の繰り返し: 両者が出現し得る日付範囲を求めて 1 日ずつ判定する
    const bFrom = toJstDateStr(b.startDate)
    const bTo = hasRepeatLimit(b.repeatPattern) ? toJstDateStr(b.endDate) : null
    const from = bFrom > targetFrom ? bFrom : targetFrom
    const upperBounds = [bTo, targetTo].filter((d): d is string => d !== null)
    const to = upperBounds.length > 0
      ? upperBounds.reduce((a, c) => (a < c ? a : c))
      : addDaysToDateStr(from, UNLIMITED_OVERLAP_WINDOW_DAYS)
    if (from > to) continue

    const hit = eachDateStr(from, to).some((d) => {
      if (!isRepeatMatch(d, b.repeatPattern, b.startDate, b.endDate)) return false
      if (dummyKeys.has(dummyKey(b.scheduleId, d))) return false
      if (exclude.scheduleId === b.scheduleId && (exclude.date === undefined || exclude.date === d)) return false
      const r = targetRangeOn(d)
      if (r === null) return false
      const occ = occurrenceRange(d, b.startDate, b.endDate)
      return overlaps(r.startDate, r.endDate, occ.startDate, occ.endDate)
    })
    if (hit) booked.add(b.facilityId)
  }
  return [...booked]
}

// -----------------------------------------------------------
// 表示用
// -----------------------------------------------------------

// 繰り返しの説明文に使う曜日ラベル（repeat_pattern の曜日ビットと同じ日〜土の順）
const REPEAT_DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']

/**
 * 繰り返しの親の内容を説明する文字列（例: 「毎週 木 15:50〜17:00」「毎月 15日 10:00〜11:00（2026/01/15〜2026/12/15）」）。
 * キーワード検索の結果・詳細モーダルで、出現に展開しない繰り返しの親を表示するために使う。
 */
export function describeRepeat(pattern: string, parentStart: Date, parentEnd: Date): string {
  let kind = ''
  if (pattern[0] === 'D') kind = '毎日'
  if (pattern[0] === 'W') {
    const days = REPEAT_DOW_LABELS.filter((_, i) => pattern[1 + i] === '1').join('・')
    kind = `毎週 ${days}`
  }
  if (pattern[0] === 'M') kind = `毎月 ${parseInt(pattern.slice(1, 3), 10)}日`
  const time = `${toJstTimeStr(parentStart)}〜${toJstTimeStr(parentEnd)}`
  const limit = hasRepeatLimit(pattern)
    ? `（${toJstDateStr(parentStart).replace(/-/g, '/')}〜${toJstDateStr(parentEnd).replace(/-/g, '/')}）`
    : ''
  return `${kind} ${time}${limit}`
}
