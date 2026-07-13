'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Bell, Menu, X } from 'lucide-react'
import { logout } from '@/app/login/actions'

const NAV_ITEMS = [
  { label: 'マイページ', href: '/' },
  { label: '個人設定', href: '/settings' },
]

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

export default function Header({ loginName }: { loginName: string }) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <>
      <header className="bg-brand text-white h-11 flex items-center px-4 gap-3 shrink-0">
        {/* モバイル: ハンバーガー */}
        <button
          className="lg:hidden p-1 -ml-1"
          onClick={() => setDrawerOpen(true)}
          aria-label="メニューを開く"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* ロゴ */}
        <Link href="/" className="flex items-center gap-1.5 shrink-0">
          <OripoIcon />
          <span className="font-bold text-lg tracking-wide">Oripo</span>
        </Link>

        {/* デスクトップ: タブナビゲーション */}
        <nav className="hidden lg:flex items-center gap-0.5 ml-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? 'bg-white/20'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* 右側: お知らせ・ユーザー名・ログアウト */}
        <div className="ml-auto flex items-center gap-3">
          <button aria-label="お知らせ">
            <Bell className="w-5 h-5" />
          </button>

          {/* デスクトップ */}
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
        {/* ドロワーヘッダー */}
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

        {/* ドロワーナビ */}
        <nav className="p-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setDrawerOpen(false)}
              className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              {item.label}
            </Link>
          ))}
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
