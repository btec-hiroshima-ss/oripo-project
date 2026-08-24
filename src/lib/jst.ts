import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

// JST (Asia/Tokyo): UTC+9、DST なし。
// DB の timestamp は JST で格納されており、UTC の Date との変換が必要。
// date-fns-tz の toZonedTime でタイムゾーン変換し format/getXxx で読み取る。
const JST = 'Asia/Tokyo'
const DOW_JA = ['日', '月', '火', '水', '木', '金', '土']

/** UTC Date → "YYYY-MM-DD"（JST） */
export function toJstDateStr(date: Date): string {
  return format(toZonedTime(date, JST), 'yyyy-MM-dd')
}

/** UTC Date → "HH:mm"（JST） */
export function toJstTimeStr(date: Date): string {
  return format(toZonedTime(date, JST), 'HH:mm')
}

/**
 * UTC Date → "YYYY年M月D日（曜日）"（JST）
 * 予定詳細モーダルの日付表示に使用。
 */
export function toJstDateJa(date: Date): string {
  const z = toZonedTime(date, JST)
  // format の曜日指定はロケール依存のため DOW_JA 配列でマッピングする
  return `${format(z, 'yyyy')}年${format(z, 'M')}月${format(z, 'd')}日（${DOW_JA[z.getDay()]}）`
}

/**
 * "YYYY-MM-DD" が今日（JST）かどうか
 * カレンダーヘッダーの今日ハイライトに使用。
 */
export function isTodayJst(dateStr: string): boolean {
  return dateStr === toJstDateStr(new Date())
}

/**
 * UTC Date → JST の深夜0時からの経過分数。スケジュールブロックの縦位置・高さ計算に使用。
 */
export function toJstMinutesSinceMidnight(date: Date): number {
  const z = toZonedTime(date, JST)
  return z.getHours() * 60 + z.getMinutes()
}

/**
 * 日付文字列 "YYYY-MM-DD" と時刻文字列 "HH:MM" から JST の Date を返す。
 * timeStr 省略時は 00:00 JST（その日の深夜0時）。
 * ScheduleFormModal での new Date(`${d}T${t}:00+09:00`) パターンを集約するため追加。
 */
export function makeDateJst(dateStr: string, timeStr?: string): Date {
  return new Date(`${dateStr}T${timeStr ?? '00:00'}:00+09:00`)
}

/**
 * JST 文字列 "YYYY-MM-DD [HH:MM:SS]" → "YYYY年M月D日" または "YYYY年M月D日 H時MM分"
 * Server Action の返り値（ScheduleDetail.creatorDateJst 等）は Date が JSON 経由で
 * 文字列になるため、JST 文字列のまま受け取り整形する。
 */
export function formatJstDatetime(jstStr: string): string {
  const parts = jstStr.split(' ')
  const [y, m, d] = parts[0].split('-').map(Number)
  if (parts.length === 1) return `${y}年${m}月${d}日`
  const [h, mn] = parts[1].split(':').map(Number)
  return `${y}年${m}月${d}日 ${h}時${String(mn).padStart(2, '0')}分`
}
