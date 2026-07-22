'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { Page, PageWidget, WidgetType } from '@/lib/pages.types'
import AppHeader from './AppHeader'
import SettingsView from './SettingsView'
import { addWidgetsAction } from '../actions'

// WidgetGrid は @dnd-kit と Server Actions の組み合わせにより SSR で undefined になるため ssr: false
const WidgetGrid = dynamic(() => import('./WidgetGrid'), { ssr: false })

type Props = {
  loginName: string
  userId: number
  fullName: string
  department: string | null
  initialPages: Page[]
  initialWidgetsByPage: Record<number, PageWidget[]>
}

export default function PageClient({ loginName, userId, fullName, department, initialPages, initialWidgetsByPage }: Props) {
  const [pages, setPages] = useState(initialPages)
  const [activePage, setActivePage] = useState(initialPages[0])
  const [widgetsByPage, setWidgetsByPage] = useState(initialWidgetsByPage)
  // 個人設定画面の表示切り替え（URL は / のまま、コンテンツエリアのみ切り替える）
  const [showSettings, setShowSettings] = useState(false)

  const widgets = widgetsByPage[activePage?.pageId] ?? []

  if (!activePage) return null

  async function handleWidgetsAdd(types: WidgetType[]) {
    const newWidgets = await addWidgetsAction(activePage.pageId, types)
    const updated = [...widgets, ...newWidgets]
    setWidgetsByPage((prev) => ({ ...prev, [activePage.pageId]: updated }))
  }

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader
        loginName={loginName}
        userId={userId}
        fullName={fullName}
        department={department}
        pages={pages}
        activePage={activePage}
        activeWidgets={widgets}
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
        onWidgetsAdd={handleWidgetsAdd}
        onOpenSettings={() => setShowSettings(true)}
        onCloseSettings={() => setShowSettings(false)}
      />
      {showSettings ? (
        <SettingsView />
      ) : (
        <div className="flex-1 p-4">
          <WidgetGrid
            key={activePage.pageId}
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
