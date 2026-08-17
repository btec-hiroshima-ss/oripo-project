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

/** 月ビューの1セル内に表示する最大予定件数（超過分は "+N件" で折りたたむ） */
export const MAX_EVENTS_PER_CELL = 2

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
 * 週・日ビューの ScheduleBlock 用スタイル（左端カラーバー + 薄い背景）。
 * モックアップ（specs/images/ホーム.png）準拠。
 * PUBLIC_FLAG_COLORS と対応する公開区分ごとに定義する。
 * Tailwind のパージ対策として全クラス名を静的に列挙する。
 */
export const PUBLIC_FLAG_BLOCK_CLASSES: Record<'O' | 'P' | 'C', string> = {
  O: 'border-l-2 border-brand bg-brand/15 text-gray-900',
  P: 'border-l-2 border-gray-400 bg-gray-400/15 text-gray-900',
  C: 'border-l-2 border-gray-600 bg-gray-600/15 text-gray-900',
}

/**
 * マルチユーザービューの ScheduleBlock 用スタイル（左端カラーバー + 薄い背景）。
 * USER_COLORS と対応するユーザー順で定義する。
 * Tailwind のパージ対策として全クラス名を静的に列挙する。
 */
export const USER_BLOCK_COLORS = [
  'border-l-2 border-brand bg-brand/15 text-gray-900',       // 0: 自分（オレンジ）
  'border-l-2 border-blue-500 bg-blue-500/15 text-gray-900', // 1
  'border-l-2 border-green-500 bg-green-500/15 text-gray-900', // 2
  'border-l-2 border-purple-500 bg-purple-500/15 text-gray-900', // 3
  'border-l-2 border-teal-500 bg-teal-500/15 text-gray-900', // 4
  'border-l-2 border-pink-500 bg-pink-500/15 text-gray-900', // 5
  'border-l-2 border-amber-500 bg-amber-500/15 text-gray-900', // 6
  'border-l-2 border-indigo-500 bg-indigo-500/15 text-gray-900', // 7
  'border-l-2 border-red-400 bg-red-400/15 text-gray-900',   // 8
  'border-l-2 border-cyan-500 bg-cyan-500/15 text-gray-900', // 9
  'border-l-2 border-lime-500 bg-lime-500/15 text-gray-900', // 10
  'border-l-2 border-orange-400 bg-orange-400/15 text-gray-900', // 11
  'border-l-2 border-violet-500 bg-violet-500/15 text-gray-900', // 12
  'border-l-2 border-rose-400 bg-rose-400/15 text-gray-900', // 13
  'border-l-2 border-emerald-500 bg-emerald-500/15 text-gray-900', // 14
  'border-l-2 border-fuchsia-500 bg-fuchsia-500/15 text-gray-900', // 15
  'border-l-2 border-sky-500 bg-sky-500/15 text-gray-900',   // 16
  'border-l-2 border-yellow-500 bg-yellow-500/15 text-gray-900', // 17
  'border-l-2 border-slate-500 bg-slate-500/15 text-gray-900', // 18
  'border-l-2 border-blue-700 bg-blue-700/15 text-gray-900', // 19
] as const

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
