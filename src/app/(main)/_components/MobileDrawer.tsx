'use client'

import { Calendar, Bell, Users, Settings, LogOut, X } from 'lucide-react'
import { logout } from '@/app/login/actions'
import type { WidgetType } from '@/lib/pages.types'

// モバイルドロワーに表示するウィジェット切り替え項目（モックアップ④準拠）
const WIDGET_NAV_ITEMS: { type: WidgetType; label: string; icon: React.ReactNode }[] = [
  { type: 'Schedule',  label: 'スケジュール', icon: <Calendar className="w-5 h-5" /> },
  { type: 'Whatsnew', label: '更新情報',     icon: <Bell     className="w-5 h-5" /> },
  { type: 'UserList', label: 'ユーザー名簿', icon: <Users    className="w-5 h-5" /> },
]

type Props = {
  open: boolean
  fullName: string
  department: string | null
  activeMobileWidget: WidgetType
  settingsActive: boolean
  onSelectWidget: (type: WidgetType) => void
  onOpenSettings: () => void
  onClose: () => void
}

// モバイル用スライドインドロワー（lg 未満のみ表示）。
// モックアップ④の構成: ユーザー情報 → ウィジェット切り替え → 個人設定 → ログアウト
// デスクトップのページ（タブ）切り替えはモバイルでは非表示（モックアップにタブ概念なし）。
export default function MobileDrawer({
  open,
  fullName,
  department,
  activeMobileWidget,
  settingsActive,
  onSelectWidget,
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
        {/* ユーザー情報ヘッダー（モックアップ④: アバター + 氏名 + 部署） */}
        <div className="bg-brand text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center text-sm font-bold shrink-0">
              {fullName.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{fullName}</div>
              {department && (
                <div className="text-xs text-white/75 truncate">{department}</div>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="メニューを閉じる" className="shrink-0 ml-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-2">
          {/* ウィジェット切り替え（スケジュール / 更新情報 / ユーザー名簿） */}
          {WIDGET_NAV_ITEMS.map(({ type, label, icon }) => {
            const isActive = !settingsActive && activeMobileWidget === type
            return (
              <button
                key={type}
                onClick={() => { onSelectWidget(type); onClose() }}
                className={`w-full text-left flex items-center gap-3 px-4 py-3 text-sm rounded-lg ${
                  isActive ? 'text-brand font-medium bg-orange-50' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className={isActive ? 'text-brand' : 'text-gray-400'}>{icon}</span>
                {label}
              </button>
            )
          })}

          <hr className="my-2 border-gray-100" />

          {/* 個人設定は URL 遷移ではなく showSettings state の切り替え（layout.md 準拠） */}
          <button
            onClick={() => { onOpenSettings(); onClose() }}
            className={`w-full text-left flex items-center gap-3 px-4 py-3 text-sm rounded-lg ${
              settingsActive ? 'text-brand font-medium bg-orange-50' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className={settingsActive ? 'text-brand' : 'text-gray-400'}>
              <Settings className="w-5 h-5" />
            </span>
            個人設定
          </button>

          <hr className="my-2 border-gray-100" />

          <form action={logout}>
            <button
              type="submit"
              className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-gray-500 hover:bg-gray-50 rounded-lg"
            >
              <LogOut className="w-4 h-4 text-gray-400" />
              ログアウト
            </button>
          </form>
        </nav>
      </div>
    </>
  )
}
