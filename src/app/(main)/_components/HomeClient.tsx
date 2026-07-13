'use client'

import { useState } from 'react'
import type { Page, PageWidget } from '@/lib/pages.types'
import HomeHeader from './HomeHeader'
import WidgetGrid from './WidgetGrid'
import SettingsView from './SettingsView'

type Props = {
  loginName: string
  initialPages: Page[]
  initialWidgetsByPage: Record<number, PageWidget[]>
}

export default function HomeClient({ loginName, initialPages, initialWidgetsByPage }: Props) {
  const [pages, setPages] = useState(initialPages)
  const [activePage, setActivePage] = useState(initialPages[0])
  const [widgetsByPage, setWidgetsByPage] = useState(initialWidgetsByPage)
  // 個人設定画面の表示切り替え（URL は / のまま、コンテンツエリアのみ切り替える）
  const [showSettings, setShowSettings] = useState(false)

  const widgets = widgetsByPage[activePage?.pageId] ?? []

  if (!activePage) return null

  return (
    <div className="flex flex-col min-h-screen">
      <HomeHeader
        loginName={loginName}
        pages={pages}
        activePage={activePage}
        settingsActive={showSettings}
        onSelectPage={(page) => {
          setActivePage(page)
          setShowSettings(false)
        }}
        onPagesChange={(updated) => {
          setPages(updated)
          // ページ名・レイアウト変更を activePage にも反映する
          const current = updated.find((p) => p.pageId === activePage.pageId)
          if (current) setActivePage(current)
        }}
        onOpenSettings={() => setShowSettings(true)}
        onCloseSettings={() => setShowSettings(false)}
      />
      {showSettings ? (
        <SettingsView />
      ) : (
        <div className="flex-1 p-4">
          <WidgetGrid
            key={activePage.pageId}
            pageId={activePage.pageId}
            layout={activePage.layout}
            widgets={widgets}
            onWidgetsChange={(updated) =>
              setWidgetsByPage((prev) => ({ ...prev, [activePage.pageId]: updated }))
            }
          />
        </div>
      )}
    </div>
  )
}
