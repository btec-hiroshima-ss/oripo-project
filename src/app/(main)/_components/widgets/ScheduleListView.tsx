'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X } from 'lucide-react'
import type { MultiUserScheduleEntry } from '@/lib/schedule.types'
import { LIST_VIEW_PAGE_SIZE, USER_COLORS } from '@/lib/schedule.constants'
import { toJstDateStr, toJstTimeStr } from '@/lib/jst'
import { getListSchedulesAction } from '../../actions'

// schedule.constants の PUBLIC_FLAG_COLORS は "bg-xxx text-white" 形式（ブロック用）。
// カラーバーは背景色のみなので text-white を含まない専用定義が必要。
const FLAG_BAR_COLORS: Record<'O' | 'P' | 'C', string> = {
  O: 'bg-brand',
  P: 'bg-gray-400',
  C: 'bg-gray-600',
}

// キーワード入力後の検索ディレイ（ms）: 打鍵ごとにリクエストを飛ばさないためのデバウンス
const KEYWORD_DEBOUNCE_MS = 400

type Props = {
  viewUserIds: number[]
  userColorMap: Map<number, string>
  isMultiUser: boolean
  onScheduleClick: (schedule: MultiUserScheduleEntry) => void
  /** 追加/更新/削除後に親からインクリメントされ、先頭から再フェッチさせる */
  refreshKey?: number
}

export default function ScheduleListView({
  viewUserIds,
  userColorMap,
  isMultiUser,
  onScheduleClick,
  refreshKey,
}: Props) {
  const [schedules, setSchedules] = useState<MultiUserScheduleEntry[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  // AIPO準拠: キーワード部分一致フィルター（target_keyword）
  const [keyword, setKeyword] = useState('')
  // デバウンス後に実際の検索に使うキーワード
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const todayStr = toJstDateStr(new Date())

  function handleKeywordChange(value: string) {
    setKeyword(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedKeyword(value.trim()), KEYWORD_DEBOUNCE_MS)
  }

  const fetchList = useCallback(async (nextOffset: number) => {
    if (viewUserIds.length === 0) return
    setIsLoading(true)
    try {
      const items = await getListSchedulesAction(todayStr, viewUserIds, LIST_VIEW_PAGE_SIZE + 1, nextOffset, debouncedKeyword || undefined)
      // 1件余分に取得して hasMore を判定する
      const hasNextPage = items.length > LIST_VIEW_PAGE_SIZE
      const actual = items.slice(0, LIST_VIEW_PAGE_SIZE)
      setSchedules((prev) => nextOffset === 0 ? actual : [...prev, ...actual])
      setOffset(nextOffset + actual.length)
      setHasMore(hasNextPage)
    } catch {
      // ネットワークエラー等は無視
    } finally {
      setIsLoading(false)
    }
  // todayStr はマウント時の今日で固定（一覧ビュー期間中に日付が変わっても再計算しない）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewUserIds, debouncedKeyword])

  // viewUserIds・debouncedKeyword が変わった場合または追加/更新/削除後に先頭から再取得する
  useEffect(() => {
    setSchedules([])
    setOffset(0)
    fetchList(0)
  }, [fetchList, refreshKey])

  /** YYYY-MM-DD → "YYYY/MM/DD" */
  function formatDate(dateStr: string): string {
    return dateStr.replace(/-/g, '/')
  }

  function formatRow(s: MultiUserScheduleEntry): string {
    const dateStr = toJstDateStr(s.startDate)
    const date = formatDate(dateStr)
    if (s.isAllDay) {
      return `${date}　終日`
    }
    return `${date} ${toJstTimeStr(s.startDate)}〜${toJstTimeStr(s.endDate)}`
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* キーワード検索入力欄（AIPO: target_keyword による部分一致フィルター） */}
      <div className="px-3 py-2 border-b border-gray-100 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => handleKeywordChange(e.target.value)}
            placeholder="キーワードで絞り込み"
            className="w-full pl-8 pr-7 py-1.5 text-base border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand text-sm"
          />
          {keyword && (
            <button
              type="button"
              onClick={() => { setKeyword(''); setDebouncedKeyword('') }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="クリア"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 一覧テーブル */}
      <div className="overflow-auto flex-1">
      {schedules.length === 0 && !isLoading ? (
        <p className="text-sm text-gray-400 py-8 text-center">
          {debouncedKeyword ? '該当する予定がありません' : '本日以降の予定がありません'}
        </p>
      ) : (
        <table className="w-full min-w-[320px] text-sm">
          <tbody>
            {schedules.map((s, idx) => {
              // 色: マルチユーザーはユーザー色、単独は公開区分色
              const barColor = isMultiUser
                ? (userColorMap.get(s.viewUserId) ?? USER_COLORS[0]).replace('text-white', '').trim()
                : FLAG_BAR_COLORS[s.publicFlag as 'O' | 'P' | 'C']
              return (
                <tr
                  key={`${s.scheduleId}-${s.viewUserId}-${idx}`}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => onScheduleClick(s)}
                >
                  {/* 左端のカラーバー */}
                  <td className="w-1 pr-0">
                    <div className={`w-1 h-full min-h-[40px] rounded-r ${barColor}`} />
                  </td>
                  {/* 日時 */}
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 w-44 shrink-0">
                    {formatRow(s)}
                  </td>
                  {/* タイトル・場所 */}
                  <td className="px-2 py-2 min-w-0">
                    <div className="font-medium text-gray-800 truncate">{s.name}</div>
                    {s.place && (
                      <div className="text-xs text-gray-400 truncate mt-0.5">{s.place}</div>
                    )}
                  </td>
                  {/* マルチユーザー: ユーザー名チップ */}
                  {isMultiUser && (
                    <td className="px-2 py-2 text-right">
                      <span
                        className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full ${
                          userColorMap.get(s.viewUserId) ?? USER_COLORS[0]
                        }`}
                      >
                        {s.viewUserName}
                      </span>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* ローディングインジケーター */}
      {isLoading && (
        <p className="text-xs text-gray-400 text-center py-4">読み込み中...</p>
      )}

      {/* もっと見るボタン */}
      {!isLoading && hasMore && (
        <div className="py-3 text-center">
          <button
            type="button"
            onClick={() => fetchList(offset)}
            className="px-4 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
          >
            もっと見る
          </button>
        </div>
      )}
      </div>
    </div>
  )
}
