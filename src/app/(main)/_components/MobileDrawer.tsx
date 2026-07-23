'use client'

import { LogOut, X } from 'lucide-react'
import { logout } from '@/app/login/actions'
import type { Page } from '@/lib/pages.types'

type Props = {
  open: boolean
  loginName: string
  pages: Page[]
  activePage: Page
  settingsActive: boolean
  onSelectPage: (page: Page) => void
  onOpenSettings: () => void
  onClose: () => void
}

// モバイル用スライドインドロワー。
// open=false でも DOM に残しておくことでスライドアニメーションが効く（translate-x で制御）。
export default function MobileDrawer({
  open,
  loginName,
  pages,
  activePage,
  settingsActive,
  onSelectPage,
  onOpenSettings,
  onClose,
}: Props) {
  return (
    <>
      {/* 背景オーバーレイ: タップで閉じる */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* ドロワー本体 */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-white z-50 shadow-xl lg:hidden transform transition-transform duration-200 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* ユーザー情報ヘッダー */}
        <div className="bg-brand text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center text-sm font-bold">
              {loginName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium">{loginName}</span>
          </div>
          <button onClick={onClose} aria-label="メニューを閉じる">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-2">
          {/* ページ一覧 */}
          {pages.map((page) => (
            <button
              key={page.pageId}
              onClick={() => { onSelectPage(page); onClose() }}
              className={`w-full text-left px-4 py-3 text-sm rounded-lg ${
                activePage.pageId === page.pageId
                  ? 'text-brand font-medium bg-orange-50'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {page.pageName}
            </button>
          ))}

          <hr className="my-2 border-gray-100" />

          {/* 個人設定は URL 遷移ではなく showSettings state の切り替え（layout.md 準拠） */}
          <button
            onClick={() => { onOpenSettings(); onClose() }}
            className={`w-full text-left px-4 py-3 text-sm rounded-lg ${
              settingsActive ? 'text-brand font-medium bg-orange-50' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            個人設定
          </button>

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
    </>
  )
}
