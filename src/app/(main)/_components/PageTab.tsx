'use client'

import { useState, useRef } from 'react'
import { Settings, X } from 'lucide-react'
import type { Page } from '@/lib/pages.types'

type Props = {
  page: Page
  isActive: boolean
  showDelete: boolean
  onSelect: () => void
  onDelete: () => void
  onLayoutOpen: () => void
  onRename: (name: string) => void
}

// 1枚のページタブ。ダブルクリックでインライン編集できる。
// 編集 state はこのコンポーネント内で完結し、確定時に onRename を呼ぶ。
export default function PageTab({ page, isActive, showDelete, onSelect, onDelete, onLayoutOpen, onRename }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editingName, setEditingName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setIsEditing(true)
    setEditingName(page.pageName)
    // setState は非同期なので、フォーカスは次のレンダー後に当てる
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commitEdit() {
    const name = editingName.trim() || page.pageName
    setIsEditing(false)
    onRename(name)
  }

  return (
    <div
      className={`group relative flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium cursor-pointer transition-colors ${
        isActive ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
      }`}
      onClick={onSelect}
      onDoubleClick={startEdit}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          value={editingName}
          onChange={(e) => setEditingName(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit()
            if (e.key === 'Escape') setIsEditing(false)
          }}
          onClick={(e) => e.stopPropagation()}
          className="bg-transparent border-0 outline-none text-white text-sm font-medium w-20"
          autoFocus
        />
      ) : (
        <span>{page.pageName}</span>
      )}

      {/* アクティブタブのみ: ホバー時にレイアウト設定アイコンを表示 */}
      {isActive && (
        <button
          onClick={(e) => { e.stopPropagation(); onLayoutOpen() }}
          className="opacity-0 group-hover:opacity-100 text-white/70 hover:text-white rounded p-1"
          aria-label="レイアウト設定"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      )}

      {/* 複数ページ時のみ削除ボタンを表示 */}
      {showDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="text-white/50 hover:text-white rounded p-1 -mr-1"
          aria-label={`${page.pageName}を削除`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
