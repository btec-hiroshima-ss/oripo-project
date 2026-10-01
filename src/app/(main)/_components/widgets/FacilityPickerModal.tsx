'use client'

import { useState, useEffect, useMemo } from 'react'
import type { FacilityWithGroup } from '@/lib/schedule.types'
import { getFacilityAvailabilityAction } from '../../actions'
import TwoColumnPickerModal, { type PickerItem } from './TwoColumnPickerModal'

type Props = {
  /** 設備一覧（ScheduleFormModal がマウント時に取得済みのものを渡す） */
  facilities: FacilityWithGroup[]
  /** 現在選択済みの設備 ID セット */
  selectedIds: Set<number>
  /** 空き確認に使う予定開始時刻。未指定の場合は空き判定しない */
  startDate?: Date
  /** 空き確認に使う予定終了時刻。未指定の場合は空き判定しない */
  endDate?: Date
  /** 編集中のスケジュール ID。自身の設備予約を「使用中」と誤判定しないために除外する。繰り返しの場合は親 ID */
  scheduleId?: number
  /** 繰り返しの「この予定のみ変更」の場合の出現日（JST "YYYY-MM-DD"）。その日の出現だけを除外する */
  excludeDate?: string
  /** 作成・変更しようとしている予定が繰り返しの場合の繰り返し設定。全出現について空きを確認する */
  repeat?: { pattern: string; limitStartDate: Date; limitEndDate: Date | null }
  onConfirm: (ids: Set<number>) => void
  onClose: () => void
}

export default function FacilityPickerModal({
  facilities,
  selectedIds,
  startDate,
  endDate,
  scheduleId,
  excludeDate,
  repeat,
  onConfirm,
  onClose,
}: Props) {
  // 使用中の設備 ID セット（空き確認結果）
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set())
  // 作業用の選択済みセット（決定ボタンで確定するまで親に反映しない）
  const [localSelected, setLocalSelected] = useState<Set<number>>(new Set(selectedIds))
  const [selectedGroup, setSelectedGroup] = useState('')

  // 空き状況だけを取得する（設備一覧は親から受け取るため二重取得しない）
  useEffect(() => {
    if (!startDate || !endDate) return
    getFacilityAvailabilityAction(
      startDate.toISOString(),
      endDate.toISOString(),
      scheduleId,
      excludeDate,
      // Server Action の引数は JSON で渡るため Date を ISO 文字列にする
      repeat
        ? {
            pattern: repeat.pattern,
            limitStartDate: repeat.limitStartDate.toISOString(),
            limitEndDate: repeat.limitEndDate ? repeat.limitEndDate.toISOString() : null,
          }
        : undefined,
    )
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

  const filterOptions = useMemo(() => [
    { value: '', label: 'すべての設備グループ' },
    ...groups.map((g) => ({ value: g, label: g })),
  ], [groups])

  // 左パネル: 選択済み設備
  const selectedItems = useMemo<PickerItem[]>(() => (
    facilities
      .filter((f) => localSelected.has(f.facilityId))
      .map((f) => ({ id: f.facilityId, label: f.facilityName }))
  ), [facilities, localSelected])

  // 右パネル: 候補設備（選択済みを除き、グループで絞り込む）
  const availableItems = useMemo<PickerItem[]>(() => (
    facilities
      .filter((f) => {
        if (localSelected.has(f.facilityId)) return false
        if (selectedGroup && (f.groupName ?? '未分類') !== selectedGroup) return false
        return true
      })
      .map((f) => {
        const isBusy = busyIds.has(f.facilityId)
        return {
          id: f.facilityId,
          label: f.facilityName,
          // 使用中バッジ: 空き確認が有効な場合のみ付与（要件定義書: 空いていない時間帯は選択不可）
          badge: isBusy && startDate && endDate ? '使用中' : undefined,
          disabled: isBusy,
        }
      })
  ), [facilities, localSelected, selectedGroup, busyIds, startDate, endDate])

  return (
    <TwoColumnPickerModal
      title="設備を選択"
      leftLabel="選択済み設備"
      selectedItems={selectedItems}
      availableItems={availableItems}
      selectionMode="immediate"
      // immediate モード: TwoColumnPickerModal は右パネルの「追加」クリック時に常に [id] の単要素配列を渡す
      onAdd={([id]) => setLocalSelected((prev) => new Set([...prev, id]))}
      onRemove={([id]) => setLocalSelected((prev) => { const next = new Set(prev); next.delete(id); return next })}
      filterOptions={filterOptions}
      filterValue={selectedGroup}
      onFilterChange={setSelectedGroup}
      onConfirm={() => onConfirm(localSelected)}
      onClose={onClose}
    />
  )
}
