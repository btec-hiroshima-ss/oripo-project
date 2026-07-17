// クライアントコンポーネントから安全にインポートできる純粋関数のみ置く（DB依存なし）

// AIPO の portlet_type 定数（WhatsNewUtils.java 準拠）
// 将来的に他機能の更新情報を追加する際にここに追記する
const APP_LABELS: Record<number, string> = {
  1: 'ブログ',
  2: 'ブログコメント',
  3: 'ワークフロー',
  4: '掲示板',
  5: 'メモ',
  6: 'スケジュール',
}

export function getAppLabel(portletType: number): string {
  return APP_LABELS[portletType] ?? '更新情報'
}

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
