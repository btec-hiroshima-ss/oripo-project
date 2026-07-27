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
import { LAYOUT_COLUMNS, type PageLayout, type PageWidget, type WidgetType } from '@/lib/pages.types'
import { updateWidgetPositionAction } from '../actions'
import WidgetWrapper from './WidgetWrapper'
import ScheduleWidget from './widgets/ScheduleWidget'
import ActivityWidget from './widgets/ActivityWidget'
import UserListWidget from './widgets/UserListWidget'

// DroppableColumn の id 生成（`col-0`, `col-1`, ...）と dragEnd 時の列ドロップ判定で共用するプレフィックス
const COL_DROP_PREFIX = 'col-'

// レイアウト種別ごとの CSS グリッドクラス。lg ブレークポイント以上で列比率が適用される。
const LAYOUT_GRID: Record<PageLayout, string> = {
  OneColumn:        'lg:grid-cols-1',
  TwoColumns:       'lg:grid-cols-2',
  TwoColumnsRight:  'lg:[grid-template-columns:1fr_3fr]',
  TwoColumnsLeft:   'lg:[grid-template-columns:3fr_1fr]',
  ThreeColumns:     'lg:[grid-template-columns:1fr_2fr_1fr]',
}

function WidgetContent({ widgetId, widgetType }: { widgetId: number; widgetType: WidgetType }) {
  if (widgetType === 'Schedule') return <ScheduleWidget widgetId={widgetId} />
  if (widgetType === 'Whatsnew') return <ActivityWidget />
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
  layout: PageLayout
  widgets: PageWidget[]
  onWidgetsChange: (widgets: PageWidget[]) => void
}

export default function WidgetGrid({ layout, widgets: initialWidgets, onWidgetsChange }: Props) {
  const [widgets, setWidgets] = useState(initialWidgets)
  const [, startTransition] = useTransition()

  // ページ設定など外部でウィジェットが変更された場合に内部 state を同期する
  useEffect(() => {
    setWidgets(initialWidgets)
  }, [initialWidgets])

  // レイアウト種別から算出したカラム数（ウィジェットを何列に分割するか）
  const columnCount = LAYOUT_COLUMNS[layout]

  // distance: 8 で微小な移動をクリックと区別してからドラッグ開始する
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // col インデックスをキーに widgets を列単位で分割し、row 昇順にソートした配列
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
                    <WidgetContent widgetId={w.widgetId} widgetType={w.widgetType} />
                  </WidgetWrapper>
                ))}
              </DroppableColumn>
            </SortableContext>
          ))}
        </div>
      </DndContext>
    </div>
  )
}
