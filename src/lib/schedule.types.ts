import type { RepeatType } from './repeat'

export type ScheduleEntry = {
  scheduleId: number
  name: string
  note: string | null
  place: string | null
  startDate: Date    // UTC に正規化済み（DB の JST 文字列から parseJst で変換）
  endDate: Date      // UTC に正規化済み
  publicFlag: 'O' | 'P' | 'C'
  repeatPattern: string
  isAllDay: boolean  // repeatPattern === 'S'（終日予定）
  parentId: number   // 0 = 単独/繰り返し親; > 0 = 繰り返し子レコード
  isOwner: boolean   // ownerId === ログイン中ユーザーの userId
  ownerId: number
}

/** 詳細モーダル用の追加情報（クリック時に別途取得）
 * Server Action 経由で返すため日時は JST 文字列（YYYY-MM-DD HH:MM:SS）で保持する
 * （Date オブジェクトは JSON シリアライズで文字列になるため）
 */
export type ScheduleDetail = {
  creatorName: string
  /** JST 日時文字列 "YYYY-MM-DD HH:MM:SS" */
  creatorDateJst: string
  updaterName: string
  /** JST 日時文字列 "YYYY-MM-DD HH:MM:SS" */
  updaterDateJst: string
  /** 参加ユーザー名の配列（owner 含む） */
  participantNames: string[]
}

export type ScheduleInput = {
  name: string
  note?: string
  place?: string
  startDate: Date
  endDate: Date
  isAllDay: boolean
  publicFlag: 'O' | 'P' | 'C'
  /** Phase B: 参加ユーザー ID リスト。指定なしの場合は作成者のみを登録する */
  participantIds?: number[]
  /**
   * 期間で指定（Phase C）: isAllDay=true かつ複数日にまたがる場合に指定する。
   * この日（含む）の翌日00:00 JST を exclusive end として DB に格納する。
   * 未指定の場合は通常の終日予定（start_date=end_date）として扱う。
   */
  periodEndDate?: Date
}

// ===========================================================
// Phase C: 繰り返し予定
// ===========================================================

/** 繰り返し予定の作成・全件更新時の入力型 */
export type RepeatScheduleInput = {
  name: string
  note?: string
  place?: string
  /** 最初の出現日の開始時刻 */
  startDate: Date
  /** 最初の出現日の終了時刻（startDate との差分が各繰り返し回の長さ） */
  endDate: Date
  publicFlag: 'O' | 'P' | 'C'
  participantIds?: number[]
  repeatType: RepeatType
  /** 毎週の場合の曜日フラグ [日, 月, 火, 水, 木, 金, 土] */
  weekDays?: boolean[]
  /** null = 2年分展開（無期限） */
  limitEndDate?: Date | null
}

// ===========================================================
// Phase B: マルチユーザービュー・ユーザーピッカー用型
// ===========================================================

/** ユーザーピッカー表示用の最小ユーザー情報 */
export type ScheduleUser = {
  userId: number
  fullName: string
}

/** グループ一覧（turbine_group のエイリアス名付き実グループ） */
export type ScheduleGroup = {
  groupId: number
  /** turbine_group.group_alias_name */
  groupName: string
}

/**
 * マルチユーザービュー用エントリ。
 * 誰のカレンダーに表示されているかを保持する。
 * viewUserId が自分以外の場合、public_flag='P' は name="非公開"、'C' は取得されない。
 */
export type MultiUserScheduleEntry = ScheduleEntry & {
  /** このエントリが属するユーザーの user_id（色分け・凡例表示に使用） */
  viewUserId: number
  /** 色凡例・予定ブロックのラベルに使用する表示名 */
  viewUserName: string
}
