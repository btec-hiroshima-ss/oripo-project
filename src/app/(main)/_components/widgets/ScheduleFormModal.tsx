'use client'

import { useState, useEffect, useMemo, useTransition } from 'react'
import { X, RefreshCw, Calendar } from 'lucide-react'
import type { ScheduleEntry, ScheduleInput, RepeatScheduleInput, ScheduleUser, FacilityWithGroup } from '@/lib/schedule.types'
import type { RepeatType } from '@/lib/repeat'
import { decodeRepeatPattern } from '@/lib/repeat'
import { subDays } from 'date-fns'
import { toJstDateStr, toJstTimeStr } from '@/lib/jst'
import { getScheduleParticipantIdsAction, getScheduleUsersAction, getScheduleFacilityIdsAction, getFacilitiesAction } from '../../actions'
import UserPickerModal from './UserPickerModal'
import FacilityPickerModal from './FacilityPickerModal'

// 繰り返し曜日ラベル（日〜土）
const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']

type EditMode = 'normal' | 'repeatOne' | 'repeatAll'

type Props = {
  /** 編集時に渡す。undefined なら新規追加モード。 */
  schedule?: ScheduleEntry
  loginUserId?: number
  loginUserName?: string
  /**
   * 繰り返し子レコードの編集モード:
   *   'normal'    = 通常編集
   *   'repeatOne' = この予定のみ変更
   *   'repeatAll' = 全ての予定を変更（繰り返し種別・終了条件は変更不可）
   */
  editMode?: EditMode
  onClose: () => void
  onSave: (input: ScheduleInput | RepeatScheduleInput) => Promise<void>
}

