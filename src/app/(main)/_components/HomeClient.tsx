'use client'

import { useState } from 'react'
import type { Page, PageWidget } from '@/lib/pages.types'
import PageTabBar from './PageTabBar'
import WidgetGrid from './WidgetGrid'

type Props = {
  initialPages: Page[]
  initialWidgetsByPage: Record<number, PageWidget[]>
  isMobile: boolean
}

export default function HomeClient({ initialPages, initialWidgetsByPage, isMobile }: Props) {
  const [pages, setPages] = useState(initialPages)
  const [activePage, setActivePage] = useState(initialPages[0])
  const [widgetsByPage, setWidgetsByPage] = useState(initialWidgetsByPage)

  const widgets = widgetsByPage[activePage?.pageId] ?? []

  if (!activePage) return null

  return (
    <div className="flex flex-col h-full">
      <PageTabBar
        pages={pages}
        activePage={activePage}
        onSelectPage={setActivePage}
        onPagesChange={setPages}
      />
      <div className="flex-1 p-4 overflow-y-auto">
        <WidgetGrid
          key={activePage.pageId}
          pageId={activePage.pageId}
          layout={activePage.layout}
          widgets={widgets}
          isMobile={isMobile}
        />
      </div>
    </div>
  )
}
