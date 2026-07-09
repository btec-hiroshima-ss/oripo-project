'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { LogOut, Bell, Menu, X, Plus, Settings } from 'lucide-react'
import { logout } from '@/app/login/actions'
import type { Page, PageLayout } from '@/lib/pages.types'
import { addPageAction, deletePageAction, updatePageAction } from '../actions'
import AddPageModal from './AddPageModal'
import LayoutModal from './LayoutModal'

function OripoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1.5" fill="white" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" fill="white" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" fill="white" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" fill="white" />
    </svg>
  )
}

type Props = {
  loginName: string
  pages: Page[]
  activePage: Page
  onSelectPage: (page: Page) => void
  onPagesChange: (pages: Page[]) => void
}

export default function HomeHeader({ loginName, pages, activePage, onSelectPage, onPagesChange }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showLayoutModal, setShowLayoutModal] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleAddPage(pageName: string) {
    setShowAddModal(false)
    const newPage = await addPageAction(pageName)
    onPagesChange([...pages, newPage])
    onSelectPage(newPage)
    setShowLayoutModal(true)
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

  async function handleLayoutConfirm(layout: PageLayout) {
    setShowLayoutModal(false)
    await updatePageAction(activePage.pageId, { layout })
    onPagesChange(pages.map((p) => (p.pageId === activePage.pageId ? { ...p, layout } : p)))
  }

  return (
    <>
      <header className="bg-brand text-white h-11 flex items-center px-4 gap-0 shrink-0">
        {/* モバイル: ハンバーガー */}
        <button
          className="lg:hidden p-1 -ml-1 mr-2"
          onClick={() => setDrawerOpen(true)}
          aria-label="メニューを開く"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* ロゴ */}
        <Link href="/" className="flex items-center gap-1.5 shrink-0 mr-3">
          <OripoIcon />
          <span className="font-bold text-lg tracking-wide">Oripo</span>
        </Link>

        {/* デスクトップ: ページタブ + ナビ */}
        <nav className="hidden lg:flex items-center gap-0 flex-1 overflow-x-hidden">
          {pages.map((page) => {
            const isActive = page.pageId === activePage.pageId
            return (
              <div
                key={page.pageId}
                className={`group relative flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium cursor-pointer transition-colors ${
                  isActive ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
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
                    className="bg-transparent border-0 outline-none text-white text-sm font-medium w-20"
                    autoFocus
                  />
                ) : (
                  <span>{page.pageName}</span>
                )}

                {/* アクティブタブ: レイアウト設定 + 削除 */}
                {isActive && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowLayoutModal(true) }}
                    className="opacity-0 group-hover:opacity-100 text-white/70 hover:text-white rounded p-1"
                    aria-label="レイアウト設定"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* 削除ボタン（複数ページ時・常時表示） */}
                {pages.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeletePage(page) }}
                    className="text-white/50 hover:text-white rounded p-1 -mr-1"
                    aria-label={`${page.pageName}を削除`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}

          {/* ページ追加ボタン */}
          {pages.length < 10 && (
            <button
              onClick={() => setShowAddModal(true)}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
              aria-label="タブを追加"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          {/* 固定ナビ */}
          <Link
            href="/settings"
            className="px-3 py-1.5 rounded text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors ml-1"
          >
            個人設定
          </Link>
        </nav>

        {/* 右側: お知らせ・ユーザー名・ログアウト */}
        <div className="ml-auto flex items-center gap-3">
          <button aria-label="お知らせ">
            <Bell className="w-5 h-5" />
          </button>
          <span className="hidden lg:block text-sm">{loginName}</span>
          <form action={logout} className="hidden lg:block">
            <button
              type="submit"
              className="flex items-center gap-1.5 border border-white/50 rounded px-2.5 py-1 text-sm hover:bg-white/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              ログアウト
            </button>
          </form>
          {/* モバイル: アバター */}
          <div className="lg:hidden w-7 h-7 rounded-full bg-white/25 flex items-center justify-center text-xs font-bold">
            {loginName.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {/* モバイルドロワー オーバーレイ */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* モバイルドロワー */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-white z-50 shadow-xl lg:hidden transform transition-transform duration-200 ease-in-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="bg-brand text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center text-sm font-bold">
              {loginName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium">{loginName}</span>
          </div>
          <button onClick={() => setDrawerOpen(false)} aria-label="メニューを閉じる">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="p-2">
          {pages.map((page) => (
            <button
              key={page.pageId}
              onClick={() => { onSelectPage(page); setDrawerOpen(false) }}
              className={`w-full text-left px-4 py-3 text-sm rounded-lg ${
                activePage.pageId === page.pageId ? 'text-brand font-medium bg-orange-50' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {page.pageName}
            </button>
          ))}
          <hr className="my-2 border-gray-100" />
          <Link
            href="/settings"
            onClick={() => setDrawerOpen(false)}
            className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
          >
            個人設定
          </Link>
          <hr className="my-2 border-gray-100" />
          <form action={logout}>
            <button
              type="submit"
              className="w-full text-left flex items-center gap-2 px-4 py-3 text-sm text-gray-500 hover:bg-gray-50 rounded-lg"
            >
              <LogOut className="w-4 h-4" />
              ログアウト
            </button>
          </form>
        </nav>
      </div>

      {/* ページ追加モーダル */}
      {showAddModal && (
        <AddPageModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddPage}
        />
      )}

      {/* レイアウト設定モーダル */}
      {showLayoutModal && (
        <LayoutModal
          currentLayout={activePage.layout}
          onClose={() => setShowLayoutModal(false)}
          onConfirm={handleLayoutConfirm}
        />
      )}
    </>
  )
}
