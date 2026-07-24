'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { ScheduleEntry } from '@/lib/schedule.types'
import type { ScheduleDetail } from '@/lib/schedule.types'
import { getScheduleDetailAction } from '../../actions'

type DeleteScope = 'single' | 'all' | 'participants'

type Props = {
  schedule: ScheduleEntry
  onClose: () => void
  onEdit: () => void
  /** 削除スコープを受け取る。"single"=この予定のみ、"all"=完全に削除、"participants"=参加ユーザー全員の予定を削除 */
  onDelete: (scope: DeleteScope) => void
  onCopy: () => void
}

// UTC Date → "YYYY年M月D日（曜日）"（JST）
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
  return `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`
}

// JST 文字列 "YYYY-MM-DD" または "YYYY-MM-DD HH:MM:SS" → "YYYY年M月D日" / "YYYY年M月D日 H時MM分"
// create_date は date 型（時刻なし）、update_date は timestamp 型（時刻あり）のため両方に対応する。
// Server Action から Date を返すと JSON シリアライズで文字列になるため JST 文字列のまま受け取る。
function formatJstDatetime(jstStr: string): string {
  const parts = jstStr.split(' ')
  const [y, m, d] = parts[0].split('-').map(Number)
  if (parts.length === 1) {
    return `${y}年${m}月${d}日`
  }
  const [h, mn] = parts[1].split(':').map(Number)
  return `${y}年${m}月${d}日 ${h}時${String(mn).padStart(2, '0')}分`
}

const PUBLIC_FLAG_LABEL: Record<'O' | 'P' | 'C', string> = {
  O: '公開（スケジュールを全員に公開します）',
  P: '非公開',
  C: '完全に隠す',
}

const DELETE_OPTIONS: { value: DeleteScope; label: string }[] = [
  { value: 'single', label: 'この予定のみを削除します' },
  { value: 'all', label: 'この予定を完全に削除します' },
  { value: 'participants', label: '参加ユーザー全員の予定を削除します' },
]

export default function ScheduleDetailModal({ schedule, onClose, onEdit, onDelete, onCopy }: Props) {
  const [detail, setDetail] = useState<ScheduleDetail | null>(null)
  const [deleteScope, setDeleteScope] = useState<DeleteScope>('single')

  // 繰り返し子レコードは Phase C まで編集・削除不可
  const isRepeatChild = schedule.parentId > 0
  const canEdit = schedule.isOwner && !isRepeatChild

  useEffect(() => {
    getScheduleDetailAction(schedule.scheduleId).then(setDetail).catch(() => {})
  }, [schedule.scheduleId])

  const dateTimeText = schedule.isAllDay
    ? formatJstDate(schedule.startDate)
    : `${formatJstTime(schedule.startDate)}〜${formatJstTime(schedule.endDate)}`

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
              <Row label="登録者" value={`${detail.creatorName}（${formatJstDatetime(detail.creatorDateJst)}）`} />
              <Row label="更新者" value={`${detail.updaterName}（${formatJstDatetime(detail.updaterDateJst)}）`} />
            </>
          )}

          {/* 繰り返し予定の案内（Phase C で編集対応） */}
          {isRepeatChild && (
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
              繰り返し予定です（編集は Phase C で対応予定）
            </p>
          )}

          {/* 削除する場合の条件（owner のみ表示） */}
          {canEdit && (
            <div className="pt-2">
              <p className="text-xs text-gray-500 mb-2">削除する場合の条件</p>
              <div className="space-y-1.5">
                {DELETE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer ${
                      deleteScope === opt.value
                        ? 'border-brand bg-orange-50 text-brand'
                        : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deleteScope"
                      value={opt.value}
                      checked={deleteScope === opt.value}
                      onChange={() => setDeleteScope(opt.value)}
                      className="accent-brand"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* フッターボタン */}
        <div className="px-5 pb-5 flex gap-2 flex-wrap">
          {canEdit ? (
            <>
              <button
                onClick={onEdit}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                編集する
              </button>
              <button
                onClick={() => onDelete(deleteScope)}
                className="px-3 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600"
              >
                削除する
              </button>
              <button
                onClick={onCopy}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                コピーして登録する
              </button>
            </>
          ) : null}
          <button
            onClick={onClose}
            className={`px-3 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-dark ${canEdit ? '' : 'flex-1'}`}
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
