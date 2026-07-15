'use client'

import { X, User } from 'lucide-react'
import type { UserListDetail } from '@/lib/user-list.types'
// user-list.utils のみインポート: Client Component から db を引き込まないため
import { getIconColor } from '@/lib/user-list.utils'

type Props = {
  user: UserListDetail
  onClose: () => void
}

export default function UserDetailModal({ user, onClose }: Props) {
  const initial = user.fullName.charAt(0)
  const colorClass = getIconColor(user.userId)

  return (
    // オーバーレイクリックで閉じる（AddPageModal と同パターン）
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm"
        // コンテンツエリアはクリックが伝播しないようにする
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-brand rounded flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-gray-800">ユーザー詳細</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded p-0.5"
            aria-label="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ユーザー情報 */}
        <div className="px-5 py-4">
          {/* アバター + 氏名 */}
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`${colorClass} w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-white text-xl font-bold`}
              aria-hidden="true"
            >
              {initial}
            </span>
            <div>
              <p className="text-base font-semibold text-gray-800">{user.fullName}</p>
              <p className="text-xs text-gray-500">{user.fullNameKana}</p>
            </div>
          </div>

          {/* 詳細フィールド: 要件定義書 2.5 準拠。空でも常に行を表示する。 */}
          <dl className="space-y-2">
            <DetailRow label="部署" value={user.departments.join(' / ')} />
            <DetailRow label="携帯" value={user.cellularPhone ?? ''} />
          </dl>
        </div>

        {/* フッター */}
        <div className="px-5 pb-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <dt className="w-14 shrink-0 text-gray-500">{label}</dt>
      <dd className="text-gray-800 break-all">{value}</dd>
    </div>
  )
}
