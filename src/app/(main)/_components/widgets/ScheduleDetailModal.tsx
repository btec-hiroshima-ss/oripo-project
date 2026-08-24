'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { ScheduleEntry, ScheduleDetail } from '@/lib/schedule.types'
import { getScheduleDetailAction } from '../../actions'
import { toJstDateJa, toJstTimeStr, formatJstDatetime } from '@/lib/jst'

// 詳細モーダルは他ユーザーの予定閲覧専用。自分の予定はクリック時に直接編集フォームが開く（AIPO準拠）。
type Props = {
  schedule: ScheduleEntry
  onClose: () => void
}

const PUBLIC_FLAG_LABEL: Record<'O' | 'P' | 'C', string> = {
  O: '公開（スケジュールを全員に公開します）',
  P: '非公開',
  C: '完全に隠す',
}

export default function ScheduleDetailModal({ schedule, onClose }: Props) {
  const [detail, setDetail] = useState<ScheduleDetail | null>(null)

  useEffect(() => {
    getScheduleDetailAction(schedule.scheduleId).then(setDetail).catch(() => {})
  }, [schedule.scheduleId])

  const dateTimeText = schedule.isAllDay
    ? toJstDateJa(schedule.startDate)
    : `${toJstTimeStr(schedule.startDate)}〜${toJstTimeStr(schedule.endDate)}`

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-full bg-brand shrink-0" />
            <h2 className="font-semibold text-gray-900 text-base leading-snug truncate">
              スケジュール詳細
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded p-0.5 shrink-0"
            aria-label="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 詳細フィールド */}
        <div className="px-5 py-4 space-y-3 text-sm">
          <Row label="タイトル" value={schedule.name} />
          <Row label="日時" value={dateTimeText} />
          {schedule.place && <Row label="場所" value={schedule.place} />}
          {schedule.note && <Row label="内容" value={schedule.note} multiline />}
          <Row label="公開区分" value={PUBLIC_FLAG_LABEL[schedule.publicFlag]} />
          {detail && (
            <>
              {detail.participantNames.length > 0 && (
                <Row label="参加ユーザー" value={detail.participantNames.join('、')} />
              )}
              {/* 予約設備: 1件以上ある場合のみ表示（Phase D） */}
              {detail.facilityNames.length > 0 && (
                <Row label="予約設備" value={detail.facilityNames.join('、')} />
              )}
              <Row label="登録者" value={`${detail.creatorName}（${formatJstDatetime(detail.creatorDateJst)}）`} />
              <Row label="更新者" value={`${detail.updaterName}（${formatJstDatetime(detail.updaterDateJst)}）`} />
            </>
          )}

        </div>

        {/* フッターボタン（閲覧専用: 閉じるのみ） */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-dark"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className="w-20 shrink-0 text-gray-500">{label}</span>
      <span className={`text-gray-800 flex-1 min-w-0 ${multiline ? 'whitespace-pre-wrap break-words' : 'break-words'}`}>
        {value}
      </span>
    </div>
  )
}
