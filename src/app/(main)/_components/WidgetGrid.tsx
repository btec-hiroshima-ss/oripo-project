'use client'

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { LAYOUT_COLUMNS, WIDGET_LABELS, type PageLayout, type PageWidget, type WidgetType } from '@/lib/pages'
import { addWidgetAction, updateWidgetPositionAction } from '../actions'
import WidgetWrapper from './WidgetWrapper'
import ScheduleWidget from './widgets/ScheduleWidget'
import WhatsnewWidget from './widgets/WhatsnewWidget'
import UserListWidget from './widgets/UserListWidget'

const ALL_WIDGET_TYPES: WidgetType[] = ['Schedule', 'Whatsnew', 'UserList']

function WidgetContent({ widgetType }: { widgetType: WidgetType }) {
  if (widgetType === 'Schedule') return <ScheduleWidget />
  if (widgetType === 'Whatsnew') return <WhatsnewWidget />
  if (widgetType === 'UserList') return <UserListWidget />
  return null
}

type Props = {
  pageId: number
  layout: PageLayout
  widgets: PageWidget[]
  isMobile: boolean
}

export default function WidgetGrid({ pageId, layout, widgets: initialWidgets, isMobile }: Props) {
  const [widgets, setWidgets] = useState(initialWidgets)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [, startTransition] = useTransition()

  const columnCount = isMobile ? 1 : LAYOUT_COLUMNS[layout]

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // モバイルは col 順 → row 順でフラット化
  const sortedWidgets = isMobile
    ? [...widgets].sort((a, b) => a.col - b.col || a.row - b.row)
    : widgets

  // カラムごとにウィジェットを振り分け
  const columns: PageWidget[][] = Array.from({ length: columnCount }, () => [])
  for (const w of sortedWidgets) {
    const col = isMobile ? 0 : Math.min(w.col, columnCount - 1)
    columns[col].push(w)
  }
  for (const col of columns) {
    col.sort((a, b) => a.row - b.row)
  }

  const usedTypes = new Set(widgets.map((w) => w.widgetType))
  const availableTypes = ALL_WIDGET_TYPES.filter((t) => !usedTypes.has(t))

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeWidget = widgets.find((w) => w.widgetId === active.id)
    const overWidget = widgets.find((w) => w.widgetId === over.id)
    if (!activeWidget || !overWidget) return

    const newWidgets = widgets.map((w) => {
      if (w.widgetId === activeWidget.widgetId) {
        return { ...w, col: overWidget.col, row: overWidget.row }
      }
      if (w.widgetId === overWidget.widgetId) {
        return { ...w, col: activeWidget.col, row: activeWidget.row }
      }
      return w
    })
    setWidgets(newWidgets)

    startTransition(async () => {
      await updateWidgetPositionAction(activeWidget.widgetId, overWidget.col, overWidget.row)
      await updateWidgetPositionAction(overWidget.widgetId, activeWidget.col, activeWidget.row)
    })
  }

  async function handleAddWidget(widgetType: WidgetType) {
    setShowAddMenu(false)
    const newWidget = await addWidgetAction(pageId, widgetType)
    setWidgets((prev) => [...prev, newWidget])
  }

  const isDragEnabled = !isMobile && columnCount > 0

  return (
    <div className="flex flex-col gap-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: isMobile
              ? '1fr'
              : layout === 'TwoColumnsRight'
              ? '1fr 3fr'
              : layout === 'TwoColumnsLeft'
              ? '3fr 1fr'
              : layout === 'ThreeColumns'
              ? '1fr 2fr 1fr'
              : `repeat(${columnCount}, 1fr)`,
          }}
        >
          {columns.map((colWidgets, colIndex) => (
            <SortableContext
              key={colIndex}
              items={colWidgets.map((w) => w.widgetId)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-3">
                {colWidgets.map((w) => (
                  <WidgetWrapper
                    key={w.widgetId}
                    widgetId={w.widgetId}
                    widgetType={w.widgetType}
                    isDragEnabled={isDragEnabled}
                  >
                    <WidgetContent widgetType={w.widgetType} />
                  </WidgetWrapper>
                ))}
              </div>
            </SortableContext>
          ))}
        </div>
      </DndContext>

      {availableTypes.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowAddMenu((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-brand hover:text-brand-dark font-medium"
          >
            <Plus className="w-4 h-4" />
            ウィジェットを追加
          </button>
          {showAddMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-40">
              {availableTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => handleAddWidget(type)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                >
                  {WIDGET_LABELS[type]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
