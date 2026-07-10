'use client'

import { useState } from 'react'
import { LayoutGrid, X } from 'lucide-react'

type Props = {
  onClose: () => void
  onAdd: (pageName: string) => void
}

export default function AddPageModal({ onClose, onAdd }: Props) {
  const [name, setName] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-brand rounded flex items-center justify-center">
              <LayoutGrid className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-gray-800">ページ追加</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded p-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="px-5 py-4">
          <label className="block mb-3">
            <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
              ページ名
              <span className="text-xs text-white bg-brand rounded px-1 py-0.5 leading-none">必須</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="営業ページ"
              className="w-full border border-brand rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand/30"
              autoFocus
            />
          </label>

          <div className="flex justify-between items-center mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              閉じる
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-sm text-white bg-brand rounded-lg hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              追加する
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
