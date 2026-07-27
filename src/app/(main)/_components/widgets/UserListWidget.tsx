'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { getUserListAction, getUserDetailAction } from '../../actions'
// filterUsers のみインポート: user-list.ts 経由だと db→pg→fs がクライアントバンドルに混入する
import { filterUsers } from '@/lib/user-list.utils'
import type { UserListUser, UserListDetail } from '@/lib/user-list.types'
import InitialAvatar from '../InitialAvatar'
import UserDetailModal from './UserDetailModal'

// isMobileView=true の場合、max-h の固定値を外して親コンテナの高さいっぱいに伸ばす
export default function UserListWidget({ isMobileView }: { isMobileView?: boolean }) {
  const [users, setUsers] = useState<UserListUser[]>([])
  const [keyword, setKeyword] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<UserListDetail | null>(null)

  // コンポーネントマウント時に1回だけ取得。ユーザー名簿は頻繁に変わらないためキャッシュなし。
  useEffect(() => {
    getUserListAction()
      .then((data) => setUsers(data))
      .catch(() => {}) // エラー時もローディングを終了させる（一覧は空のまま）
      .finally(() => setIsLoading(false))
  }, [])

  async function handleUserClick(userId: number) {
    const detail = await getUserDetailAction(userId)
    if (detail) setSelectedUser(detail)
  }

  const filtered = filterUsers(users, keyword)

  return (
    <>
      <div className={`flex flex-col${isMobileView ? ' flex-1' : ' max-h-[400px]'}`}>
        {/* 検索ボックス */}
        <div className="px-3 py-2 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              name="user-search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="名前で検索"
              // 16px 以上にする: iOS Safari はフォントサイズ 16px 未満の input でページをズームする
              className="w-full pl-7 pr-2 py-1 text-base sm:text-sm bg-gray-50 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
              aria-label="ユーザーを名前で検索"
            />
          </div>
        </div>

        {/* ユーザーリスト */}
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <p className="text-sm text-gray-400 text-center py-4">読み込み中...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              {keyword ? '該当するユーザーがいません' : 'ユーザーがいません'}
            </p>
          ) : (
            <ul>
              {filtered.map((user) => (
                <UserRow key={user.userId} user={user} onClick={handleUserClick} />
              ))}
            </ul>
          )}
        </div>
      </div>

      {selectedUser && (
        <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </>
  )
}

type UserRowProps = {
  user: UserListUser
  onClick: (userId: number) => void
}

function UserRow({ user, onClick }: UserRowProps) {
  return (
    <li
      className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => onClick(user.userId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick(user.userId)}
    >
      <InitialAvatar userId={user.userId} name={user.fullName} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{user.fullName}</p>
        {user.department && (
          <p className="text-xs text-gray-500 truncate">{user.department}</p>
        )}
        {user.cellularPhone && (
          <p className="text-xs text-gray-400 truncate">{user.cellularPhone}</p>
        )}
      </div>
    </li>
  )
}
