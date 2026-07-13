'use client'

import {
  DndContext,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDndContext,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useState, useTransition, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { LAYOUT_COLUMNS, WIDGET_LABELS, type PageLayout, type PageWidget, type WidgetType } from '@/lib/pages.types'
import { addWidgetAction, updateWidgetPositionAction } from '../actions'
import WidgetWrapper from './WidgetWrapper'
import ScheduleWidget from './widgets/ScheduleWidget'
import WhatsnewWidget from './widgets/WhatsnewWidget'
import UserListWidget from './widgets/UserListWidget'

const ALL_WIDGET_TYPES: WidgetType[] = ['Schedule', 'Whatsnew', 'UserList']

// DroppableColumn の id 生成（`col-0`, `col-1`, ...）と dragEnd 時の列ドロップ判定で共用するプレフィックス
const COL_DROP_PREFIX = 'col-'

const LAYOUT_GRID: Record<PageLayout, string> = {
  OneColumn:        'lg:grid-cols-1',
  TwoColumns:       'lg:grid-cols-2',
  TwoColumnsRight:  'lg:[grid-template-columns:1fr_3fr]',
  TwoColumnsLeft:   'lg:[grid-template-columns:3fr_1fr]',
  ThreeColumns:     'lg:[grid-template-columns:1fr_2fr_1fr]',
}

function WidgetContent({ widgetType }: { widgetType: WidgetType }) {
  if (widgetType === 'Schedule') return <ScheduleWidget />
  if (widgetType === 'Whatsnew') return <WhatsnewWidget />
  if (widgetType === 'UserList') return <UserListWidget />
  return null
}

// 各列を droppable にするコンポーネント。
// useDroppable によって「列の空き領域」もドロップ先として認識される。
// ドラッグ中は末尾にドロップ可能領域（点線枠）を表示し、ホバー時はブランドカラーでハイライトする。
function DroppableColumn({ colIndex, children }: { colIndex: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COL_DROP_PREFIX}${colIndex}` })
  const { active } = useDndContext()
  const isDragging = active !== null
  return (
    <div ref={setNodeRef} className="flex flex-col gap-3 min-h-16">
      {children}
      {isDragging && (
        <div
          className={`min-h-10 rounded-lg border-2 border-dashed transition-colors ${
            isOver ? 'border-brand bg-brand/5' : 'border-gray-200'
          }`}
        />
      )}
    </div>
  )
}

type Props = {
  pageId: number
  layout: PageLayout
  widgets: PageWidget[]
  onWidgetsChange: (widgets: PageWidget[]) => void
}

export default function WidgetGrid({ pageId, layout, widgets: initialWidgets, onWidgetsChange }: Props) {
  const [widgets, setWidgets] = useState(initialWidgets)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [, startTransition] = useTransition()

  // ページ設定など外部でウィジェットが変更された場合に内部 state を同期する
  useEffect(() => {
    setWidgets(initialWidgets)
  }, [initialWidgets])

  const columnCount = LAYOUT_COLUMNS[layout]

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const columns: PageWidget[][] = Array.from({ length: columnCount }, () => [])
  for (const w of widgets) {
    const col = Math.min(w.col, columnCount - 1)
    columns[col].push(w)
  }
  for (const col of columns) {
    col.sort((a, b) => a.row - b.row)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return

    const activeWidget = widgets.find((w) => w.widgetId === active.id)
    if (!activeWidget) return

    const overId = over.id

    // カラム空き領域へのドロップ: そのカラムの末尾に追加（AIPO の末尾 add と同等）
    if (typeof overId === 'string' && overId.startsWith(COL_DROP_PREFIX)) {
      const targetCol = parseInt(overId.slice(COL_DROP_PREFIX.length))
      const sourceCol = activeWidget.col
      // すでに同カラムの末尾にいる場合はスキップ
      if (sourceCol === targetCol && columns[targetCol].at(-1)?.widgetId === activeWidget.widgetId) return

      const rowMap = new Map<number, { col: number; row: number }>()
      // active をターゲットカラムの末尾に配置
      const targetWithoutActive = columns[targetCol].filter((w) => w.widgetId !== activeWidget.widgetId)
      rowMap.set(activeWidget.widgetId, { col: targetCol, row: targetWithoutActive.length })
      if (sourceCol !== targetCol) {
        // カラムをまたぐ場合: ソースカラムの残存ウィジェットも row を振り直す
        const sourceItems = columns[sourceCol].filter((w) => w.widgetId !== activeWidget.widgetId)
        sourceItems.forEach((w, idx) => rowMap.set(w.widgetId, { col: sourceCol, row: idx }))
      } else {
        // 同一カラム末尾ドロップ: 残存ウィジェットの row も振り直す
        targetWithoutActive.forEach((w, idx) => rowMap.set(w.widgetId, { col: targetCol, row: idx }))
      }

      const newWidgets = widgets.map((w) => {
        const newPos = rowMap.get(w.widgetId)
        return newPos ? { ...w, ...newPos } : w
      })
      setWidgets(newWidgets)
      onWidgetsChange(newWidgets)
      startTransition(async () => {
        await Promise.all(
          [...rowMap.entries()].map(([widgetId, { col, row }]) =>
            updateWidgetPositionAction(widgetId, col, row)
          )
        )
      })
      return
    }

    // 別ウィジェットへのドロップ: AIPO 準拠の INSERT（ドラッグ元をドロップ先の直前に挿入）
    const overWidget = widgets.find((w) => w.widgetId === overId)
    if (!overWidget || activeWidget.widgetId === overWidget.widgetId) return

    const sourceCol = activeWidget.col
    const targetCol = overWidget.col

    // ソースカラムから active を除いたリスト
    const sourceItems = columns[sourceCol].filter((w) => w.widgetId !== activeWidget.widgetId)

    let targetItems: PageWidget[]
    if (sourceCol === targetCol) {
      // 同一カラム: AIPO 方式では active 除去「前」の元インデックスに挿入する。
      // 除去後の配列でインデックスを探すと、下方向ドラッグ時に常に元の位置に戻ってしまう。
      const origIdx = columns[sourceCol].findIndex((w) => w.widgetId === overWidget.widgetId)
      targetItems = [...sourceItems]
      targetItems.splice(origIdx, 0, activeWidget)
    } else {
      // 別カラム: ターゲットカラムの overWidget の直前に挿入
      targetItems = [...columns[targetCol]]
      const overIdx = targetItems.findIndex((w) => w.widgetId === overWidget.widgetId)
      targetItems.splice(overIdx, 0, activeWidget)
    }

    // 影響するカラムの row を 0 から振り直す
    const rowMap = new Map<number, { col: number; row: number }>()
    targetItems.forEach((w, idx) => rowMap.set(w.widgetId, { col: targetCol, row: idx }))
    if (sourceCol !== targetCol) {
      sourceItems.forEach((w, idx) => rowMap.set(w.widgetId, { col: sourceCol, row: idx }))
    }

    const newWidgets = widgets.map((w) => {
      const newPos = rowMap.get(w.widgetId)
      return newPos ? { ...w, ...newPos } : w
    })
    setWidgets(newWidgets)
    onWidgetsChange(newWidgets)
    startTransition(async () => {
      await Promise.all(
        [...rowMap.entries()].map(([widgetId, { col, row }]) =>
          updateWidgetPositionAction(widgetId, col, row)
        )
      )
    })
  }

  async function handleAddWidget(widgetType: WidgetType) {
    setShowAddMenu(false)
    const newWidget = await addWidgetAction(pageId, widgetType)
    const updated = [...widgets, newWidget]
    setWidgets(updated)
    onWidgetsChange(updated)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* rectIntersection: ドラッグ矩形と droppable 矩形の重なりで判定するため
          closestCenter より列跨ぎドラッグの精度が高い */}
      <DndContext id="widget-dnd" sensors={sensors} collisionDetection={rectIntersection} onDragEnd={handleDragEnd}>
        <div className={`grid grid-cols-1 gap-4 ${LAYOUT_GRID[layout]}`}>
          {columns.map((colWidgets, colIndex) => (
            <SortableContext
              key={colIndex}
              items={colWidgets.map((w) => w.widgetId)}
              strategy={verticalListSortingStrategy}
            >
              <DroppableColumn colIndex={colIndex}>
                {colWidgets.map((w) => (
                  <WidgetWrapper
                    key={w.widgetId}
                    widgetId={w.widgetId}
                    widgetType={w.widgetType}
                    onDeleted={() => {
                      const updated = widgets.filter((x) => x.widgetId !== w.widgetId)
                      setWidgets(updated)
                      onWidgetsChange(updated)
                    }}
                  >
                    <WidgetContent widgetType={w.widgetType} />
                  </WidgetWrapper>
                ))}
              </DroppableColumn>
            </SortableContext>
          ))}
        </div>
      </DndContext>

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
            {ALL_WIDGET_TYPES.map((type) => (
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
    </div>
  )
}
