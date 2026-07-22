'use client'

import { X, MapPin, FileText, Eye } from 'lucide-react'
import type { ScheduleEntry } from '@/lib/schedule.types'

type Props = {
  schedule: ScheduleEntry
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}

// UTC Date → "YYYY年MM月DD日（曜日）"（JST）
function formatJstDate(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  const y = jst.getUTCFullYear()
  const m = jst.getUTCMonth() + 1
  const d = jst.getUTCDate()
  const dow = ['日', '月', '火', '水', '木', '金', '土'][jst.getUTCDay()]
  return `${y}年${m}月${d}日（${dow}）`
}

// UTC Date → "HH:MM"（JST）
function formatJstTime(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  const h = String(jst.getUTCHours()).padStart(2, '0')
  const mn = String(jst.getUTCMinutes()).padStart(2, '0')
  return `${h}:${mn}`
}

const PUBLIC_FLAG_LABEL: Record<'O' | 'P' | 'C', string> = {
  O: '公開',
  P: '非公開',
  C: '完全に隠す',
}

export default function ScheduleDetailModal({ schedule, onClose, onEdit, onDelete }: Props) {
  // 繰り返し子レコードは Phase C まで編集・削除不可
  const isRepeatChild = schedule.parentId > 0
  const canEdit = schedule.isOwner && !isRepeatChild

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            {/* タイトル */}
            <h2 className="font-semibold text-gray-900 text-base leading-snug break-words pr-2">
              {schedule.name}
            </h2>
            {/* 日時 */}
            <p className="text-sm text-gray-500 mt-1">
              {schedule.isAllDay
                ? formatJstDate(schedule.startDate)
                : `${formatJstDate(schedule.startDate)} ${formatJstTime(schedule.startDate)}〜${formatJstTime(schedule.endDate)}`
              }
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded p-0.5 shrink-0"
            aria-label="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 詳細 */}
        <div className="px-5 py-4 space-y-3">
          {/* 場所 */}
          {schedule.place && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <p className="text-sm text-gray-700 break-words">{schedule.place}</p>
            </div>
          )}

          {/* 内容 */}
          {schedule.note && (
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{schedule.note}</p>
            </div>
          )}

          {/* 公開区分 */}
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-gray-400 shrink-0" />
            <p className="text-sm text-gray-500">{PUBLIC_FLAG_LABEL[schedule.publicFlag]}</p>
          </div>

          {/* 繰り返し予定の案内（Phase C で編集対応） */}
          {isRepeatChild && (
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
              繰り返し予定です（編集は Phase C で対応予定）
            </p>
          )}
        </div>

        {/* フッター */}
        <div className="px-5 pb-4 flex gap-2">
          {canEdit && (
            <>
              <button
                onClick={onDelete}
                className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
              >
                削除
              </button>
              <button
                onClick={onEdit}
                className="flex-1 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-dark"
              >
                編集
              </button>
            </>
          )}
          {!canEdit && (
            <button
              onClick={onClose}
              className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              閉じる
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
