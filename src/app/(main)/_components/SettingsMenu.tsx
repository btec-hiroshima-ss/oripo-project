'use client'

import { User, Users, PanelsTopLeft } from 'lucide-react'

export type SettingsMenuKey = 'userInfo' | 'myGroup' | 'pageSettings'

const MENU_ITEMS: { key: SettingsMenuKey; label: string; icon: typeof User }[] = [
  { key: 'userInfo', label: 'ユーザー情報', icon: User },
  { key: 'myGroup', label: 'Myグループ', icon: Users },
  { key: 'pageSettings', label: 'ページ設定', icon: PanelsTopLeft },
]

type Props = {
  selected: SettingsMenuKey
  onSelect: (key: SettingsMenuKey) => void
}

// 個人設定の左メニュー。デスクトップは縦並びの選択リスト、モバイルは横スクロールのピルボタン列
export default function SettingsMenu({ selected, onSelect }: Props) {
  return (
    <div className="w-full lg:w-36 shrink-0">
      <p className="hidden lg:block px-1 pb-2 text-xs text-gray-400">個人設定</p>

      {/* デスクトップ: 縦並びの白カード */}
      <nav className="hidden lg:block bg-white rounded-lg shadow-sm overflow-hidden">
        {MENU_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm border-l-2 border-b border-b-gray-100 last:border-b-0 transition-colors ${
              selected === key
                ? 'border-l-brand bg-brand/8 text-brand font-semibold'
                : 'border-l-transparent text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </nav>

      <nav className="lg:hidden flex gap-2 overflow-x-auto pb-1">
        {MENU_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              selected === key
                ? 'bg-brand text-white font-semibold'
                : 'bg-white text-gray-600'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
