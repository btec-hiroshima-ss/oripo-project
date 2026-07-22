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

export type ScheduleInput = {
  name: string
  note?: string
  place?: string
  startDate: Date
  endDate: Date
  isAllDay: boolean
  publicFlag: 'O' | 'P' | 'C'
}
