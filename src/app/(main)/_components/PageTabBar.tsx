'use client'

import { useState, useRef } from 'react'
import { Plus, X, ChevronDown } from 'lucide-react'
import { LAYOUT_LABELS, type Page, type PageLayout } from '@/lib/pages'
import {
  addPageAction,
  deletePageAction,
  updatePageAction,
} from '../actions'

const LAYOUTS = Object.keys(LAYOUT_LABELS) as PageLayout[]

type Props = {
  pages: Page[]
  activePage: Page
  onSelectPage: (page: Page) => void
  onPagesChange: (pages: Page[]) => void
}

export default function PageTabBar({ pages, activePage, onSelectPage, onPagesChange }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showLayoutMenu, setShowLayoutMenu] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleAddPage() {
    const name = `ページ${pages.length + 1}`
    const newPage = await addPageAction(name)
    onPagesChange([...pages, newPage])
    onSelectPage(newPage)
  }

  async function handleDeletePage(page: Page) {
    if (!confirm(`「${page.pageName}」を削除しますか？\nウィジェットの設定も削除されます。`)) return
    await deletePageAction(page.pageId)
    const updated = pages.filter((p) => p.pageId !== page.pageId)
    onPagesChange(updated)
    if (activePage.pageId === page.pageId && updated.length > 0) {
      onSelectPage(updated[0])
    }
  }

  function startEdit(page: Page) {
    setEditingId(page.pageId)
    setEditingName(page.pageName)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  async function commitEdit() {
    if (editingId === null) return
    const name = editingName.trim() || pages.find((p) => p.pageId === editingId)?.pageName || ''
    await updatePageAction(editingId, { pageName: name })
    onPagesChange(pages.map((p) => (p.pageId === editingId ? { ...p, pageName: name } : p)))
    setEditingId(null)
  }

  async function handleLayoutChange(layout: PageLayout) {
    setShowLayoutMenu(false)
    await updatePageAction(activePage.pageId, { layout })
    onPagesChange(pages.map((p) => (p.pageId === activePage.pageId ? { ...p, layout } : p)))
  }

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="flex items-center gap-0 overflow-x-auto px-4">
        {pages.map((page) => {
          const isActive = page.pageId === activePage.pageId
          return (
            <div
              key={page.pageId}
              className={`group flex items-center gap-1 px-3 py-2.5 border-b-2 cursor-pointer shrink-0 ${
                isActive
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
              onClick={() => onSelectPage(page)}
              onDoubleClick={() => startEdit(page)}
            >
              {editingId === page.pageId ? (
                <input
                  ref={inputRef}
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-medium border-0 outline-none bg-transparent w-24"
                  autoFocus
                />
              ) : (
                <span className="text-sm font-medium">{page.pageName}</span>
              )}
              {pages.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeletePage(page) }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 -mr-1 rounded"
                  aria-label={`${page.pageName}を削除`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )
        })}

        {pages.length < 10 && (
          <button
            onClick={handleAddPage}
            className="flex items-center gap-1 px-3 py-2.5 text-gray-400 hover:text-gray-700 shrink-0"
            aria-label="タブを追加"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}

        <div className="ml-auto relative shrink-0">
          <button
            onClick={() => setShowLayoutMenu((v) => !v)}
            className="flex items-center gap-1 px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700"
          >
            レイアウト
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {showLayoutMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-36">
              {LAYOUTS.map((layout) => (
                <button
                  key={layout}
                  onClick={() => handleLayoutChange(layout)}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                    activePage.layout === layout ? 'text-brand font-medium' : 'text-gray-700'
                  }`}
                >
                  {LAYOUT_LABELS[layout]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
