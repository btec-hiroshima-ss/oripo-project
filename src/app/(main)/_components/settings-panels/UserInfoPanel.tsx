'use client'

import { User } from 'lucide-react'

// プレースホルダー。プロフィール表示・編集は #143 で実装予定
export default function UserInfoPanel() {
  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <User className="w-4 h-4 text-brand" />
        <span className="font-semibold text-gray-800">ユーザー情報</span>
      </div>
      <div className="px-5 py-10 text-center text-gray-400 text-sm">準備中</div>
    </div>
  )
}
