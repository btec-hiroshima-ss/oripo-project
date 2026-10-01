'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X } from 'lucide-react'
import type { MultiUserScheduleEntry } from '@/lib/schedule.types'
import { LIST_VIEW_PAGE_SIZE } from '@/lib/schedule.constants'
import { toJstDateStr, toJstTimeStr, toJstDateJa, makeDateJst } from '@/lib/jst'
import { addDaysToDateStr, describeRepeat, isRepeatPattern } from '@/lib/repeat'
import { getListSchedulesAction, searchSchedulesAction } from '../../actions'

// schedule.constants の PUBLIC_FLAG_COLORS は "bg-brand text-white" 形式（背景＋文字色）で
// テキストを持たないカラーバー div には合わないため、カラーバー専用クラスを別定義する。
const FLAG_BAR_COLORS: Record<'O' | 'P' | 'C', string> = {
  O: 'bg-brand',
  P: 'bg-gray-400',
  C: 'bg-gray-600',
}

// キーワード入力後の検索ディレイ（ms）: 打鍵ごとにリクエストを飛ばさないためのデバウンス
const KEYWORD_DEBOUNCE_MS = 400

// 一覧モードの日付ナビゲーション（AIPO ScheduleListSelectData の prevWeek / prevDate / nextDate / nextWeek 準拠）
const LIST_NAV_BUTTONS: { label: string; days: number }[] = [
  { label: '前週', days: -7 },
  { label: '前日', days: -1 },
  { label: '翌日', days: 1 },
  { label: '翌週', days: 7 },
]

type Props = {
  viewUserIds: number[]
  onScheduleClick: (schedule: MultiUserScheduleEntry) => void
  /** 追加/更新/削除後に親からインクリメントされ、再フェッチさせる */
  refreshKey?: number
}

/**
 * 一覧ビュー（Phase F / #211）。AIPO では「一覧」と「キーワード検索」が別画面のため、キーワードの有無で切り替える。
 * - 一覧モード（キーワードなし）: 表示開始日から 7 日間を日付ごとに表示。繰り返しは出現ごとに表示する
 * - 検索モード（キーワードあり）: 日付で区切らず開始日時の降順で 30 件ずつ。繰り返しは親 1 件として表示する
 */
