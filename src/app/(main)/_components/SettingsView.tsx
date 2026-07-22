'use client'

import { useState } from 'react'
import SettingsMenu, { type SettingsMenuKey } from './SettingsMenu'
import UserInfoPanel from './settings-panels/UserInfoPanel'
import MyGroupPanel from './settings-panels/MyGroupPanel'
import PageSettingsPanel from './settings-panels/PageSettingsPanel'

// 個人設定画面。左メニューの選択に応じてコンテンツエリアのパネルを切り替える。
// SettingsView は showSettings が true の間だけマウントされるため、
// 個人設定を閉じて再度開くと selected は必ず初期値（ユーザー情報）に戻る。
export default function SettingsView() {
  const [selected, setSelected] = useState<SettingsMenuKey>('userInfo')

  return (
    <div className="flex-1 p-4 flex flex-col lg:flex-row gap-4">
      <SettingsMenu selected={selected} onSelect={setSelected} />

      <div className="flex-1">
        {selected === 'userInfo' && <UserInfoPanel />}
        {selected === 'myGroup' && <MyGroupPanel />}
        {selected === 'pageSettings' && <PageSettingsPanel />}
      </div>
    </div>
  )
}
