'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { ScheduleEntry, ScheduleDetail } from '@/lib/schedule.types'
import { getScheduleDetailAction } from '../../actions'
import { toJstDateJa, toJstTimeStr, formatJstDatetime } from '@/lib/jst'

type DeleteScope = 'single' | 'all' | 'participants' | 'repeatOne' | 'repeatAll'
type EditMode = 'normal' | 'repeatOne' | 'repeatAll'

type Props = {
  schedule: ScheduleEntry
  onClose: () => void
  onEdit: (mode: EditMode) => void
  onDelete: (scope: DeleteScope) => void
  onCopy: () => void
}

const PUBLIC_FLAG_LABEL: Record<'O' | 'P' | 'C', string> = {
  O: '公開（スケジュールを全員に公開します）',
  P: '非公開',
  C: '完全に隠す',
}

// 通常予定（繰り返しなし・繰り返し親）の削除選択肢
const NORMAL_DELETE_OPTIONS: { value: DeleteScope; label: string }[] = [
  { value: 'single', label: 'この予定のみを削除します' },
  { value: 'all', label: 'この予定を完全に削除します' },
  { value: 'participants', label: '参加ユーザー全員の予定を削除します' },
]

export default function ScheduleDetailModal({ schedule, onClose, onEdit, onDelete, onCopy }: Props) {
  const [detail, setDetail] = useState<ScheduleDetail | null>(null)
  const [deleteScope, setDeleteScope] = useState<DeleteScope>('single')
  // 繰り返し子の場合は削除スコープを repeatOne/repeatAll で持つ
  const [repeatDeleteScope, setRepeatDeleteScope] = useState<'repeatOne' | 'repeatAll'>('repeatOne')

  const isRepeatChild = schedule.parentId > 0
  const canEdit = schedule.isOwner

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
              <Row label="登録者" value={`${detail.creatorName}（${formatJstDatetime(detail.creatorDateJst)}）`} />
              <Row label="更新者" value={`${detail.updaterName}（${formatJstDatetime(detail.updaterDateJst)}）`} />
            </>
          )}

          {/* 繰り返し子レコード: 削除スコープ選択 */}
          {isRepeatChild && canEdit && (
            <div className="pt-2">
              <p className="text-xs text-gray-500 mb-2">削除する場合の条件</p>
              <div className="space-y-1.5">
                {(
                  [
                    { value: 'repeatOne', label: 'この予定のみを削除します' },
                    { value: 'repeatAll', label: '全ての繰り返し予定を削除します' },
                  ] as { value: 'repeatOne' | 'repeatAll'; label: string }[]
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer ${
                      repeatDeleteScope === opt.value
                        ? 'border-brand bg-orange-50 text-brand'
                        : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="repeatDeleteScope"
                      value={opt.value}
                      checked={repeatDeleteScope === opt.value}
                      onChange={() => setRepeatDeleteScope(opt.value)}
                      className="accent-brand"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 通常予定（繰り返しなし）: 削除スコープ選択 */}
          {!isRepeatChild && canEdit && (
            <div className="pt-2">
              <p className="text-xs text-gray-500 mb-2">削除する場合の条件</p>
              <div className="space-y-1.5">
                {NORMAL_DELETE_OPTIONS.map((opt) => (
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
          {canEdit && isRepeatChild ? (
            // 繰り返し子レコード: この予定のみ変更 / 全て変更
            <>
              <button
                onClick={() => onEdit('repeatOne')}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                この予定のみ変更
              </button>
              <button
                onClick={() => onEdit('repeatAll')}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                全ての予定を変更
              </button>
              <button
                onClick={() => onDelete(repeatDeleteScope)}
                className="px-3 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600"
              >
                削除する
              </button>
            </>
          ) : canEdit ? (
            // 通常予定
            <>
              <button
                onClick={() => onEdit('normal')}
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