export default function ScheduleListView({
  viewUserIds,
  onScheduleClick,
  refreshKey,
}: Props) {
  const [schedules, setSchedules] = useState<MultiUserScheduleEntry[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  // 一覧モードの表示開始日（JST "YYYY-MM-DD"）。初期値は今日
  const [viewStart, setViewStart] = useState(() => toJstDateStr(new Date()))
  // AIPO準拠: キーワード部分一致検索（target_keyword）
  const [keyword, setKeyword] = useState('')
  // デバウンス後に実際の検索に使うキーワード。空文字なら一覧モード
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 最新のリクエスト番号。前日/翌日の連打やキーワードのクリア直後に、先に出した古いリクエストの応答が
  // 後から返って新しい表示を上書きしないよう、最新以外の応答は捨てる
  const requestIdRef = useRef(0)

  const isSearchMode = debouncedKeyword !== ''

  function handleKeywordChange(value: string) {
    setKeyword(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedKeyword(value.trim()), KEYWORD_DEBOUNCE_MS)
  }

  const fetchList = useCallback(async (nextOffset: number) => {
    if (viewUserIds.length === 0) return
    const requestId = ++requestIdRef.current
    setIsLoading(true)
    try {
      if (debouncedKeyword === '') {
        const items = await getListSchedulesAction(viewStart, viewUserIds)
        if (requestId !== requestIdRef.current) return
        setSchedules(items)
        setHasMore(false)
        return
      }
      const items = await searchSchedulesAction(viewUserIds, debouncedKeyword, LIST_VIEW_PAGE_SIZE + 1, nextOffset)
      if (requestId !== requestIdRef.current) return
      // 1件余分に取得して hasMore を判定する
      const hasNextPage = items.length > LIST_VIEW_PAGE_SIZE
      const actual = items.slice(0, LIST_VIEW_PAGE_SIZE)
      setSchedules((prev) => nextOffset === 0 ? actual : [...prev, ...actual])
      setOffset(nextOffset + actual.length)
      setHasMore(hasNextPage)
    } catch {
      // ネットワークエラー等は無視
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false)
    }
  }, [viewUserIds, debouncedKeyword, viewStart])

  // 表示ユーザー・キーワード・表示開始日が変わった場合、または追加/更新/削除後に先頭から再取得する
  useEffect(() => {
    setSchedules([])
    setOffset(0)
    fetchList(0)
  }, [fetchList, refreshKey])

  // 一覧モードの日付見出しは予定のある日だけ出す（AIPO schedule-search-list.vm の isDayStart 準拠）。
  // 表示開始日より前から続く期間予定は、表示開始日の見出しの下に表示する
  const groupedByDate: [string, MultiUserScheduleEntry[]][] = []
  if (!isSearchMode) {
    const map = new Map<string, MultiUserScheduleEntry[]>()
    for (const s of schedules) {
      const startDay = toJstDateStr(s.startDate)
      const day = startDay < viewStart ? viewStart : startDay
      map.set(day, [...(map.get(day) ?? []), s])
    }
    groupedByDate.push(...[...map.entries()].sort(([a], [b]) => a.localeCompare(b)))
  }

  // 行の日時欄。検索モードは日付付き、繰り返しの親は繰り返しの内容を表示する
  function formatRow(s: MultiUserScheduleEntry): string {
    if (isRepeatPattern(s.repeatPattern) && s.occurrenceDate === null) {
      return describeRepeat(s.repeatPattern, s.startDate, s.endDate)
    }
    const datePart = isSearchMode ? `${toJstDateStr(s.startDate).replace(/-/g, '/')} ` : ''
    if (s.isAllDay) return `${datePart}終日`
    return `${datePart}${toJstTimeStr(s.startDate)}〜${toJstTimeStr(s.endDate)}`
  }

  function renderRows(rows: MultiUserScheduleEntry[]) {
    return rows.map((s, idx) => {
      const barColor = FLAG_BAR_COLORS[s.publicFlag as 'O' | 'P' | 'C']
      return (
        <tr
          // 繰り返しの出現は scheduleId（= 親 ID）が共通のため occurrenceDate も含めて区別する
          key={`${s.scheduleId}-${s.occurrenceDate ?? ''}-${s.viewUserId}-${idx}`}
          className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
          onClick={() => onScheduleClick(s)}
        >
          {/* 左端のカラーバー（公開区分で色分け） */}
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
        </tr>
      )
    })
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* キーワード検索入力欄（AIPO: target_keyword による部分一致検索） */}
      <div className="px-3 py-2 border-b border-gray-100 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => handleKeywordChange(e.target.value)}
            placeholder="キーワードで検索"
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

      {/* 一覧モードの日付ナビゲーション: 表示開始日と今日・前週・前日・翌日・翌週（検索モードでは日付で区切らないため非表示） */}
      {!isSearchMode && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-100 shrink-0 flex-wrap">
          <span className="text-xs font-medium text-gray-700 mr-1">{toJstDateJa(makeDateJst(viewStart))}</span>
          <button
            type="button"
            onClick={() => setViewStart(toJstDateStr(new Date()))}
            className="px-2 py-0.5 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
          >
            今日
          </button>
          {LIST_NAV_BUTTONS.map(({ label, days }) => (
            <button
              key={label}
              type="button"
              onClick={() => setViewStart((d) => addDaysToDateStr(d, days))}
              className="px-2 py-0.5 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* 一覧テーブル */}
      <div className="overflow-auto flex-1">
      {schedules.length === 0 && !isLoading ? (
        <p className="text-sm text-gray-400 py-8 text-center">
          {isSearchMode ? '該当する予定がありません' : '予定はありません'}
        </p>
      ) : isSearchMode ? (
        <table className="w-full min-w-[320px] text-sm">
          <tbody>{renderRows(schedules)}</tbody>
        </table>
      ) : (
        <table className="w-full min-w-[320px] text-sm">
          {groupedByDate.map(([day, rows]) => (
            <tbody key={day}>
              {/* 日付見出し（予定のある日だけ） */}
              <tr className="bg-gray-50 border-b border-gray-100">
                <td colSpan={3} className="px-3 py-1 text-xs font-medium text-gray-600">
                  {toJstDateJa(makeDateJst(day))}
                </td>
              </tr>
              {renderRows(rows)}
            </tbody>
          ))}
        </table>
      )}

      {/* ローディングインジケーター */}
      {isLoading && (
        <p className="text-xs text-gray-400 text-center py-4">読み込み中...</p>
      )}

      {/* もっと見るボタン（検索モードのみ） */}
      {!isLoading && isSearchMode && hasMore && (
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