export default function ScheduleFormModal({
  schedule,
  loginUserId = 0,
  loginUserName = '',
  editMode = 'normal',
  onClose,
  onSave,
}: Props) {
  const isEdit = schedule !== undefined
  const isRepeatAllMode = editMode === 'repeatAll'

  // 既存予定から初期値を設定
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

  // 繰り返し設定（新規のみ。既存予定の編集時は繰り返しパネルを非表示にする）
  const [showRepeatPanel, setShowRepeatPanel] = useState(false)
  const [repeatType, setRepeatType] = useState<'none' | RepeatType>('none')
  const [weekDays, setWeekDays] = useState<boolean[]>(new Array(7).fill(false))
  const [hasLimit, setHasLimit] = useState(false)
  const [limitStartDateStr, setLimitStartDateStr] = useState('')
  const [limitDateStr, setLimitDateStr] = useState('')

  // 期間で指定: 既存の期間予定（isAllDay かつ startDate !== endDate）を編集する場合は初期値を設定する
  const initialIsPeriod = !!(schedule?.isAllDay && schedule?.startDate.getTime() !== schedule?.endDate.getTime())
  const [isPeriod, setIsPeriod] = useState(initialIsPeriod)
  const [periodEndDateStr, setPeriodEndDateStr] = useState(() => {
    if (initialIsPeriod && schedule) {
      // end_date は exclusive（endDay+1 00:00 JST）→ 1日引いて表示用の inclusive end_day に変換
      const inclusiveEnd = subDays(schedule.endDate, 1)
      return toJstDateStr(inclusiveEnd)
    }
    return ''
  })

  // 参加ユーザー選択
  const [participantIds, setParticipantIds] = useState<Set<number>>(new Set())
  const [allUsers, setAllUsers] = useState<ScheduleUser[]>([])
  const [showUserPicker, setShowUserPicker] = useState(false)

  // 設備選択
  const [facilityIds, setFacilityIds] = useState<Set<number>>(new Set())
  const [allFacilities, setAllFacilities] = useState<FacilityWithGroup[]>([])
  const [showFacilityPicker, setShowFacilityPicker] = useState(false)

  const userNameMap = useMemo(() => new Map(allUsers.map((u) => [u.userId, u.fullName])), [allUsers])

  const participantDisplayText = useMemo(() => {
    const otherNames = Array.from(participantIds)
      .filter((id) => id !== loginUserId)
      .map((id) => userNameMap.get(id) ?? '')
      .filter(Boolean)
    const names = loginUserName ? [loginUserName, ...otherNames] : otherNames
    return names.join('、') || loginUserName
  }, [loginUserId, loginUserName, participantIds, userNameMap])

  const facilityNameMap = useMemo(() => new Map(allFacilities.map((f) => [f.facilityId, f.facilityName])), [allFacilities])
  const facilityDisplayText = useMemo(() => {
    return Array.from(facilityIds).map((id) => facilityNameMap.get(id) ?? '').filter(Boolean).join('、') || 'なし'
  }, [facilityIds, facilityNameMap])

  // 編集時: 既存参加者・設備を初期ロード
  useEffect(() => {
    getScheduleUsersAction().then(setAllUsers).catch(() => {})
    getFacilitiesAction().then(setAllFacilities).catch(() => {})
    if (isEdit && schedule) {
      getScheduleParticipantIdsAction(schedule.scheduleId)
        .then((ids) => setParticipantIds(new Set(ids)))
        .catch(() => {})
      getScheduleFacilityIdsAction(schedule.scheduleId)
        .then((ids) => setFacilityIds(new Set(ids)))
        .catch(() => {})
    }
  }, [isEdit, schedule?.scheduleId])
  // NOTE: schedule.scheduleId を deps に含める（schedule オブジェクト自体は毎回新規参照になる可能性がある）

  // 毎週タブ選択時: 開始日の曜日をデフォルトチェックする（仕様: 「デフォルトは開始日の曜日にチェック」）
  useEffect(() => {
    if (repeatType === 'weekly' && !weekDays.some(Boolean) && dateStr) {
      const [y, m, d] = dateStr.split('-').map(Number)
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
      const next = new Array(7).fill(false)
      next[dow] = true
      setWeekDays(next)
    }
  }, [repeatType, dateStr])
  // NOTE: weekDays は deps に含めない（チェック有り→「週」タブ再クリック時に上書きしないため）

  // 「全ての予定を変更」モードの場合、現在の繰り返しパターンをラベル表示のみに使う
  const repeatPatternLabel = useMemo(() => {
    if (!schedule || editMode !== 'repeatAll') return ''
    const decoded = decodeRepeatPattern(schedule.repeatPattern)
    if (decoded.repeatType === 'daily') return '毎日'
    if (decoded.repeatType === 'weekly') {
      const days = (decoded.weekDays ?? []).map((on, i) => on ? DOW_LABELS[i] : null).filter(Boolean)
      return `毎週（${days.join('・')}）`
    }
    if (decoded.repeatType === 'monthly') return `毎月${decoded.monthDay}日`
    return ''
  }, [schedule, editMode])

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'タイトルを入力してください'

    if (isRepeatAllMode) {
      // 全件変更: 時刻のみ検証（日付は使用しない）
      if (!startTime) errs.startTime = '開始時刻を入力してください'
      if (!endTime) errs.endTime = '終了時刻を入力してください'
      if (startTime && endTime && endTime <= startTime) {
        errs.endTime = '終了時刻は開始時刻より後にしてください'
      }
    } else if (isPeriod) {
      if (!dateStr) errs.date = '開始日を選択してください'
      if (!periodEndDateStr) errs.periodEndDate = '終了日を選択してください'
      if (dateStr && periodEndDateStr && periodEndDateStr < dateStr) {
        errs.periodEndDate = '終了日は開始日以降にしてください'
      }
    } else if (repeatType !== 'none') {
      if (!dateStr) errs.date = '開始日を選択してください'
      if (!startTime) errs.startTime = '開始時刻を入力してください'
      if (!endTime) errs.endTime = '終了時刻を入力してください'
      if (startTime && endTime && endTime <= startTime) {
        errs.endTime = '終了時刻は開始時刻より後にしてください'
      }
      if (repeatType === 'weekly' && !weekDays.some(Boolean)) {
        errs.weekDays = '曜日を1つ以上選択してください'
      }
      if (hasLimit && !limitStartDateStr) errs.limitStartDate = '繰り返し開始日を選択してください'
      if (hasLimit && limitStartDateStr && dateStr && limitStartDateStr < dateStr) {
        errs.limitStartDate = '繰り返し開始日はイベント開始日以降にしてください'
      }
      if (hasLimit && !limitDateStr) errs.limitDate = '繰り返し終了日を選択してください'
      if (hasLimit && limitStartDateStr && limitDateStr && limitDateStr < limitStartDateStr) {
        errs.limitDate = '繰り返し終了日は繰り返し開始日以降にしてください'
      }
    } else {
      // 通常
      if (!dateStr) errs.date = '日付を選択してください'
      if (!isAllDay) {
        if (!startTime) errs.startTime = '開始時刻を入力してください'
        if (!endTime) errs.endTime = '終了時刻を入力してください'
        if (startTime && endTime && endTime <= startTime) {
          errs.endTime = '終了時刻は開始時刻より後にしてください'
        }
      }
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    startTransition(async () => {
      if (isRepeatAllMode) {
        // 全ての予定を変更: 時刻のみ変更（日付は参照日として使用）
        const baseDate = schedule ? toJstDateStr(schedule.startDate) : (dateStr || '2000-01-01')
        const startDate = new Date(`${baseDate}T${startTime}:00+09:00`)
        const endDate = new Date(`${baseDate}T${endTime}:00+09:00`)
        const input: ScheduleInput = {
          name: name.trim(),
          note: note.trim() || undefined,
          place: place.trim() || undefined,
          startDate,
          endDate,
          isAllDay: false,
          publicFlag,
          participantIds: participantIds.size > 0 ? Array.from(participantIds) : undefined,
          facilityIds: facilityIds.size > 0 ? Array.from(facilityIds) : undefined,
        }
        await onSave(input)
      } else if (isPeriod) {
        // 期間で指定
        const startDate = new Date(dateStr + 'T00:00:00+09:00')
        const periodEndDate = new Date(periodEndDateStr + 'T00:00:00+09:00')
        const input: ScheduleInput = {
          name: name.trim(),
          note: note.trim() || undefined,
          place: place.trim() || undefined,
          startDate,
          endDate: startDate,
          isAllDay: true,
          publicFlag,
          participantIds: participantIds.size > 0 ? Array.from(participantIds) : undefined,
          periodEndDate,
          facilityIds: facilityIds.size > 0 ? Array.from(facilityIds) : undefined,
        }
        await onSave(input)
      } else if (repeatType !== 'none') {
        // 繰り返し予定
        const startDate = new Date(`${dateStr}T${startTime}:00+09:00`)
        const endDate = new Date(`${dateStr}T${endTime}:00+09:00`)
        const limitStartDate = hasLimit && limitStartDateStr
          ? new Date(limitStartDateStr + 'T00:00:00+09:00')
          : null
        const limitEndDate = hasLimit && limitDateStr
          ? new Date(limitDateStr + 'T00:00:00+09:00')
          : null
        const input: RepeatScheduleInput = {
          name: name.trim(),
          note: note.trim() || undefined,
          place: place.trim() || undefined,
          startDate,
          endDate,
          publicFlag,
          participantIds: participantIds.size > 0 ? Array.from(participantIds) : undefined,
          repeatType,
          weekDays: repeatType === 'weekly' ? weekDays : undefined,
          limitStartDate,
          limitEndDate,
          facilityIds: facilityIds.size > 0 ? Array.from(facilityIds) : undefined,
        }
        await onSave(input)
      } else {
        // 通常予定
        let startDate: Date, endDate: Date
        if (isAllDay) {
          startDate = new Date(dateStr + 'T00:00:00+09:00')
          endDate = startDate
        } else {
          startDate = new Date(`${dateStr}T${startTime}:00+09:00`)
          endDate = new Date(`${dateStr}T${endTime}:00+09:00`)
        }
        const input: ScheduleInput = {
          name: name.trim(),
          note: note.trim() || undefined,
          place: place.trim() || undefined,
          startDate,
          endDate,
          isAllDay,
          publicFlag,
          participantIds: participantIds.size > 0 ? Array.from(participantIds) : undefined,
          facilityIds: facilityIds.size > 0 ? Array.from(facilityIds) : undefined,
        }
        await onSave(input)
      }
    })
  }

  function publicFlagClass(flag: 'O' | 'P' | 'C'): string {
    const active = publicFlag === flag
    return `flex-1 py-1.5 text-xs font-medium border rounded transition-colors ${
      active
        ? 'bg-brand border-brand text-white'
        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
    }`
  }

  // 繰り返しボタンのラベル
  const repeatButtonLabel = (() => {
    let limitSuffix = ''
    if (hasLimit && limitStartDateStr && limitDateStr) {
      limitSuffix = `（${limitStartDateStr}〜${limitDateStr}）`
    } else if (hasLimit && limitDateStr) {
      limitSuffix = `（〜${limitDateStr}）`
    }
    if (repeatType === 'daily') return `毎日${limitSuffix}`
    if (repeatType === 'weekly') {
      const days = weekDays.map((on, i) => on ? DOW_LABELS[i] : null).filter(Boolean)
      const prefix = days.length > 0 ? `毎週（${days.join('・')}）` : '毎週'
      return `${prefix}${limitSuffix}`
    }
    if (repeatType === 'monthly') return `毎月${limitSuffix}`
    return '繰り返しなし'
  })()

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
            {isEdit
              ? (editMode === 'repeatOne' ? 'この予定のみ編集' : editMode === 'repeatAll' ? '全ての予定を編集' : '予定を編集')
              : '予定を追加'}
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

          {/* 全ての予定を変更モードの場合: 日付・終日・繰り返しパネルを非表示にし時刻のみ表示 */}
          {isRepeatAllMode ? (
            <>
              {/* 繰り返し種別の表示のみ（変更不可） */}
              <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span>{repeatPatternLabel || '繰り返し予定'}（変更不可）</span>
              </div>
              <p className="text-xs text-gray-400 -mt-2">
                各予定の日付はそのままで、時刻・タイトル・場所・内容を全て変更します
              </p>
              {/* 時刻 */}
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
                  {errors.startTime && <p className="mt-1 text-xs text-red-500">{errors.startTime}</p>}
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
                  {errors.endTime && <p className="mt-1 text-xs text-red-500">{errors.endTime}</p>}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* 終日トグル（期間で指定・繰り返し中は非表示） */}
              {!isPeriod && repeatType === 'none' && (
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
              )}

              {/* 日付・期間 */}
              {isPeriod ? (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      開始日 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={dateStr}
                      onChange={(e) => setDateStr(e.target.value)}
                      className="w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
                    />
                    {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date}</p>}
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      終了日 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={periodEndDateStr}
                      onChange={(e) => setPeriodEndDateStr(e.target.value)}
                      min={dateStr}
                      className="w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
                    />
                    {errors.periodEndDate && <p className="mt-1 text-xs text-red-500">{errors.periodEndDate}</p>}
                  </div>
                </div>
              ) : (
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
              )}

              {/* 時刻（終日・期間で指定以外） */}
              {!isAllDay && !isPeriod && (
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
                    {errors.startTime && <p className="mt-1 text-xs text-red-500">{errors.startTime}</p>}
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
                    {errors.endTime && <p className="mt-1 text-xs text-red-500">{errors.endTime}</p>}
                  </div>
                </div>
              )}

              {/* 繰り返し設定ボタン: 新規追加時のみ表示
                  既存予定の編集時は repeatPanel を出さない。通常予定を編集中に「繰り返し」を選択して
                  保存すると元のレコードを残したまま重複して新規繰り返しレコードが作成されるバグを防ぐ */}
              {!isEdit && editMode !== 'repeatOne' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {/* 繰り返しボタン */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isPeriod) setIsPeriod(false)
                        setShowRepeatPanel((prev) => !prev)
                      }}
                      className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 flex-1 ${
                        repeatType !== 'none'
                          ? 'border-brand text-brand bg-orange-50'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{repeatButtonLabel}</span>
                    </button>

                    {/* 期間で指定ボタン（繰り返し設定中・終日チェック中は非表示） */}
                    {repeatType === 'none' && !isAllDay && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsPeriod((prev) => !prev)
                          setShowRepeatPanel(false)
                          if (!isPeriod) {
                            setIsAllDay(false)
                            setStartTime('')
                            setEndTime('')
                          }
                        }}
                        className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 ${
                          isPeriod
                            ? 'border-brand text-brand bg-orange-50'
                            : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        期間で指定
                      </button>
                    )}
                  </div>

                  {/* 繰り返し設定パネル */}
                  {showRepeatPanel && (
                    <RepeatPanel
                      repeatType={repeatType}
                      weekDays={weekDays}
                      hasLimit={hasLimit}
                      limitStartDateStr={limitStartDateStr}
                      limitDateStr={limitDateStr}
                      dateStr={dateStr}
                      errors={errors}
                      onRepeatTypeChange={(type) => {
                        setRepeatType(type)
                        if (type === 'none') setShowRepeatPanel(false)
                      }}
                      onWeekDaysChange={setWeekDays}
                      onHasLimitChange={(v) => {
                        setHasLimit(v)
                        // AIPO 準拠: 終了日あり選択時、limitStartDate をイベント開始日で初期化する
                        if (v && !limitStartDateStr && dateStr) {
                          setLimitStartDateStr(dateStr)
                        }
                      }}
                      onLimitStartDateStrChange={setLimitStartDateStr}
                      onLimitDateStrChange={setLimitDateStr}
                    />
                  )}
                </div>
              )}
            </>
          )}

          {/* 参加ユーザー選択 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">参加ユーザー</label>
            <div className="flex items-center gap-2 flex-wrap">
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

          {/* 設備選択（Phase D） */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">設備</label>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-800">{facilityDisplayText}</span>
              <button
                type="button"
                onClick={() => setShowFacilityPicker(true)}
                className="text-xs text-brand border border-brand/50 rounded px-2 py-1 hover:bg-brand/5 shrink-0"
              >
                設備選択
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

          {/* 公開区分 */}
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

      {/* 参加ユーザーピッカー */}
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

      {/* 設備ピッカー（Phase D）*/}
      {showFacilityPicker && (
        <FacilityPickerModal
          facilities={allFacilities}
          selectedIds={facilityIds}
          scheduleId={schedule?.scheduleId}
          // 日時が入力済みの場合のみ空き確認を行う（終日・期間予定では日付のみのため確認しない）
          startDateIso={
            !isAllDay && !isPeriod && dateStr && startTime
              ? new Date(`${dateStr}T${startTime}:00+09:00`).toISOString()
              : undefined
          }
          endDateIso={
            !isAllDay && !isPeriod && dateStr && endTime
              ? new Date(`${dateStr}T${endTime}:00+09:00`).toISOString()
              : undefined
          }
          onConfirm={(ids) => {
            setFacilityIds(ids)
            setShowFacilityPicker(false)
          }}
          onClose={() => setShowFacilityPicker(false)}
        />
      )}
    </div>
  )
}

