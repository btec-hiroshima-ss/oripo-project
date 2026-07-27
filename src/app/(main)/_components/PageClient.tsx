'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { Page, PageWidget, WidgetType } from '@/lib/pages.types'
import AppHeader from './AppHeader'
import SettingsView from './SettingsView'
import ScheduleWidget from './widgets/ScheduleWidget'
import ActivityWidget from './widgets/ActivityWidget'
import UserListWidget from './widgets/UserListWidget'
import { addWidgetsAction } from '../actions'

// WidgetGrid は @dnd-kit と Server Actions の組み合わせにより SSR で undefined になるため ssr: false
const WidgetGrid = dynamic(() => import('./WidgetGrid'), { ssr: false })

// モバイルでのデフォルト表示ウィジェット（モックアップ①準拠）
const DEFAULT_MOBILE_WIDGET: WidgetType = 'Schedule'

type Props = {
  loginName: string
  userId: number
  fullName: string
  department: string | null
  initialPages: Page[]
  initialWidgetsByPage: Record<number, PageWidget[]>
}

// モバイル（lg未満）: ドロワーで選択したウィジェットを1つフル画面表示
// ウィジェットヘッダー・削除ボタンは不要なため WidgetWrapper を使わずに直接描画する
function MobileWidgetView({ widgetType }: { widgetType: WidgetType }) {
  if (widgetType === 'Schedule') {
    // isMobileView=true でモバイル専用テーブル（oripo_mobile_widget_settings）を使用する。
    // PC版のページ構成（oripo_page_widgets）と独立しているため widgetId 不要。
    return <ScheduleWidget isMobileView />
  }
  if (widgetType === 'Whatsnew') return <ActivityWidget />
  if (widgetType === 'UserList') return <UserListWidget />
  return null
}

export default function PageClient({ loginName, userId, fullName, department, initialPages, initialWidgetsByPage }: Props) {
  const [pages, setPages] = useState(initialPages)
  const [activePage, setActivePage] = useState(initialPages[0])
  const [widgetsByPage, setWidgetsByPage] = useState(initialWidgetsByPage)
  // 個人設定画面の表示切り替え（URL は / のまま、コンテンツエリアのみ切り替える）
  const [showSettings, setShowSettings] = useState(false)
  // モバイル時に表示するアクティブウィジェット（ドロワーで切り替え）
  const [activeMobileWidget, setActiveMobileWidget] = useState<WidgetType>(DEFAULT_MOBILE_WIDGET)
  // モバイル判定: window.matchMedia で lg ブレークポイント（1024px）未満を監視する。
  // SSR では false（デスクトップ表示）として扱い、クライアント side で正しい値に更新される。
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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
        userId={userId}
        fullName={fullName}
        department={department}
        pages={pages}
        activePage={activePage}
        activeWidgets={widgets}
        settingsActive={showSettings}
        activeMobileWidget={activeMobileWidget}
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
        onSelectMobileWidget={(type) => {
          setActiveMobileWidget(type)
          setShowSettings(false)
        }}
      />
      {showSettings ? (
        <SettingsView />
      ) : isMobile ? (
        // モバイル: ドロワーで選択したウィジェットのみフル画面表示（モックアップ①③準拠）
        <div className="flex-1">
          <MobileWidgetView widgetType={activeMobileWidget} />
        </div>
      ) : (
        // デスクトップ: マルチカラムレイアウト＋ D&D
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
