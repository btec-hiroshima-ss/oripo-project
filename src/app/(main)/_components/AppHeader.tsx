'use client'

import { useState } from 'react'
import { LogOut, Bell, Menu, Plus } from 'lucide-react'
import { logout } from '@/app/login/actions'
import type { Page, PageLayout, PageWidget, WidgetType } from '@/lib/pages.types'
import { addPageAction, deletePageAction, updatePageAction } from '../actions'
import AddPageModal from './AddPageModal'
import InitialAvatar from './InitialAvatar'
import PageSettingsModal from './PageSettingsModal'
import PageTab from './PageTab'
import MobileDrawer from './MobileDrawer'

type Props = {
  loginName: string
  userId: number
  fullName: string
  department: string | null
  pages: Page[]
  activePage: Page
  activeWidgets: PageWidget[]
  settingsActive: boolean
  onSelectPage: (page: Page) => void
  onPagesChange: (pages: Page[]) => void
  onWidgetsAdd: (types: WidgetType[]) => void
  onOpenSettings: () => void
  onCloseSettings: () => void
  onOpenUserEdit: () => void
}

// アプリ全体のヘッダー。ページ CRUD とモーダル表示を管理する。
// PageSettingsModal でレイアウト変更＋ウィジェット追加を一体化（AIPO 準拠）。
export default function AppHeader({
  loginName,
  userId,
  fullName,
  department,
  pages,
  activePage,
  activeWidgets,
  settingsActive,
  onSelectPage,
  onPagesChange,
  onWidgetsAdd,
  onOpenSettings,
  onCloseSettings,
  onOpenUserEdit,
}: Props) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPageSettings, setShowPageSettings] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  async function handleAddPage(pageName: string) {
    setShowAddModal(false)
    const newPage = await addPageAction(pageName)
    onPagesChange([...pages, newPage])
    onSelectPage(newPage)
    // ページ作成直後にページ設定モーダルを開く（レイアウト選択をうながす）
    setShowPageSettings(true)
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

  async function handlePageSettingsConfirm(layout: PageLayout, addWidgetTypes: WidgetType[]) {
    setShowPageSettings(false)
    if (layout !== activePage.layout) {
      await updatePageAction(activePage.pageId, { layout })
      onPagesChange(pages.map((p) => (p.pageId === activePage.pageId ? { ...p, layout } : p)))
    }
    if (addWidgetTypes.length > 0) {
      onWidgetsAdd(addWidgetTypes)
    }
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
        <span className="font-bold text-lg tracking-wide shrink-0 mr-3">Oripo</span>

        {/* デスクトップ: ページタブ一覧 + 個人設定ボタン + タブ追加ボタン */}
        <nav className="hidden lg:flex items-center gap-0 flex-1 overflow-x-hidden">
          {settingsActive ? (
            // 個人設定表示中はページタブをシンプルなボタンとして表示
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
                onSettingsOpen={() => setShowPageSettings(true)}
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
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
              aria-label="タブを追加"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </nav>

        {/* 右端: お知らせ・ユーザーアバター＋部署名・ログアウト */}
        <div className="ml-auto flex items-center gap-3">
          <button aria-label="お知らせ">
            <Bell className="w-5 h-5" />
          </button>

          {/* デスクトップ: アバター（イニシャル円）＋氏名＋部署名 */}
          <div className="hidden lg:flex items-center gap-1.5">
            <InitialAvatar userId={userId} name={fullName} onClick={onOpenUserEdit} />
            <span className="text-sm text-white/90">{fullName}</span>
            {department && (
              <span className="text-xs text-white/60">{department}</span>
            )}
          </div>

          <form action={logout} className="hidden lg:block">
            <button
              type="submit"
              className="flex items-center gap-1.5 bg-black/70 hover:bg-black/90 rounded px-2.5 py-1 text-sm transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              ログアウト
            </button>
          </form>

          {/* モバイル: イニシャルアバターのみ */}
          <div className="lg:hidden">
            <InitialAvatar userId={userId} name={fullName} onClick={onOpenUserEdit} />
          </div>
        </div>
      </header>

      <MobileDrawer
        open={drawerOpen}
        loginName={loginName}
        pages={pages}
        activePage={activePage}
        settingsActive={settingsActive}
        onSelectPage={onSelectPage}
        onOpenSettings={onOpenSettings}
        onClose={() => setDrawerOpen(false)}
      />

      {showAddModal && (
        <AddPageModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddPage}
        />
      )}

      {showPageSettings && (
        <PageSettingsModal
          currentLayout={activePage.layout}
          existingWidgets={activeWidgets}
          onClose={() => setShowPageSettings(false)}
          onConfirm={handlePageSettingsConfirm}
        />
      )}
    </>
  )
}
