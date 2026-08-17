'use client'

import { useState, useEffect, useMemo } from 'react'
import type { ScheduleUser, ScheduleGroup } from '@/lib/schedule.types'
import { getScheduleUsersAction, getGroupListAction, getGroupMembersAction } from '../../actions'
import TwoColumnPickerModal, { type PickerItem } from './TwoColumnPickerModal'

type Props = {
  /** 確定済み選択ユーザー ID セット（モーダルを開くたびに渡す） */
  selectedIds: Set<number>
  /** 選択を解除できないユーザー ID（マルチビュー用途では自分自身、フォーム用途では空） */
  lockedIds?: Set<number>
  /** 「決定」押下時に新しい選択 ID セットと氏名マップを返す。names は任意（フォーム用途では不要） */
  onConfirm: (ids: Set<number>, names?: Map<number, string>) => void
  onClose: () => void
}

export default function UserPickerModal({ selectedIds, lockedIds = new Set(), onConfirm, onClose }: Props) {
  const [allUsers, setAllUsers] = useState<ScheduleUser[]>([])
  const [groups, setGroups] = useState<ScheduleGroup[]>([])
  // グループ別メンバーキャッシュ（groupId → メンバー一覧）
  const [groupMembers, setGroupMembers] = useState<Map<number, ScheduleUser[]>>(new Map())
  // モーダル内での一時的な選択状態（「決定」で確定するまで親に反映しない）
  const [tempSelected, setTempSelected] = useState<Set<number>>(new Set(selectedIds))
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [isLoadingGroups, setIsLoadingGroups] = useState(true)

  useEffect(() => {
    getScheduleUsersAction()
      .then(setAllUsers)
      .finally(() => setIsLoadingUsers(false))
    getGroupListAction()
      .then(setGroups)
      .finally(() => setIsLoadingGroups(false))
  }, [])

  // グループ選択時: メンバー未取得なら取得してキャッシュする
  // groupMembers を deps に含めることで、取得済みかどうかを最新の状態で判定する
  useEffect(() => {
    if (selectedGroupId === null || groupMembers.has(selectedGroupId)) return
    getGroupMembersAction(selectedGroupId)
      .then((members) => setGroupMembers((prev) => new Map(prev).set(selectedGroupId, members)))
  }, [selectedGroupId, groupMembers])

  // 右パネルのグループが未ロード中かどうか
  const isLoadingRightPanel = selectedGroupId !== null && !groupMembers.has(selectedGroupId)

  const filterOptions = useMemo(() => [
    { value: '', label: '全グループ' },
    ...groups.map((g) => ({ value: String(g.groupId), label: g.groupName })),
  ], [groups])

  // 左パネル: 選択済みユーザー
  const selectedItems = useMemo<PickerItem[]>(() => {
    const userMap = new Map(allUsers.map((u) => [u.userId, u]))
    return Array.from(tempSelected)
      .map((id) => userMap.get(id))
      .filter((u): u is ScheduleUser => u !== undefined)
      .map((u) => ({ id: u.userId, label: u.fullName, locked: lockedIds.has(u.userId) }))
  }, [allUsers, tempSelected, lockedIds])

  // 右パネル: 候補ユーザー（選択済みを除き、グループ/検索で絞り込む）
  const availableItems = useMemo<PickerItem[]>(() => {
    let base: ScheduleUser[]
    if (selectedGroupId !== null) {
      base = groupMembers.get(selectedGroupId) ?? []
    } else {
      base = allUsers
    }
    base = base.filter((u) => !tempSelected.has(u.userId))
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      base = base.filter((u) => u.fullName.toLowerCase().includes(q))
    }
    return base.map((u) => ({ id: u.userId, label: u.fullName }))
  }, [allUsers, groupMembers, selectedGroupId, tempSelected, searchQuery])

  const allUsersMap = useMemo(() => new Map(allUsers.map((u) => [u.userId, u.fullName])), [allUsers])

  return (
    <TwoColumnPickerModal
      title="ユーザーを選択"
      leftLabel="参加ユーザーリスト"
      selectedItems={selectedItems}
      availableItems={availableItems}
      selectionMode="highlight"
      onAdd={(ids) => setTempSelected((prev) => { const next = new Set(prev); ids.forEach((id) => next.add(id)); return next })}
      onRemove={(ids) => setTempSelected((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => { if (!lockedIds.has(id)) next.delete(id) })
        return next
      })}
      // 選択中人数: 左パネルヘッダーに表示（TwoColumnPickerModal 共通フッターに収まらないため）
      leftHeaderExtra={<span className="text-xs text-gray-400">{tempSelected.size} 人選択中</span>}
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="氏名で検索..."
      // グループロード中はセレクト非表示では状態が伝わらないため isLoading に含め右パネルスピナーで統一
      filterOptions={isLoadingGroups ? undefined : filterOptions}
      filterValue={selectedGroupId !== null ? String(selectedGroupId) : ''}
      onFilterChange={(v) => setSelectedGroupId(v === '' ? null : Number(v))}
      isLoading={isLoadingUsers || isLoadingGroups || isLoadingRightPanel}
      onConfirm={() => onConfirm(tempSelected, allUsersMap)}
      onClose={onClose}
    />
  )
}
