export type WhatsnewEntry = {
  whatsnewId: number
  // 将来の拡張に備えて保持（6=スケジュール。AIPO: WhatsNewUtils.WHATS_NEW_TYPE_SCHEDULE）
  portletType: number
  entityId: number
  // スケジュールが削除済みの場合は null（LEFT JOIN で取得できない）
  scheduleName: string | null
  updaterName: string
  // アイコン表示用（苗字の先頭1文字）
  updaterInitial: string
  // アイコン色の決定に使用（user-list と同じ Murmur3 ハッシュを適用）
  updaterUserId: number
  updateDate: Date
  // true=追加, false=編集。create_date と update_date の差分で判定（AIPO の whatsnew 書き込み仕様による）
  isNew: boolean
}
