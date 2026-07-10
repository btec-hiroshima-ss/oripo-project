'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { X } from 'lucide-react'
import { WIDGET_LABELS, type WidgetType } from '@/lib/pages.types'
import { deleteWidgetAction } from '../actions'

type Props = {
  widgetId: number
  widgetType: WidgetType
  children: React.ReactNode
}

export default function WidgetWrapper({ widgetId, widgetType, children }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: widgetId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-lg border border-gray-200 overflow-hidden"
    >
      {/* ヘッダー全体をD&Dハンドルにする（デスクトップのみ）。
          削除ボタンは onPointerDown を止めてドラッグのトリガーを防ぐ。 */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center gap-1 px-3 py-2 bg-gray-50 border-b border-gray-200 lg:cursor-grab lg:active:cursor-grabbing touch-none"
      >
        <span className="flex-1 text-sm font-medium text-gray-700">
          {WIDGET_LABELS[widgetType]}
        </span>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={async () => {
            if (confirm(`「${WIDGET_LABELS[widgetType]}」をこのページから削除しますか？`)) {
              await deleteWidgetAction(widgetId)
            }
          }}
          className="text-gray-400 hover:text-red-500 p-0.5 rounded"
          aria-label="削除"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div>{children}</div>
    </div>
  )
}
