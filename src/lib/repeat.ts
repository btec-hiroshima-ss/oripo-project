/**
 * 繰り返し予定ユーティリティ（Phase C）
 *
 * AIPO の repeat_pattern エンコード規則・Oripo の事前展開方式に基づく。
 * DB の timestamp は JST で格納されており、日付計算はすべて JST 基準で行う。
 */

import { formatInTimeZone } from 'date-fns-tz'

export type RepeatType = 'daily' | 'weekly' | 'monthly'

// 1日のミリ秒数
const DAY_MS = 24 * 60 * 60 * 1000
// JST = UTC+9
const JST_OFFSET_MS = 9 * 60 * 60 * 1000
// 事前展開の上限（無期限の場合は2年分）
const MAX_OCCURRENCES = 730

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
 *   L = 終了日あり、N = 終了日なし（Oripo では2年分展開）
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

/**
 * 繰り返し予定の全出現日（JST 深夜0時の UTC Date）リストを返す。
 *
 * 各要素に getJstTimeOffsetMs(startDate) を加算することで
 * その日の実際の開始時刻の UTC Date が得られる。
 *
 * @param repeatType  繰り返し種別
 * @param firstStart  最初の出現日の開始時刻（UTC Date）
 * @param weekDays    毎週の場合の曜日フラグ [日, 月, 火, 水, 木, 金, 土]
 * @param limitEndDate  終了日（UTC Date）。null の場合は2年分展開
 */
export function calcOccurrenceDates(params: {
  repeatType: RepeatType
  firstStart: Date
  weekDays?: boolean[]
  limitEndDate?: Date | null
}): Date[] {
  const { repeatType, firstStart, weekDays, limitEndDate } = params

  const firstMidnight = getJstMidnightUtc(firstStart)

  // 期間上限: 終了日あり → その日の JST 深夜0時まで、なし → 2年分
  const limitMidnight = limitEndDate
    ? getJstMidnightUtc(limitEndDate)
    : new Date(firstMidnight.getTime() + 2 * 365 * DAY_MS)

  // 毎月: 最初の出現日の JST 日付
  const firstJstDay = new Date(firstMidnight.getTime() + JST_OFFSET_MS).getUTCDate()

  const results: Date[] = []
  let current = firstMidnight

  while (current.getTime() <= limitMidnight.getTime() && results.length < MAX_OCCURRENCES) {
    const jstDate = new Date(current.getTime() + JST_OFFSET_MS)
    const dow = jstDate.getUTCDay()         // 0=日, 1=月, ...
    const dayOfMonth = jstDate.getUTCDate() // 1-31

    const isOccurrence =
      repeatType === 'daily' ||
      (repeatType === 'weekly' && (weekDays?.[dow] ?? false)) ||
      (repeatType === 'monthly' && dayOfMonth === firstJstDay)

    if (isOccurrence) results.push(current)
    current = new Date(current.getTime() + DAY_MS)
  }

  return results
}
