// holidays-jp: 内閣府告示の祝日データを JSON 形式で提供する GitHub Pages ホスト API。
// 無料・認証不要。年次更新後は翌日から反映される。
const HOLIDAYS_API_URL = 'https://holidays-jp.github.io/api/v1/date.json'

/**
 * 日本の国民の祝日データを外部APIから取得する。
 * Next.js の fetch キャッシュにより24時間再取得を抑制する。
 * API: https://holidays-jp.github.io/api/v1/date.json
 * 取得失敗時は空オブジェクトを返す（祝日表示なし）。
 */
export async function fetchHolidays(): Promise<Record<string, string>> {
  try {
    const res = await fetch(HOLIDAYS_API_URL, {
      next: { revalidate: 86400 }, // 24時間キャッシュ
    })
    if (!res.ok) return {}
    return res.json()
  } catch {
    return {}
  }
}
