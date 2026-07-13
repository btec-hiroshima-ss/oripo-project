'use client'

import { useState } from 'react'
import { LogOut, Bell, Menu, Plus, LayoutGrid } from 'lucide-react'
import Link from 'next/link'
import { logout } from '@/app/login/actions'
import type { Page, PageLayout } from '@/lib/pages.types'
import { addPageAction, deletePageAction, updatePageAction } from '../actions'
import AddPageModal from './AddPageModal'
import LayoutModal from './LayoutModal'
import PageTab from './PageTab'
import MobileDrawer from './MobileDrawer'

type Props = {
  loginName: string
  pages: Page[]
  activePage: Page
  settingsActive: boolean
  onSelectPage: (page: Page) => void
  onPagesChange: (pages: Page[]) => void
  onOpenSettings: () => void
  onCloseSettings: () => void
}

// ホーム画面のヘッダー全体を管理するコンポーネント。
// ページ CRUD のハンドラーとモーダル表示制御を担う。
// 各 UI 部品は PageTab / MobileDrawer に分離している。
export default function HomeHeader({
  loginName,
  pages,
  activePage,
  settingsActive,
  onSelectPage,
  onPagesChange,
  onOpenSettings,
  onCloseSettings,
}: Props) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [showLayoutModal, setShowLayoutModal] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  async function handleAddPage(pageName: string) {
    setShowAddModal(false)
    const newPage = await addPageAction(pageName)
    onPagesChange([...pages, newPage])
    onSelectPage(newPage)
    // ページ作成直後にレイアウト選択モーダルを開く
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

  async function handleRename(pageId: number, name: string) {
    await updatePageAction(pageId, { pageName: name })
    onPagesChange(pages.map((p) => (p.pageId === pageId ? { ...p, pageName: name } : p)))
  }

  async function handleLayoutConfirm(layout: PageLayout) {
    setShowLayoutModal(false)
    await updatePageAction(activePage.pageId, { layout })
    onPagesChange(pages.map((p) => (p.pageId === activePage.pageId ? { ...p, layout } : p)))
  }

  return (
    <>
      <header className="bg-brand text-white h-11 flex items-center px-4 gap-0 shrink-0">
        {/* モバイル: ハンバーガーボタン */}
        <button
          className="lg:hidden p-1 -ml-1 mr-2"
          onClick={() => setDrawerOpen(true)}
          aria-label="メニューを開く"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* ロゴ */}
        <Link href="/" className="flex items-center gap-1.5 shrink-0 mr-3">
          <LayoutGrid className="w-5 h-5 text-white" />
          <span className="font-bold text-lg tracking-wide">Oripo</span>
        </Link>

        {/* デスクトップ: ページタブ一覧 + ナビ */}
        <nav className="hidden lg:flex items-center gap-0 flex-1 overflow-x-hidden">
          {settingsActive ? (
            // 個人設定表示中はページタブをシンプルなリンクとして表示
            pages.map((page) => (
              <button
                key={page.pageId}
                onClick={() => onSelectPage(page)}
                className="px-3 py-1.5 rounded text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
              >
                {page.pageName}
              </button>
            ))
          ) : (
            pages.map((page) => (
              <PageTab
                key={page.pageId}
                page={page}
                isActive={page.pageId === activePage.pageId}
                showDelete={pages.length > 1}
                onSelect={() => onSelectPage(page)}
                onDelete={() => handleDeletePage(page)}
                onLayoutOpen={() => setShowLayoutModal(true)}
                onRename={(name) => handleRename(page.pageId, name)}
              />
            ))
          )}

          {/* 個人設定: アクティブ時は白ピル、非アクティブ時はテキストリンク */}
          <button
            onClick={settingsActive ? onCloseSettings : onOpenSettings}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ml-1 ${
              settingsActive
                ? 'bg-white text-brand font-semibold'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            個人設定
          </button>

          {/* タブ上限（10枚）未満のときのみ追加ボタンを表示。個人設定中も常に表示（AIPO準拠） */}
          {pages.length < 10 && (
            <button
              onClick={() => setShowAddModal(true)}
              className="ml-auto p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
              aria-label="タブを追加"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </nav>

        {/* 右端: お知らせ・ユーザー名・ログアウト */}
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
          {/* モバイル: イニシャルアバター */}
          <div className="lg:hidden w-7 h-7 rounded-full bg-white/25 flex items-center justify-center text-xs font-bold">
            {loginName.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      <MobileDrawer
        open={drawerOpen}
        loginName={loginName}
        pages={pages}
        activePage={activePage}
        onSelectPage={onSelectPage}
        onClose={() => setDrawerOpen(false)}
      />

      {showAddModal && (
        <AddPageModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddPage}
        />
      )}

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
