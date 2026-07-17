export type ActivityEntry = {
  activityId: number
  entityId: number              // スケジュールID（activity.external_id）
  scheduleName: string | null   // title の「」内から抽出。削除済みでも title に残るため通常は非 null
  updaterName: string           // 更新者氏名（姓名結合）
  updaterInitial: string        // 苗字の先頭1文字（イニシャルアイコン用）
  updaterUserId: number         // アイコン色の決定に使用（user-list と同じ Murmur3 ハッシュを適用）
  updateDate: Date
  isNew: boolean                // true=追加, false=編集（activity.title の「追加」「編集」で判定）
}
