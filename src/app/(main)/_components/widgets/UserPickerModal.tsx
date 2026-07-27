'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Search, ChevronDown, ChevronRight } from 'lucide-react'
import type { ScheduleUser, ScheduleGroup } from '@/lib/schedule.types'
import { getScheduleUsersAction, getGroupListAction, getGroupMembersAction } from '../../actions'

type Props = {
  /** 確定済み選択ユーザー ID セット（モーダルを開くたびに渡す） */
  selectedIds: Set<number>
  /** 選択を解除できないユーザー ID（マルチビュー用途では自分自身、フォーム用途では空） */
  lockedIds?: Set<number>
  /** 「決定」押下時に新しい選択 ID セットと氏名マップを返す。names は任意（フォーム用途では不要） */
  onConfirm: (ids: Set<number>, names?: Map<number, string>) => void
  onClose: () => void
}

type GroupWithState = ScheduleGroup & {
  isOpen: boolean
  members: ScheduleUser[] | null  // null = 未取得
}

export default function UserPickerModal({ selectedIds, lockedIds = new Set(), onConfirm, onClose }: Props) {
  const [allUsers, setAllUsers] = useState<ScheduleUser[]>([])
  const [groups, setGroups] = useState<GroupWithState[]>([])
  // モーダル内での一時的な選択状態（「決定」で確定するまで親に反映しない）
  const [tempSelected, setTempSelected] = useState<Set<number>>(new Set(selectedIds))
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'search' | 'group'>('search')
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [isLoadingGroups, setIsLoadingGroups] = useState(true)

  useEffect(() => {
    getScheduleUsersAction()
      .then(setAllUsers)
      .finally(() => setIsLoadingUsers(false))
    getGroupListAction()
      .then((gs) => setGroups(gs.map((g) => ({ ...g, isOpen: false, members: null }))))
      .finally(() => setIsLoadingGroups(false))
  }, [])

  // 検索語で絞り込んだユーザーリスト
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return allUsers
    const q = searchQuery.trim().toLowerCase()
    return allUsers.filter((u) => u.fullName.toLowerCase().includes(q))
  }, [allUsers, searchQuery])

  function toggle(userId: number) {
    if (lockedIds.has(userId)) return
    setTempSelected((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  async function handleGroupToggle(groupId: number) {
    const group = groups.find((g) => g.groupId === groupId)
    if (!group) return

    if (group.isOpen) {
      // 閉じる
      setGroups((prev) => prev.map((g) => g.groupId === groupId ? { ...g, isOpen: false } : g))
      return
    }

    // 開く（未取得なら取得する）
    if (group.members === null) {
      const members = await getGroupMembersAction(groupId)
      setGroups((prev) =>
        prev.map((g) => g.groupId === groupId ? { ...g, isOpen: true, members } : g)
      )
    } else {
      setGroups((prev) => prev.map((g) => g.groupId === groupId ? { ...g, isOpen: true } : g))
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <span className="font-semibold text-gray-800 text-sm">ユーザーを選択</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-0.5" aria-label="閉じる">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* タブ */}
        <div className="flex border-b border-gray-100 shrink-0">
          <button
            className={`flex-1 py-2 text-xs font-medium ${activeTab === 'search' ? 'text-brand border-b-2 border-brand' : 'text-gray-500'}`}
            onClick={() => setActiveTab('search')}
          >
            氏名検索
          </button>
          <button
            className={`flex-1 py-2 text-xs font-medium ${activeTab === 'group' ? 'text-brand border-b-2 border-brand' : 'text-gray-500'}`}
            onClick={() => setActiveTab('group')}
          >
            グループ
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'search' && (
            <div>
              {/* 検索ボックス */}
              <div className="px-3 py-2 border-b border-gray-100 sticky top-0 bg-white">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="氏名で検索..."
                    // 16px 以上: iOS Safari の自動ズームを防ぐ
                    className="w-full pl-8 pr-3 py-1.5 text-base sm:text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
              {isLoadingUsers ? (
                <div className="text-center py-6 text-xs text-gray-400">読み込み中...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400">該当するユーザーがいません</div>
              ) : (
                <ul>
                  {filteredUsers.map((u) => (
                    <UserRow
                      key={u.userId}
                      user={u}
                      checked={tempSelected.has(u.userId)}
                      locked={lockedIds.has(u.userId)}
                      onToggle={() => toggle(u.userId)}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'group' && (
            <div>
              {isLoadingGroups ? (
                <div className="text-center py-6 text-xs text-gray-400">読み込み中...</div>
              ) : groups.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400">グループがありません</div>
              ) : (
                <ul>
                  {groups.map((g) => (
                    <li key={g.groupId}>
                      {/* グループ行（展開トグル） */}
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-50"
                        onClick={() => handleGroupToggle(g.groupId)}
                      >
                        {g.isOpen
                          ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        }
                        <span className="truncate">{g.groupName}</span>
                      </button>
                      {/* メンバー一覧（展開時） */}
                      {g.isOpen && g.members !== null && (
                        <ul className="bg-gray-50">
                          {g.members.length === 0 ? (
                            <li className="px-8 py-2 text-xs text-gray-400">メンバーなし</li>
                          ) : (
                            g.members.map((u) => (
                              <UserRow
                                key={u.userId}
                                user={u}
                                checked={tempSelected.has(u.userId)}
                                locked={lockedIds.has(u.userId)}
                                onToggle={() => toggle(u.userId)}
                                indent
                              />
                            ))
                          )}
                        </ul>
                      )}
                      {g.isOpen && g.members === null && (
                        <div className="px-8 py-2 text-xs text-gray-400">読み込み中...</div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* 選択件数 + 決定ボタン */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-2 shrink-0">
          <span className="text-xs text-gray-500">
            {tempSelected.size} 人選択中
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={() => onConfirm(tempSelected, new Map(allUsers.map((u) => [u.userId, u.fullName])))}

              className="px-3 py-1.5 text-xs font-medium text-white bg-brand rounded-lg hover:bg-brand-dark"
            >
              決定
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

type UserRowProps = {
  user: ScheduleUser
  checked: boolean
  locked: boolean
  onToggle: () => void
  indent?: boolean
}

function UserRow({ user, checked, locked, onToggle, indent }: UserRowProps) {
  return (
    <li>
      <label
        className={`flex items-center gap-3 px-4 py-2 ${indent ? 'pl-8' : ''} cursor-pointer hover:bg-gray-50 border-b border-gray-50 ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={locked}
          onChange={onToggle}
          className="w-4 h-4 accent-brand shrink-0"
        />
        <span className="text-sm text-gray-800 truncate">{user.fullName}</span>
        {locked && <span className="text-xs text-gray-400 ml-auto shrink-0">（自分）</span>}
      </label>
    </li>
  )
}
