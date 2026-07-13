'use client'

import { useState } from 'react'
import type { Page, PageWidget } from '@/lib/pages.types'
import HomeHeader from './HomeHeader'
import WidgetGrid from './WidgetGrid'

type Props = {
  loginName: string
  initialPages: Page[]
  initialWidgetsByPage: Record<number, PageWidget[]>
}

export default function HomeClient({ loginName, initialPages, initialWidgetsByPage }: Props) {
  const [pages, setPages] = useState(initialPages)
  const [activePage, setActivePage] = useState(initialPages[0])
  const [widgetsByPage, setWidgetsByPage] = useState(initialWidgetsByPage)

  const widgets = widgetsByPage[activePage?.pageId] ?? []

  if (!activePage) return null

  return (
    <div className="flex flex-col min-h-screen">
      <HomeHeader
        loginName={loginName}
        pages={pages}
        activePage={activePage}
        onSelectPage={setActivePage}
        onPagesChange={(updated) => {
          setPages(updated)
          // ページ名・レイアウト変更を activePage にも反映する
          const current = updated.find((p) => p.pageId === activePage.pageId)
          if (current) setActivePage(current)
        }}
      />
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
    </div>
  )
}
