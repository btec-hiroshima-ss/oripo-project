'use client'

import { useState, useEffect, useMemo, useTransition } from 'react'
import { X, RefreshCw } from 'lucide-react'
import type { ScheduleEntry, ScheduleInput, ScheduleUser } from '@/lib/schedule.types'
import { toJstDateStr, toJstTimeStr } from '@/lib/jst'
import { getScheduleParticipantIdsAction, getScheduleUsersAction } from '../../actions'
import UserPickerModal from './UserPickerModal'

type Props = {
  /** 編集時に渡す。null なら新規追加モード。 */
  schedule?: ScheduleEntry
  /** ログインユーザー ID（参加者表示の先頭に常時表示する作成者として使用） */
  loginUserId?: number
  /** ログインユーザー氏名 */
  loginUserName?: string
  onClose: () => void
  onSave: (input: ScheduleInput) => Promise<void>
  onShowRepeatToast: () => void
}

export default function ScheduleFormModal({ schedule, loginUserId = 0, loginUserName = '', onClose, onSave, onShowRepeatToast }: Props) {
  const isEdit = schedule !== undefined

  // 既存予定の値または初期値でフォームを初期化する
  const [name, setName] = useState(schedule?.name ?? '')
  const [isAllDay, setIsAllDay] = useState(schedule?.isAllDay ?? false)
  const [dateStr, setDateStr] = useState(
    schedule ? toJstDateStr(schedule.startDate) : ''
  )
  const [startTime, setStartTime] = useState(
    schedule && !schedule.isAllDay ? toJstTimeStr(schedule.startDate) : ''
  )
  const [endTime, setEndTime] = useState(
    schedule && !schedule.isAllDay ? toJstTimeStr(schedule.endDate) : ''
  )
  const [place, setPlace] = useState(schedule?.place ?? '')
  const [note, setNote] = useState(schedule?.note ?? '')
  const [publicFlag, setPublicFlag] = useState<'O' | 'P' | 'C'>(schedule?.publicFlag ?? 'O')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  // 参加ユーザー選択（Phase B）
  // participantIds: 選択中の参加者 ID セット（作成者自身も含む）
  const [participantIds, setParticipantIds] = useState<Set<number>>(new Set())
  const [allUsers, setAllUsers] = useState<ScheduleUser[]>([])
  const [showUserPicker, setShowUserPicker] = useState(false)

  // 全ユーザーリストとの突合で参加者名を表示するためのマップ
  const userNameMap = useMemo(() => new Map(allUsers.map((u) => [u.userId, u.fullName])), [allUsers])

  // 参加者表示テキスト（AIPO 準拠: 作成者名を先頭に、追加参加者名をカンマ区切りで続ける）
  const participantDisplayText = useMemo(() => {
    const otherNames = Array.from(participantIds)
      .filter((id) => id !== loginUserId)
      .map((id) => userNameMap.get(id) ?? '')
      .filter(Boolean)
    const names = loginUserName ? [loginUserName, ...otherNames] : otherNames
    return names.join('、') || loginUserName
  }, [loginUserId, loginUserName, participantIds, userNameMap])

  // 編集時: 既存参加者を初期ロードする
  useEffect(() => {
    getScheduleUsersAction().then(setAllUsers).catch(() => {})
    if (isEdit && schedule) {
      getScheduleParticipantIdsAction(schedule.scheduleId)
        .then((ids) => setParticipantIds(new Set(ids)))
        .catch(() => {})
    }
  }, [isEdit, schedule?.scheduleId])
  // NOTE: schedule.scheduleId を deps に含める（schedule オブジェクト自体は毎回新規参照になる可能性がある）

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'タイトルを入力してください'
    if (!dateStr) errs.date = '日付を選択してください'
    if (!isAllDay) {
      if (!startTime) errs.startTime = '開始時刻を入力してください'
      if (!endTime) errs.endTime = '終了時刻を入力してください'
      if (startTime && endTime && endTime <= startTime) {
        errs.endTime = '終了時刻は開始時刻より後にしてください'
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    let startDate: Date, endDate: Date
    if (isAllDay) {
      // all-day は AIPO 準拠で start_date = end_date = その日 00:00:00 JST
      startDate = new Date(dateStr + 'T00:00:00+09:00')
      endDate = startDate
    } else {
      startDate = new Date(dateStr + 'T' + startTime + ':00+09:00')
      endDate = new Date(dateStr + 'T' + endTime + ':00+09:00')
    }

    const input: ScheduleInput = {
      name: name.trim(),
      note: note.trim() || undefined,
      place: place.trim() || undefined,
      startDate,
      endDate,
      isAllDay,
      publicFlag,
      // participantIds が空の場合は undefined（addSchedule 側で作成者のみ登録される）
      participantIds: participantIds.size > 0 ? Array.from(participantIds) : undefined,
    }

    startTransition(async () => {
      await onSave(input)
    })
  }

  // 公開区分ボタンのスタイル（3択トグル）
  function publicFlagClass(flag: 'O' | 'P' | 'C'): string {
    const active = publicFlag === flag
    return `flex-1 py-1.5 text-xs font-medium border rounded transition-colors ${
      active
        ? 'bg-brand border-brand text-white'
        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
    }`
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <span className="font-semibold text-gray-800">
            {isEdit ? '予定を編集' : '予定を追加'}
          </span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded p-0.5"
            aria-label="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* フォーム（スクロール可） */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* タイトル */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={99}
              placeholder="予定のタイトル"
              // 16px 以上: iOS Safari の自動ズームを防ぐ
              className="w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* 終日トグル */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAllDay}
                onChange={(e) => setIsAllDay(e.target.checked)}
                className="w-4 h-4 accent-brand"
              />
              <span className="text-sm text-gray-700">終日</span>
            </label>
          </div>

          {/* 日付 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              日付 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
            />
            {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date}</p>}
          </div>

          {/* 時刻（終日 OFF 時のみ） */}
          {!isAllDay && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  開始時刻 <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
                />
                {errors.startTime && (
                  <p className="mt-1 text-xs text-red-500">{errors.startTime}</p>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  終了時刻 <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
                />
                {errors.endTime && (
                  <p className="mt-1 text-xs text-red-500">{errors.endTime}</p>
                )}
              </div>
            </div>
          )}

          {/* 繰り返しなしボタン（Phase C で実装予定。タップすると案内トーストを表示） */}
          <button
            type="button"
            onClick={onShowRepeatToast}
            className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 w-full"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            繰り返しなし
          </button>

          {/* 参加ユーザー選択（AIPO 準拠: 参加者名を常時表示 + 選択ボタン） */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">参加ユーザー</label>
            <div className="flex items-center gap-2 flex-wrap">
              {/* 作成者名 + 参加者名をカンマ区切りで表示（未ロード時は作成者名のみ） */}
              <span className="text-sm text-gray-800">{participantDisplayText}</span>
              <button
                type="button"
                onClick={() => setShowUserPicker(true)}
                className="text-xs text-brand border border-brand/50 rounded px-2 py-1 hover:bg-brand/5 shrink-0"
              >
                参加ユーザー選択
              </button>
            </div>
          </div>

          {/* 場所 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">場所</label>
            <input
              type="text"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              maxLength={99}
              placeholder="場所（任意）"
              className="w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
            />
          </div>

          {/* 内容 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">内容</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="内容（任意）"
              className="w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand resize-none"
            />
          </div>

          {/* 公開区分（3択トグル） */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">公開区分</label>
            <div className="flex gap-1">
              <button type="button" className={publicFlagClass('O')} onClick={() => setPublicFlag('O')}>
                公開
              </button>
              <button type="button" className={publicFlagClass('P')} onClick={() => setPublicFlag('P')}>
                非公開
              </button>
              <button type="button" className={publicFlagClass('C')} onClick={() => setPublicFlag('C')}>
                完全に隠す
              </button>
            </div>
          </div>
        </form>

        {/* フッター */}
        <div className="px-5 pb-4 pt-3 border-t border-gray-100 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-dark disabled:opacity-50"
          >
            {isPending ? '保存中...' : isEdit ? '更新' : '追加'}
          </button>
        </div>
      </div>

      {/* 参加ユーザーピッカーモーダル（フォーム用: 自分自身も選択解除可能） */}
      {showUserPicker && (
        <UserPickerModal
          selectedIds={participantIds}
          onConfirm={(ids) => {
            setParticipantIds(ids)
            setShowUserPicker(false)
          }}
          onClose={() => setShowUserPicker(false)}
        />
      )}
    </div>
  )
}
