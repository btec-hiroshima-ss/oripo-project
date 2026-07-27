'use client'

import { useState } from 'react'
import type { UserProfile } from '@/lib/user.types'
import SettingsMenu, { type SettingsMenuKey } from './SettingsMenu'
import UserInfoPanel from './UserInfoPanel'

// Myグループ（#144）・ページ設定（#145）は未実装のため、選択中のパネル名のみ表示する
const PANEL_LABELS: Record<SettingsMenuKey, string> = {
  userInfo: 'ユーザー情報',
  myGroup: 'Myグループ',
  pageSettings: 'ページ設定',
}

type Props = {
  profile: UserProfile
  onEditUser: () => void
}

// 個人設定画面。左メニューの選択に応じてコンテンツエリアの表示を切り替える。
// SettingsView は showSettings が true の間だけマウントされるため、
// 個人設定を閉じて再度開くと selected は必ず初期値（ユーザー情報）に戻る。
export default function SettingsView({ profile, onEditUser }: Props) {
  const [selected, setSelected] = useState<SettingsMenuKey>('userInfo')

  return (
    <div className="flex-1 p-4">
      <div className="w-full lg:w-1/2 max-w-7xl mx-auto flex flex-col lg:flex-row gap-4">
        <SettingsMenu selected={selected} onSelect={setSelected} />

        <div className="flex-1">
          {selected === 'userInfo' ? (
            <UserInfoPanel profile={profile} onEdit={onEditUser} />
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <span className="font-semibold text-gray-800">{PANEL_LABELS[selected]}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
