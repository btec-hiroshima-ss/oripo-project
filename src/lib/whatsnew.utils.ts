// クライアントコンポーネントから安全にインポートできる純粋関数のみ置く（DB依存なし）

// スケジュールが削除済みの場合に fallback テキストを返す
export function getScheduleDisplayName(scheduleName: string | null): string {
  return scheduleName ?? '（削除済み）'
}

// 更新日時を HH:mm 形式にフォーマットする（モックアップ準拠）
export function formatWhatsnewDate(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${min}`
}
