// スケジュールウィジェット共通定数

/** 最大表示人数（AIPO 準拠） */
export const MAX_USERS = 30

/** 1 時間あたりのピクセル高さ（時刻グリッドの基準単位） */
export const HOUR_PX = 60

/** スケジュールブロックの最小高さ（15 分未満の予定でも視認できるよう確保） */
export const MIN_BLOCK_PX = 20

/**
 * 週カレンダーの曜日ラベル（日曜始まり順、AIPO準拠）。
 * インデックス 0=日 〜 6=土 で、getWeekDays の先頭（日曜）から並ぶ。
 */
export const DOW_JA = ['日', '月', '火', '水', '木', '金', '土']

/** 一覧ビューの1ページあたり表示件数（仕様書 Phase D 準拠） */
export const LIST_VIEW_PAGE_SIZE = 30

/**
 * 単独ユーザービューで使用する公開区分ごとの色クラス。
 * 月ビュー・日ビュー・週ビューで共通して使用する。
 */
export const PUBLIC_FLAG_COLORS: Record<'O' | 'P' | 'C', string> = {
  O: 'bg-brand text-white',
  P: 'bg-gray-400 text-white',
  C: 'bg-gray-600 text-white',
}

/**
 * マルチユーザービューで使用するプリセットカラー。
 * 自分はブランドカラー（インデックス 0）、追加ユーザーはインデックス 1 以降を順に割り当てる。
 * 最大 30 人（AIPO 準拠）に対応できる色数を確保する。
 */
export const USER_COLORS = [
  'bg-brand text-white',       // 0: 自分（オレンジ）
  'bg-blue-500 text-white',    // 1
  'bg-green-500 text-white',   // 2
  'bg-purple-500 text-white',  // 3
  'bg-teal-500 text-white',    // 4
  'bg-pink-500 text-white',    // 5
  'bg-amber-500 text-white',   // 6
  'bg-indigo-500 text-white',  // 7
  'bg-red-400 text-white',     // 8
  'bg-cyan-500 text-white',    // 9
  'bg-lime-500 text-white',    // 10
  'bg-orange-400 text-white',  // 11
  'bg-violet-500 text-white',  // 12
  'bg-rose-400 text-white',    // 13
  'bg-emerald-500 text-white', // 14
  'bg-fuchsia-500 text-white', // 15
  'bg-sky-500 text-white',     // 16
  'bg-yellow-500 text-white',  // 17
  'bg-slate-500 text-white',   // 18
  'bg-blue-700 text-white',    // 19
] as const
