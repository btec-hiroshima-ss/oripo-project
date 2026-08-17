'use client'

import { useState, useEffect, useMemo } from 'react'
import type { ScheduleUser, ScheduleGroup } from '@/lib/schedule.types'
import { getScheduleUsersAction, getGroupListAction, getGroupMembersAction } from '../../actions'
import TwoColumnPickerModal from './TwoColumnPickerModal'

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
  // 左パネル（参加ユーザーリスト）でハイライト中のユーザー ID
  const [leftHighlighted, setLeftHighlighted] = useState<Set<number>>(new Set())
  // 右パネル（候補ユーザー）でハイライト中のユーザー ID
  const [rightHighlighted, setRightHighlighted] = useState<Set<number>>(new Set())
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

  // 右パネルに表示する候補ユーザー（選択済みを除き、グループ/検索で絞り込む）
  const availableUsers = useMemo(() => {
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
    return base
  }, [allUsers, groupMembers, selectedGroupId, tempSelected, searchQuery])

  // 左パネルに表示する選択済みユーザー（allUsers から名前付きで生成）
  const selectedUsers = useMemo(() => {
    const userMap = new Map(allUsers.map((u) => [u.userId, u]))
    return Array.from(tempSelected)
      .map((id) => userMap.get(id))
      .filter((u): u is ScheduleUser => u !== undefined)
  }, [allUsers, tempSelected])

  // 右パネルのグループが未ロード中かどうか
  const isLoadingRightPanel = selectedGroupId !== null && !groupMembers.has(selectedGroupId)

  function toggleLeftHighlight(userId: number) {
    if (lockedIds.has(userId)) return
    setLeftHighlighted((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  function toggleRightHighlight(userId: number) {
    setRightHighlighted((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  function handleAdd() {
    setTempSelected((prev) => {
      const next = new Set(prev)
      rightHighlighted.forEach((id) => next.add(id))
      return next
    })
    setRightHighlighted(new Set())
  }

  function handleRemove() {
    setTempSelected((prev) => {
      const next = new Set(prev)
      leftHighlighted.forEach((id) => {
        if (!lockedIds.has(id)) next.delete(id)
      })
      return next
    })
    setLeftHighlighted(new Set())
  }

  function handleGroupChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedGroupId(e.target.value === '' ? null : Number(e.target.value))
    // グループ切替時はハイライトをリセット
    setRightHighlighted(new Set())
  }

  const allUsersMap = useMemo(() => new Map(allUsers.map((u) => [u.userId, u.fullName])), [allUsers])

  return (
    <TwoColumnPickerModal
      title="ユーザーを選択"
      onConfirm={() => onConfirm(tempSelected, allUsersMap)}
      onClose={onClose}
      renderLeftPanel={() => (
        <div className="flex flex-col flex-1 min-h-0 border-b sm:border-b-0 border-gray-200">
          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 shrink-0 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">参加ユーザーリスト</span>
            {/* 選択中人数: 左パネルヘッダーに表示（TwoColumnPickerModal 共通フッターに収まらないため移動） */}
            <span className="text-xs text-gray-400">{tempSelected.size} 人選択中</span>
          </div>
          {/* max-h-[140px] sm:max-h-none: モバイル（flex-col 縦積み）で左右パネルが画面を圧迫しないよう高さを制限する */}
          <ul className="flex-1 overflow-y-auto min-h-[100px] max-h-[140px] sm:max-h-none">
            {selectedUsers.length === 0 ? (
              <li className="text-center py-4 text-xs text-gray-400">未選択</li>
            ) : (
              selectedUsers.map((u) => {
                const locked = lockedIds.has(u.userId)
                const highlighted = leftHighlighted.has(u.userId)
                return (
                  <li key={u.userId}>
                    <button
                      type="button"
                      onClick={() => toggleLeftHighlight(u.userId)}
                      disabled={locked}
                      className={[
                        'w-full text-left px-3 py-2 text-xs border-b border-gray-50 flex items-center justify-between gap-1',
                        highlighted ? 'bg-brand text-white' : 'text-gray-800 hover:bg-gray-50',
                        locked ? 'cursor-default' : 'cursor-pointer',
                      ].join(' ')}
                    >
                      <span className="truncate">{u.fullName}</span>
                      {locked && <span className="text-xs shrink-0 opacity-70">（自分）</span>}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
          <div className="px-3 py-2 border-t border-gray-100 shrink-0">
            <button
              type="button"
              onClick={handleRemove}
              disabled={leftHighlighted.size === 0}
              className="w-full py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              削除
            </button>
          </div>
        </div>
      )}
      renderRightPanel={() => (
        <div className="flex flex-col flex-1 min-h-0">
          {/* 氏名フリーワード検索（16px以上: iOS Safari 自動ズーム防止） */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="氏名で検索..."
            className="shrink-0 mb-1 px-3 py-1.5 text-base sm:text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
          />
          {/* グループ絞り込み */}
          <div className="px-0 py-1 shrink-0">
            {isLoadingGroups ? (
              <span className="text-xs text-gray-400">読み込み中...</span>
            ) : (
              <select
                value={selectedGroupId ?? ''}
                onChange={handleGroupChange}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand bg-white"
              >
                <option value="">全グループ</option>
                {groups.map((g) => (
                  <option key={g.groupId} value={g.groupId}>{g.groupName}</option>
                ))}
              </select>
            )}
          </div>
          <ul className="flex-1 overflow-y-auto min-h-[100px] max-h-[140px] sm:max-h-none mt-1">
            {isLoadingUsers || isLoadingRightPanel ? (
              <li className="text-center py-4 text-xs text-gray-400">読み込み中...</li>
            ) : availableUsers.length === 0 ? (
              <li className="text-center py-4 text-xs text-gray-400">該当するユーザーがいません</li>
            ) : (
              availableUsers.map((u) => {
                const highlighted = rightHighlighted.has(u.userId)
                return (
                  <li key={u.userId}>
                    <button
                      type="button"
                      onClick={() => toggleRightHighlight(u.userId)}
                      className={[
                        'w-full text-left px-3 py-2 text-xs border-b border-gray-50 truncate',
                        highlighted ? 'bg-brand text-white' : 'text-gray-800 hover:bg-gray-50',
                      ].join(' ')}
                    >
                      {u.fullName}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
          <div className="px-0 py-2 border-t border-gray-100 shrink-0 mt-1">
            <button
              type="button"
              onClick={handleAdd}
              disabled={rightHighlighted.size === 0}
              className="w-full py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              追加
            </button>
          </div>
        </div>
      )}
    />
  )
}
