// クライアントコンポーネントから安全にインポートできる純粋関数と定数のみ置く（DB依存なし）

// AIPO ウィジェットは1ページ10件（スクリーンショット「1〜10/550」より）
export const ACTIVITY_PAGE_SIZE = 10

// スケジュールが削除済みの場合に fallback テキストを返す
// activity.title には件名が格納済みのため通常は null にならないが、パース失敗時のフォールバック用
export function getScheduleDisplayName(scheduleName: string | null): string {
  return scheduleName ?? '（削除済み）'
}

// 更新日時を HH:mm 形式にフォーマットする（モックアップ準拠）
export function formatActivityDate(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${min}`
}
