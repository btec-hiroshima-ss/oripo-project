'use client'

import { useState, useEffect } from 'react'
import { getWhatsnewAction } from '../../actions'
// whatsnew.ts は db をインポートするため Client Component から直接 import できない
// 純粋関数のみ別ファイルに分離している（user-list.utils.ts と同じ理由）
import { getScheduleDisplayName, formatWhatsnewDate } from '@/lib/whatsnew.utils'
// アイコン色は user_id ベースで決定する（モックアップ準拠: 更新者ごとに固定色）
import { getIconColor } from '@/lib/user-list.utils'
import type { WhatsnewEntry } from '@/lib/whatsnew.types'

export default function WhatsnewWidget() {
  const [entries, setEntries] = useState<WhatsnewEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // マウント時に1回だけ取得
  useEffect(() => {
    getWhatsnewAction()
      .then((data) => setEntries(data))
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="flex flex-col max-h-[400px] overflow-y-auto">
      {isLoading ? (
        <div className="p-4 text-sm text-gray-400">読み込み中...</div>
      ) : entries.length === 0 ? (
        <div className="p-4 text-sm text-gray-400">更新情報はありません</div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {entries.map((entry) => (
            <li key={entry.whatsnewId} className="flex items-start gap-2.5 px-3 py-2">
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
                  {formatWhatsnewDate(entry.updateDate)}
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
  )
}
