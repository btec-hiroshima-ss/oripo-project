import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchHolidays } from './holidays'

// Next.js の fetch 拡張（next: { revalidate }）はブラウザ・Vitest 環境では未定義のため
// グローバル fetch をスタブして API 呼び出し動作を検証する。

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchHolidays', () => {
  it('外部APIから祝日データを取得して返す', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ '2025-01-01': '元日', '2025-05-03': '憲法記念日' }),
    }))

    const result = await fetchHolidays()

    expect(result).toEqual({ '2025-01-01': '元日', '2025-05-03': '憲法記念日' })
    expect(fetch).toHaveBeenCalledWith(
      'https://holidays-jp.github.io/api/v1/date.json',
      expect.any(Object)
    )
  })

  it('APIがエラーステータスを返した場合は空オブジェクトを返す', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
    }))

    const result = await fetchHolidays()
    expect(result).toEqual({})
  })

  it('ネットワークエラーの場合は空オブジェクトを返す（祝日表示なしで継続）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')))

    const result = await fetchHolidays()
    expect(result).toEqual({})
  })
})
