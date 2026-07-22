'use client'

import { X } from 'lucide-react'

type Props = {
  onClose: () => void
}

// TODO: 個人設定画面（Issue #140 ユーザー情報）実装時に編集フォームを追加する。
// AIPO では自分のアバタークリック → このモーダルでプロフィール編集ができる。
export default function UserEditModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="font-semibold text-gray-800">ユーザー情報編集</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded p-0.5"
            aria-label="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-8 text-center text-gray-400 text-sm">
          実装予定（個人設定 #140）
        </div>
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
