'use client'

import { LayoutGrid } from 'lucide-react'

// プレースホルダー。ページ（タブ）の追加・編集・削除・並び替えは #145 で実装予定
export default function PageSettingsPanel() {
  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <LayoutGrid className="w-4 h-4 text-brand" />
        <span className="font-semibold text-gray-800">ページ設定</span>
      </div>
      <div className="px-5 py-10 text-center text-gray-400 text-sm">準備中</div>
    </div>
  )
}