// ===========================================================
// 繰り返し設定パネル（サブコンポーネント）
// ===========================================================

type RepeatPanelProps = {
  repeatType: 'none' | RepeatType
  weekDays: boolean[]
  hasLimit: boolean
  limitStartDateStr: string
  limitDateStr: string
  dateStr: string
  errors: Record<string, string>
  onRepeatTypeChange: (type: 'none' | RepeatType) => void
  onWeekDaysChange: (days: boolean[]) => void
  onHasLimitChange: (v: boolean) => void
  onLimitStartDateStrChange: (s: string) => void
  onLimitDateStrChange: (s: string) => void
}

function RepeatPanel({
  repeatType,
  weekDays,
  hasLimit,
  limitStartDateStr,
  limitDateStr,
  dateStr,
  errors,
  onRepeatTypeChange,
  onWeekDaysChange,
  onHasLimitChange,
  onLimitStartDateStrChange,
  onLimitDateStrChange,
}: RepeatPanelProps) {
  const tabs: { value: 'none' | RepeatType; label: string }[] = [
    { value: 'none', label: 'なし' },
    { value: 'daily', label: '毎日' },
    { value: 'weekly', label: '毎週' },
    { value: 'monthly', label: '毎月' },
  ]

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50">
      {/* 繰り返しタイプ選択タブ */}
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onRepeatTypeChange(tab.value)}
            className={`flex-1 py-1 text-xs font-medium rounded border transition-colors ${
              repeatType === tab.value
                ? 'bg-brand border-brand text-white'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 毎月: 「毎月X日」ラベル（日付は開始日から自動計算。変更不可） */}
      {repeatType === 'monthly' && dateStr && (
        <p className="text-xs text-gray-700">
          毎月{parseInt(dateStr.split('-')[2], 10)}日
        </p>
      )}

      {/* 毎週: 曜日選択 */}
      {repeatType === 'weekly' && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">曜日を選択</p>
          <div className="flex gap-1">
            {DOW_LABELS.map((label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  const next = [...weekDays]
                  next[i] = !next[i]
                  onWeekDaysChange(next)
                }}
                className={`flex-1 py-1 text-xs rounded border transition-colors ${
                  weekDays[i]
                    ? 'bg-brand border-brand text-white'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {errors.weekDays && <p className="mt-1 text-xs text-red-500">{errors.weekDays}</p>}
        </div>
      )}

      {/* 繰り返し設定時のみ表示: 繰り返し期間（AIPO 準拠: 開始日〜終了日のペア） */}
      {repeatType !== 'none' && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">繰り返し期間</p>
          <div className="flex gap-2">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="radio"
                name="limitType"
                checked={!hasLimit}
                onChange={() => onHasLimitChange(false)}
                className="accent-brand"
              />
              終了日なし（2年分）
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="radio"
                name="limitType"
                checked={hasLimit}
                onChange={() => onHasLimitChange(true)}
                className="accent-brand"
              />
              終了日あり
            </label>
          </div>
          {hasLimit && (
            <div className="mt-2 space-y-1.5">
              {/* 繰り返し開始日（limit_start_date: AIPO 準拠） */}
              <input
                type="date"
                value={limitStartDateStr}
                onChange={(e) => onLimitStartDateStrChange(e.target.value)}
                min={dateStr}
                className="w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
                placeholder="繰り返し開始日"
              />
              {errors.limitStartDate && <p className="text-xs text-red-500">{errors.limitStartDate}</p>}
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <span className="px-2">〜</span>
              </div>
              {/* 繰り返し終了日（limit_end_date: AIPO 準拠） */}
              <input
                type="date"
                value={limitDateStr}
                onChange={(e) => onLimitDateStrChange(e.target.value)}
                min={limitStartDateStr || dateStr}
                className="w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
                placeholder="繰り返し終了日"
              />
              {errors.limitDate && <p className="text-xs text-red-500">{errors.limitDate}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
