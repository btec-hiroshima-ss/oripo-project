'use client'

import { useState, useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import type { FacilityWithGroup } from '@/lib/schedule.types'
import { getFacilityAvailabilityAction } from '../../actions'

type Props = {
  /** 設備一覧（ScheduleFormModal がマウント時に取得済みのものを渡す） */
  facilities: FacilityWithGroup[]
  /** 現在選択済みの設備 ID セット */
  selectedIds: Set<number>
  /** 空き確認に使う予定開始時刻。未指定の場合は空き判定しない */
  startDate?: Date
  /** 空き確認に使う予定終了時刻。未指定の場合は空き判定しない */
  endDate?: Date
  /** 編集中のスケジュール ID。自身の設備予約を「使用中」と誤判定しないために除外する */
  scheduleId?: number
  onConfirm: (ids: Set<number>) => void
  onClose: () => void
}

export default function FacilityPickerModal({
  facilities,
  selectedIds,
  startDate,
  endDate,
  scheduleId,
  onConfirm,
  onClose,
}: Props) {
  // 使用中の設備 ID セット（空き確認結果）
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set())
  // 作業用の選択済みセット（決定ボタンで確定するまで親に反映しない）
  const [localSelected, setLocalSelected] = useState<Set<number>>(new Set(selectedIds))
  const [selectedGroup, setSelectedGroup] = useState<string>('all')

  // 空き状況だけを取得する（設備一覧は親から受け取るため二重取得しない）
  useEffect(() => {
    if (!startDate || !endDate) return
    getFacilityAvailabilityAction(startDate.toISOString(), endDate.toISOString(), scheduleId)
      .then((bookedIds) => setBusyIds(new Set(bookedIds)))
      .catch(() => {})
  // ピッカーを開いた時点の日時で1回だけ取得する。
  // 開いている間に日時が変わった場合は閉じて再度開くことで最新の空き状況が反映される。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // グループ一覧（重複排除）
  const groups = useMemo(() => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const f of facilities) {
      const g = f.groupName ?? '未分類'
      if (!seen.has(g)) {
        seen.add(g)
        result.push(g)
      }
    }
    return result
  }, [facilities])

  // グループで絞り込んだ候補設備（選択済みを除く）
  const candidateFacilities = useMemo(() => {
    return facilities.filter((f) => {
      if (localSelected.has(f.facilityId)) return false
      if (selectedGroup !== 'all' && (f.groupName ?? '未分類') !== selectedGroup) return false
      return true
    })
  }, [facilities, localSelected, selectedGroup])

  // 選択済み設備の情報
  const selectedFacilities = useMemo(() => {
    return facilities.filter((f) => localSelected.has(f.facilityId))
  }, [facilities, localSelected])

  function handleAdd(facilityId: number) {
    // 使用中の設備は追加不可（要件定義書: 空いていない時間帯は選択不可）
    if (busyIds.has(facilityId)) return
    setLocalSelected((prev) => new Set([...prev, facilityId]))
  }

  function handleRemove(facilityId: number) {
    setLocalSelected((prev) => {
      const next = new Set(prev)
      next.delete(facilityId)
      return next
    })
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <span className="font-semibold text-gray-800">設備を選択</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded p-0.5"
            aria-label="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* デュアルリストボックス本体 */}
        <div className="flex flex-col sm:flex-row gap-4 px-5 py-4 overflow-hidden flex-1 min-h-0">
          {/* 左パネル: 選択済み設備 */}
          <div className="flex flex-col sm:flex-1 min-h-0">
            <p className="text-xs font-medium text-gray-600 mb-2 shrink-0">選択済み設備</p>
            <div className="border border-gray-200 rounded-lg overflow-y-auto flex-1 min-h-[120px]">
              {selectedFacilities.length === 0 ? (
                <p className="text-xs text-gray-400 p-3">設備が選択されていません</p>
              ) : (
                selectedFacilities.map((f) => (
                  <div
                    key={f.facilityId}
                    className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <span className="text-sm text-gray-800">{f.facilityName}</span>
                    <button
                      type="button"
                      onClick={() => handleRemove(f.facilityId)}
                      className="text-xs text-red-500 hover:text-red-700 ml-2 shrink-0"
                    >
                      削除
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 右パネル: 候補設備 */}
          <div className="flex flex-col sm:flex-1 min-h-0">
            {/* グループ絞り込み */}
            <div className="shrink-0 mb-2">
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="all">すべての設備グループ</option>
                {groups.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-y-auto flex-1 min-h-[120px]">
              {candidateFacilities.length === 0 ? (
                <p className="text-xs text-gray-400 p-3">候補設備がありません</p>
              ) : (
                candidateFacilities.map((f) => {
                  const isBusy = busyIds.has(f.facilityId)
                  return (
                    <div
                      key={f.facilityId}
                      className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-sm truncate ${isBusy ? 'text-gray-400' : 'text-gray-800'}`}>
                          {f.facilityName}
                        </span>
                        {/* 使用中バッジ: 空き確認が有効な場合のみ表示 */}
                        {isBusy && startDate && endDate && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded shrink-0">
                            使用中
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAdd(f.facilityId)}
                        disabled={isBusy}
                        className="text-xs text-brand hover:text-brand-dark ml-2 shrink-0 disabled:text-gray-300 disabled:cursor-not-allowed"
                      >
                        追加
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="px-5 pb-5 flex gap-2 justify-end shrink-0 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => onConfirm(localSelected)}
            className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-dark"
          >
            決定
          </button>
        </div>
      </div>
    </div>
  )
}
