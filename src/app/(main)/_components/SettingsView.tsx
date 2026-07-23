'use client'

import { useState } from 'react'
import SettingsMenu, { type SettingsMenuKey } from './SettingsMenu'

const PANEL_LABELS: Record<SettingsMenuKey, string> = {
  userInfo: 'ユーザー情報',
  myGroup: 'Myグループ',
  pageSettings: 'ページ設定',
}

// 個人設定画面。左メニューの選択に応じてコンテンツエリアの表示を切り替える。
// SettingsView は showSettings が true の間だけマウントされるため、
// 個人設定を閉じて再度開くと selected は必ず初期値（ユーザー情報）に戻る。
// 各パネルの中身（ユーザー情報・Myグループ・ページ設定）は #143〜#145 で実装するため、
// ここでは選択中のパネル名のみ表示する。
export default function SettingsView() {
  const [selected, setSelected] = useState<SettingsMenuKey>('userInfo')

  return (
    <div className="flex-1 p-4">
      <div className="w-full lg:w-1/2 max-w-7xl mx-auto flex flex-col lg:flex-row gap-4">
        <SettingsMenu selected={selected} onSelect={setSelected} />

        <div className="flex-1 bg-white rounded-lg shadow-sm p-6">
          <span className="font-semibold text-gray-800">{PANEL_LABELS[selected]}</span>
        </div>
      </div>
    </div>
  )
}
