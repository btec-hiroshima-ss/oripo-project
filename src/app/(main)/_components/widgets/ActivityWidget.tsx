'use client'

import { useState, useEffect, useCallback } from 'react'
import { getActivityAction } from '../../actions'
// activity.ts は db をインポートするため Client Component から直接 import できない
// 純粋関数のみ別ファイルに分離している（user-list.utils.ts と同じ理由）
import { getScheduleDisplayName, formatActivityDate } from '@/lib/activity.utils'
// アイコン色は user_id ベースで決定する（モックアップ準拠: 更新者ごとに固定色）
import { getIconColor } from '@/lib/user-list.utils'
import type { ActivityEntry } from '@/lib/activity.types'
import { ACTIVITY_PAGE_SIZE } from '@/lib/activity.utils'
import { Loading } from '../ui'

export default function ActivityWidget() {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  const fetchPage = useCallback((p: number) => {
    setIsLoading(true)
    getActivityAction(p)
      .then(({ entries: data, totalCount: total }) => {
        setEntries(data)
        setTotalCount(total)
        setPage(p)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  // マウント時に1ページ目を取得
  useEffect(() => {
    fetchPage(1)
  }, [fetchPage])

  const totalPages = Math.ceil(totalCount / ACTIVITY_PAGE_SIZE)
  // 表示範囲: 「1〜10 / 550」のような AIPO 準拠の表示
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * ACTIVITY_PAGE_SIZE + 1
  const rangeEnd = Math.min(page * ACTIVITY_PAGE_SIZE, totalCount)

  return (
    <div className="flex flex-col">
      {/* ページング: AIPO 準拠「1〜10 / 550 ◄ ►」 */}
      {totalCount > 0 && (
        <div className="flex items-center justify-end gap-1 px-3 py-1 text-xs text-gray-500 border-b border-gray-100">
          <span>
            {rangeStart} 〜 {rangeEnd} / {totalCount}
          </span>
          <button
            onClick={() => fetchPage(page - 1)}
            disabled={page <= 1 || isLoading}
            className="px-1 disabled:opacity-30 hover:text-brand"
            aria-label="前のページ"
          >
            ◄
          </button>
          <button
            onClick={() => fetchPage(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="px-1 disabled:opacity-30 hover:text-brand"
            aria-label="次のページ"
          >
            ►
          </button>
        </div>
      )}

      <div className="max-h-[360px] overflow-y-auto">
        {isLoading ? (
          <div className="p-4"><Loading variant="inline" /></div>
        ) : entries.length === 0 ? (
          <div className="p-4 text-sm text-gray-400">更新情報はありません</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <li key={entry.activityId} className="flex items-start gap-2.5 px-3 py-2">
                {/* 更新者イニシャルアイコン（user_id ベースの固定色、ユーザー名簿と同じロジック） */}
                <div
                  className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold ${getIconColor(entry.updaterUserId)}`}
                >
                  {entry.updaterInitial}
                </div>

                {/* エントリ本文 */}
                <div className="flex-1 min-w-0">
                  {/* 時刻 + 更新者名（モックアップ準拠: HH:mm 氏名） */}
                  <p className="text-xs text-gray-500">
                    {formatActivityDate(entry.updateDate)}
                    {'　'}
                    {entry.updaterName}
                  </p>
                  {/* アクションテキスト（追加/編集を赤で強調、モックアップ準拠） */}
                  <p className="text-sm text-gray-800 leading-snug mt-0.5">
                    {'予定「'}
                    <span className="font-medium">{getScheduleDisplayName(entry.scheduleName)}</span>
                    {'」を'}
                    <span className="text-brand font-semibold">
                      {entry.isNew ? '追加' : '編集'}
                    </span>
                    {'しました。'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
