'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useState } from 'react'
import { WIDGET_LABELS, type WidgetType } from '@/lib/pages.types'
import { deleteWidgetAction } from '../actions'

type Props = {
  widgetId: number
  widgetType: WidgetType
  isDragEnabled: boolean
  children: React.ReactNode
}

export default function WidgetWrapper({ widgetId, widgetType, isDragEnabled, children }: Props) {
  const [minimized, setMinimized] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: widgetId, disabled: !isDragEnabled })

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
      <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 border-b border-gray-200">
        {isDragEnabled && (
          <button
            {...attributes}
            {...listeners}
            className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
            aria-label="移動"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <span className="flex-1 text-sm font-medium text-gray-700">
          {WIDGET_LABELS[widgetType]}
        </span>
        <button
          onClick={() => setMinimized((v) => !v)}
          className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
          aria-label={minimized ? '展開' : '最小化'}
        >
          {minimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
        <button
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
      {!minimized && <div>{children}</div>}
    </div>
  )
}
