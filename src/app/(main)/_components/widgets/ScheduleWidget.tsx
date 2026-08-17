'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import {
  getWeekSchedulesMultiAction,
  getDaySchedulesAction,
  getMonthSchedulesAction,
  getLoginUserIdAction,
  addScheduleAction,
  updateScheduleAction,
  deleteScheduleAction,
  addRepeatScheduleAction,
  updateRepeatOneAction,
  updateRepeatAllAction,
  deleteRepeatOneAction,
  deleteRepeatAllAction,
  getHolidaysAction,
  getWidgetSettingsAction,
  saveWidgetSettingsAction,
  getMobileWidgetSettingsAction,
  saveMobileWidgetSettingsAction,
  getMyGroupsAction,
  getGroupListAction,
  getGroupMembersAction,
  getScheduleUsersAction,
} from '../../actions'
import type { ScheduleInput, RepeatScheduleInput, MultiUserScheduleEntry, ScheduleGroup, ScheduleUser } from '@/lib/schedule.types'
import { MAX_USERS, HOUR_PX, MIN_BLOCK_PX, DOW_JA, USER_COLORS, PUBLIC_FLAG_COLORS } from '@/lib/schedule.constants'
import ScheduleFormModal from './ScheduleFormModal'
import ScheduleDetailModal from './ScheduleDetailModal'
import ScheduleDayView from './ScheduleDayView'
import ScheduleMonthView from './ScheduleMonthView'
import ScheduleListView from './ScheduleListView'
import { Toast, Loading } from '../ui'
import { toJstDateStr, toJstTimeStr, isTodayJst, toJstMinutesSinceMidnight } from '@/lib/jst'

// ===========================================================
// 日付ユーティリティ（ウィジェット固有）
// ===========================================================

/** "YYYY-MM-DD" に days を加算した "YYYY-MM-DD" を返す */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const result = new Date(Date.UTC(y, m - 1, d + days))
  const yr = result.getUTCFullYear()
  const mo = String(result.getUTCMonth() + 1).padStart(2, '0')
  const dy = String(result.getUTCDate()).padStart(2, '0')
  return `${yr}-${mo}-${dy}`
}

/** 指定 Date の週の日曜日を "YYYY-MM-DD"（JST）で返す（AIPO準拠: 週は日曜始まり） */
function getSunday(date: Date): string {
  const dateStr = toJstDateStr(date)
  const [y, m, d] = dateStr.split('-').map(Number)
  // UTC 基準で曜日を算出（日付のみで時刻なし）
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=日, 1=月, ..., 6=土
  return addDays(dateStr, -dow) // 日曜=0 はそのまま、月曜=1 は1日戻す、...
}

/** weekStart から 7 日分の "YYYY-MM-DD" 配列を返す */
function getWeekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

/** "YYYY-MM-DD" → "YYYY年M月D日（曜日）" */
function formatJapaneseDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const DOW_ALL = ['日', '月', '火', '水', '木', '金', '土']
  return `${y}年${m}月${d}日（${DOW_ALL[dow]}）`
}

/** "YYYY-MM-DD" に months を加算した "YYYY-MM-01" を返す（月ビューの月送り用） */
function addMonth(dateStr: string, months: number): string {
  const [y, m] = dateStr.split('-').map(Number)
  const result = new Date(Date.UTC(y, m - 1 + months, 1))
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-01`
}

/**
 * 週ビュー列インデックスに対応するテキストカラークラス（日曜始まり: 0=日、6=土）
 * 月ビューと同じ配色（日=赤、土=青）を維持する
 */
function dayTextColor(dowIndex: number): string {
  if (dowIndex === 0) return 'text-red-600'  // 日
  if (dowIndex === 6) return 'text-blue-600' // 土
  return 'text-gray-700'
}

type PositionedSchedule = MultiUserScheduleEntry & {
  colIndex: number  // 重複グループ内の横位置（0 始まり）
  colCount: number  // 重複グループの列数
  colorClass: string // ユーザーごとのプリセット色クラス
}

/**
 * 同一日カラムの予定に横並び位置と色クラスを割り当てる。
 * isMultiUser=true の場合はユーザー別プリセット色、false の場合は公開区分色を使用する。
 */
function positionSchedules(
  schedules: MultiUserScheduleEntry[],
  userColorMap: Map<number, string>,
  isMultiUser: boolean
): PositionedSchedule[] {
  const sorted = [...schedules].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  const slotEndTimes: Date[] = []
  const positioned: (MultiUserScheduleEntry & { colIndex: number })[] = []

  for (const s of sorted) {
    const slot = slotEndTimes.findIndex((end) => end <= s.startDate)
    const colIndex = slot === -1 ? slotEndTimes.length : slot
    if (slot === -1) {
      slotEndTimes.push(s.endDate)
    } else {
      if (s.endDate > slotEndTimes[slot]) slotEndTimes[slot] = s.endDate
    }
    positioned.push({ ...s, colIndex })
  }

  const colCount = slotEndTimes.length
  return positioned.map((s) => ({
    ...s,
    colCount,
    // 単独ユーザー表示: 公開区分（P=グレー、C=ダークグレー）で視覚的に区別する
    // マルチユーザー表示: ユーザーごとのプリセット色を使用する
    colorClass: isMultiUser
      ? (userColorMap.get(s.viewUserId) ?? USER_COLORS[0])
      : (PUBLIC_FLAG_COLORS[s.publicFlag as 'O' | 'P' | 'C'] ?? USER_COLORS[0]),
  }))
}

// ===========================================================
// ScheduleBlock コンポーネント
// ===========================================================

type ScheduleBlockProps = {
  schedule: PositionedSchedule
  onClick: () => void
}

function ScheduleBlock({ schedule, onClick }: ScheduleBlockProps) {
  const startMin = toJstMinutesSinceMidnight(schedule.startDate)
  // all-day（start=end 00:00）はこの関数では呼ばれないが念のため 24h 分に収める
  const endMin = Math.min(toJstMinutesSinceMidnight(schedule.endDate), 24 * 60)
  const top = (startMin / 60) * HOUR_PX
  const height = Math.max(MIN_BLOCK_PX, ((endMin - startMin) / 60) * HOUR_PX)

  const widthPct = 100 / schedule.colCount
  const leftPct = (schedule.colIndex / schedule.colCount) * 100

  const colorClass = schedule.colorClass

  return (
    <button
      type="button"
      className={`absolute rounded px-0.5 py-0.5 text-left overflow-hidden hover:opacity-90 transition-opacity ${colorClass}`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `calc(${leftPct}% + 1px)`,
        width: `calc(${widthPct}% - 2px)`,
      }}
      onClick={onClick}
      title={schedule.name}
      aria-label={`${schedule.name} ${toJstTimeStr(schedule.startDate)}`}
    >
      <span className="text-xs font-medium block truncate leading-tight">{schedule.name}</span>
      {height >= 30 && (
        <span className="text-xs opacity-90 block truncate leading-tight">
          {toJstTimeStr(schedule.startDate)}
        </span>
      )}
    </button>
  )
}

// ===========================================================
// ScheduleWidget メインコンポーネント
// ===========================================================

type ViewMode = 'week' | 'day' | 'month' | 'list'

type ScheduleWidgetSettings = {
  // AIPO 準拠: 週・日グループビューのグループフィルター（null = 自分のみ）
  weekDayGroupId?: number | null
  viewMode?: ViewMode
  viewDate?: string
}

// isMobileView=true の場合はモバイル専用テーブル（oripo_mobile_widget_settings）を使う。
// PC版のページ構成（oripo_page_widgets）と独立しているため、PCからウィジェットを削除しても
// モバイルでの選択ユーザー設定が失われない。
export default function ScheduleWidget({ widgetId, isMobileView }: { widgetId?: number; isMobileView?: boolean }) {
  const [weekStart, setWeekStart] = useState<string>(() => getSunday(new Date()))
  // 日/月ビューの基準日（YYYY-MM-DD JST）。週ビューの weekStart とは独立して管理する。
  const [viewDate, setViewDate] = useState<string>(() => toJstDateStr(new Date()))
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [schedules, setSchedules] = useState<MultiUserScheduleEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // 他ユーザー所有の予定詳細モーダル（閲覧専用）
  const [selectedSchedule, setSelectedSchedule] = useState<MultiUserScheduleEntry | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<MultiUserScheduleEntry | null>(null)
  // 繰り返し子の編集モード（'normal' | 'repeatOne' | 'repeatAll'）
  const [repeatEditMode, setRepeatEditMode] = useState<'normal' | 'repeatOne' | 'repeatAll'>('normal')
  // AIPO準拠: 繰り返し子をクリックした際に「この予定のみ / 全件変更」を選ばせるダイアログ用
  const [repeatModeSchedule, setRepeatModeSchedule] = useState<MultiUserScheduleEntry | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  // 一覧ビューの再フェッチトリガー: 追加/更新/削除後にインクリメントする
  const [listRefreshKey, setListRefreshKey] = useState(0)
  // 祝日データ: 初回マウント時に外部APIから取得しキャッシュ済みのものを受け取る
  const [holidays, setHolidays] = useState<Record<string, string>>({})

  // loginUserId: マウント時に getLoginUserIdAction で取得。null の間はスケジュール取得をスキップ。
  const [loginUserId, setLoginUserId] = useState<number | null>(null)
  const [loginUserName, setLoginUserName] = useState<string>('')

  // 週・日グループビュー（AIPO oneday-group/weekly-group 準拠）:
  // 1段グループセレクトでグループを選択 → グループ全員を別列で並列表示する。
  // null = 自分のみ表示（AIPO のデフォルト状態と同じ）。
  const [weekDayGroupId, setWeekDayGroupId] = useState<number | null>(null)
  // ログインユーザーが所属するグループのみ（AIPO getMyGroups 相当）
  const [weekDayGroups, setWeekDayGroups] = useState<ScheduleGroup[]>([])
  // 選択グループのメンバー一覧（グループ切替時に取得）
  const [weekDayGroupUsers, setWeekDayGroupUsers] = useState<ScheduleUser[]>([])

  // 月・一覧ビュー（AIPO monthly/list 準拠）:
  // 2段ドロップダウン（グループ選択→ユーザー選択）で単一ユーザーの予定を表示する。
  const [nonWeekTargetUserId, setNonWeekTargetUserId] = useState<number | null>(null)
  const [nonWeekGroups, setNonWeekGroups] = useState<ScheduleGroup[]>([])
  const [nonWeekGroupId, setNonWeekGroupId] = useState<number | null>(null)
  const [nonWeekAllUsers, setNonWeekAllUsers] = useState<ScheduleUser[]>([])
  const [nonWeekGroupUsers, setNonWeekGroupUsers] = useState<ScheduleUser[]>([])

  // カレンダーコンテナ: 初期スクロール位置を 8:00 に合わせるため ref を保持
  const calendarRef = useRef<HTMLDivElement>(null)
  const scrolledRef = useRef(false)
  // 初期化完了フラグ: DB から settings を復元した後にのみ自動保存を許可する
  const hasInitializedRef = useRef(false)

  // 週・日ビューの表示ユーザー ID リスト（グループ選択から導出）
  const weekDayUserIds = weekDayGroupId === null
    ? (loginUserId !== null ? [loginUserId] : [])
    : weekDayGroupUsers.map((u) => u.userId)

  // 週・日ビューでグループメンバーが複数いる場合にマルチカラー表示を有効にする
  const isMultiUser = (viewMode === 'week' || viewMode === 'day') && weekDayUserIds.length > 1

  // viewUserIds の順番に対応するプリセット色マップ
  const userColorMap = new Map<number, string>(
    weekDayUserIds.map((uid, i) => [uid, USER_COLORS[i % USER_COLORS.length]])
  )
  // userId → 表示名マップ（週・日ビューのユーザー列ヘッダー用）
  const userNames = new Map<number, string>([
    ...weekDayGroupUsers.map((u) => [u.userId, u.fullName] as [number, string]),
    ...(loginUserId !== null ? [[loginUserId, loginUserName] as [number, string]] : []),
  ])

  const fetchSchedules = useCallback((mode: ViewMode, ws: string, vd: string, userIds: number[]) => {
    if (userIds.length === 0) return
    // 一覧ビューは ScheduleListView 内部で独自取得するためここでは不要
    if (mode === 'list') return
    setIsLoading(true)
    const promise = mode === 'day'
      ? getDaySchedulesAction(vd, userIds)
      : mode === 'month'
        // 月ビュー: "YYYY-MM" 形式で渡す
        ? getMonthSchedulesAction(vd.slice(0, 7), userIds)
        : getWeekSchedulesMultiAction(userIds, ws)
    promise
      .then(setSchedules)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  // マウント時にログインユーザー情報・グループ一覧・DB 保存済み設定を並行取得して初期化する。
  // 週・日ビュー用のマイグループは userId 確定後に取得するため、ログイン取得後に並行実行する。
  useEffect(() => {
    const settingsPromise = isMobileView
      ? getMobileWidgetSettingsAction('Schedule')
      : widgetId !== undefined
        ? getWidgetSettingsAction(widgetId)
        : Promise.resolve(null)

    getLoginUserIdAction()
      .then(async ({ userId, fullName }) => {
        setLoginUserId(userId)
        setLoginUserName(fullName)
        setNonWeekTargetUserId(userId)

        const [settings, allGroups, allUsers, myGroups] = await Promise.all([
          settingsPromise,
          getGroupListAction(),
          getScheduleUsersAction(),
          // ログインユーザーが所属するグループのみ取得（AIPO getMyGroups 相当）
          getMyGroupsAction(userId),
        ])

        setNonWeekGroups(allGroups)
        setNonWeekAllUsers(allUsers)
        setNonWeekGroupUsers(allUsers)
        setWeekDayGroups(myGroups)

        const s = settings as ScheduleWidgetSettings | null
        if (s?.viewMode) setViewMode(s.viewMode)
        if (s?.viewDate) {
          setViewDate(s.viewDate)
          if (s.viewMode === 'week') setWeekStart(getSunday(new Date(s.viewDate + 'T00:00:00+09:00')))
        }
        // 保存済みのグループフィルターを復元する（null = 自分のみ）
        setWeekDayGroupId(s?.weekDayGroupId ?? null)

        hasInitializedRef.current = true
      })
      .catch(() => {})
  // isMobileView/widgetId が変わった場合（例: デスクトップ←→モバイル切り替え）に再取得する
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobileView, widgetId])

  // 週・日グループフィルターが変わったらそのグループのメンバーを取得する。
  // null（自分のみ）の場合はメンバーリストをクリアする。
  useEffect(() => {
    if (weekDayGroupId === null) {
      setWeekDayGroupUsers([])
    } else {
      getGroupMembersAction(weekDayGroupId)
        .then(setWeekDayGroupUsers)
        .catch(() => {})
    }
  }, [weekDayGroupId])

  // 月・一覧ビューのグループ選択が変わったらユーザーリストを更新し、表示ユーザーをリセットする。
  useEffect(() => {
    if (nonWeekGroupId === null) {
      setNonWeekGroupUsers(nonWeekAllUsers)
    } else {
      getGroupMembersAction(nonWeekGroupId).then((members) => {
        setNonWeekGroupUsers(members)
        // グループ切替時はログインユーザーに戻す（AIPO のデフォルト動作）
        if (loginUserId !== null) setNonWeekTargetUserId(loginUserId)
      })
    }
  // nonWeekAllUsers が変わったとき（初期ロード完了後）も更新する
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonWeekGroupId, nonWeekAllUsers])

  // viewMode / weekStart / viewDate / weekDayGroupId / weekDayGroupUsers / nonWeekTargetUserId が
  // 変わったときにスケジュールを再取得する
  useEffect(() => {
    const ids = (viewMode === 'week' || viewMode === 'day')
      ? weekDayUserIds
      : nonWeekTargetUserId !== null ? [nonWeekTargetUserId] : []
    fetchSchedules(viewMode, weekStart, viewDate, ids)
  // weekDayUserIds は derived value のため deps に weekDayGroupId/weekDayGroupUsers/loginUserId を含める
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, weekStart, viewDate, weekDayGroupId, weekDayGroupUsers, loginUserId, nonWeekTargetUserId, fetchSchedules])

  // 初回レンダリング後に 8:00 付近にスクロールする
  useEffect(() => {
    if (!scrolledRef.current && calendarRef.current && !isLoading) {
      calendarRef.current.scrollTop = 8 * HOUR_PX
      scrolledRef.current = true
    }
  }, [isLoading])

  // 祝日データを外部APIから取得する（マウント時1回のみ）
  useEffect(() => {
    getHolidaysAction().then(setHolidays).catch(() => {})
  }, [])

  // viewMode / viewDate / weekDayGroupId が変わったらリロード後に復元できるよう DB に保存する。
  useEffect(() => {
    if (!hasInitializedRef.current) return
    if (isMobileView) {
      saveMobileWidgetSettingsAction('Schedule', { weekDayGroupId, viewMode, viewDate }).catch(() => {})
    } else if (widgetId !== undefined) {
      saveWidgetSettingsAction(widgetId, { weekDayGroupId, viewMode, viewDate }).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, viewDate, weekDayGroupId])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const weekDays = getWeekDays(weekStart)

  // 終日予定と時刻付き予定を分離して各日カラムに振り分ける
  const allDayByDay: Record<string, MultiUserScheduleEntry[]> = {}
  const timedByDay: Record<string, MultiUserScheduleEntry[]> = {}
  const hasAllDay = schedules.some((s) => s.isAllDay)

  for (const s of schedules) {
    if (s.isAllDay) {
      const startDay = toJstDateStr(s.startDate)
      const endDayExclusive = toJstDateStr(s.endDate)
      if (startDay === endDayExclusive || s.startDate.getTime() === s.endDate.getTime()) {
        // 通常の終日（AIPO: start_date=end_date）
        allDayByDay[startDay] = [...(allDayByDay[startDay] ?? []), s]
      } else {
        // 期間で指定（end_date は exclusive: startDay <= day < endDayExclusive）
        // 週の表示範囲内の日付にのみ配置する（週をまたぐ期間予定に対応）
        for (const day of weekDays) {
          if (day >= startDay && day < endDayExclusive) {
            allDayByDay[day] = [...(allDayByDay[day] ?? []), s]
          }
        }
      }
    } else {
      const day = toJstDateStr(s.startDate)
      timedByDay[day] = [...(timedByDay[day] ?? []), s]
    }
  }

  // 各日カラムの予定に重複レイアウト情報と色クラスを付与する
  const positionedByDay: Record<string, PositionedSchedule[]> = {}
  for (const day of weekDays) {
    positionedByDay[day] = positionSchedules(timedByDay[day] ?? [], userColorMap, isMultiUser)
  }

  // 追加・更新・削除後の再フェッチで使う実効ユーザー ID リスト
  function getEffectiveUserIds(): number[] {
    return (viewMode === 'week' || viewMode === 'day')
      ? weekDayUserIds
      : nonWeekTargetUserId !== null ? [nonWeekTargetUserId] : []
  }

  async function handleAdd(input: ScheduleInput | RepeatScheduleInput) {
    if ('repeatType' in input) {
      await addRepeatScheduleAction(input)
      fetchSchedules(viewMode, weekStart, viewDate, getEffectiveUserIds())
    } else {
      const added = await addScheduleAction(input)
      const entry: MultiUserScheduleEntry = {
        ...added,
        viewUserId: loginUserId ?? 0,
        viewUserName: loginUserName,
      }
      setSchedules((prev) => [...prev, entry])
    }
    setListRefreshKey((k) => k + 1)
    setShowAddForm(false)
  }

  async function handleUpdate(input: ScheduleInput | RepeatScheduleInput) {
    if (!editingSchedule) return
    const effectiveIds = getEffectiveUserIds()
    if (repeatEditMode === 'repeatOne') {
      await updateRepeatOneAction(editingSchedule.scheduleId, input as ScheduleInput)
      fetchSchedules(viewMode, weekStart, viewDate, effectiveIds)
    } else if (repeatEditMode === 'repeatAll') {
      await updateRepeatAllAction(editingSchedule.parentId, input as ScheduleInput)
      fetchSchedules(viewMode, weekStart, viewDate, effectiveIds)
    } else if ('repeatType' in input) {
      await addRepeatScheduleAction(input)
      fetchSchedules(viewMode, weekStart, viewDate, effectiveIds)
    } else {
      const updated = await updateScheduleAction(editingSchedule.scheduleId, input)
      const entry: MultiUserScheduleEntry = {
        ...updated,
        viewUserId: editingSchedule.viewUserId,
        viewUserName: editingSchedule.viewUserName,
      }
      setSchedules((prev) => prev.map((s) => (s.scheduleId === entry.scheduleId ? entry : s)))
    }
    setListRefreshKey((k) => k + 1)
    setEditingSchedule(null)
    setRepeatEditMode('normal')
  }

  async function handleDelete(scope: string) {
    const target = editingSchedule ?? selectedSchedule
    if (!target) return
    const { scheduleId, parentId } = target

    if (scope === 'repeatOne') {
      await deleteRepeatOneAction(scheduleId)
      setSchedules((prev) => prev.filter((s) => s.scheduleId !== scheduleId))
    } else if (scope === 'repeatAll') {
      await deleteRepeatAllAction(parentId)
      setSchedules((prev) => prev.filter((s) => s.parentId !== parentId && s.scheduleId !== parentId))
    } else {
      await deleteScheduleAction(scheduleId)
      setSchedules((prev) => prev.filter((s) => s.scheduleId !== scheduleId))
    }
    setListRefreshKey((k) => k + 1)
    setEditingSchedule(null)
    setRepeatEditMode('normal')
    setSelectedSchedule(null)
  }

  /**
   * 予定クリック時の動作（AIPO準拠）:
   * - 自分の予定 → 編集フォームを直接開く（繰り返し子は編集モード選択ダイアログを経由）
   * - 他ユーザーの予定 → 詳細モーダル（閲覧専用）
   */
  function handleScheduleClick(schedule: MultiUserScheduleEntry) {
    if (!schedule.isOwner) {
      setSelectedSchedule(schedule)
      return
    }
    if (schedule.parentId > 0) {
      // 繰り返し子: 「この予定のみ / 全ての予定を変更」を先に選ばせる
      setRepeatModeSchedule(schedule)
      return
    }
    setEditingSchedule(schedule)
  }

  return (
    <div className="flex flex-col select-none">
      {/* ナビゲーションヘッダー */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 gap-2 flex-wrap">
        {/* 日付ナビゲーション（一覧ビューでは非表示） */}
        {viewMode !== 'list' ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const today = toJstDateStr(new Date())
                setViewDate(today)
                // 週ビューのみ weekStart も今週に戻す
                if (viewMode === 'week') setWeekStart(getSunday(new Date()))
              }}
              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
            >
              今日
            </button>
            <button
              onClick={() => {
                if (viewMode === 'week') {
                  // viewDate を weekStart と同期させて設定保存・ビュー切替時の継続性を保つ
                  const newStart = addDays(weekStart, -7)
                  setWeekStart(newStart)
                  setViewDate(newStart)
                } else if (viewMode === 'day') {
                  setViewDate(addDays(viewDate, -1))
                } else if (viewMode === 'month') {
                  setViewDate(addMonth(viewDate, -1))
                }
              }}
              className="p-1 rounded hover:bg-gray-100 text-gray-500"
              aria-label="前へ"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (viewMode === 'week') {
                  const newStart = addDays(weekStart, 7)
                  setWeekStart(newStart)
                  setViewDate(newStart)
                } else if (viewMode === 'day') {
                  setViewDate(addDays(viewDate, 1))
                } else if (viewMode === 'month') {
                  setViewDate(addMonth(viewDate, 1))
                }
              }}
              className="p-1 rounded hover:bg-gray-100 text-gray-500"
              aria-label="次へ"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-600 hidden sm:inline">
              {viewMode === 'week'
                ? formatJapaneseDate(weekStart)
                : viewMode === 'day'
                  ? formatJapaneseDate(viewDate)
                  : `${viewDate.split('-')[0]}年${Number(viewDate.split('-')[1])}月`
              }
            </span>
          </div>
        ) : (
          <div />
        )}

        {/* 表示モード + 予定追加ボタン */}
        <div className="flex items-center gap-1">
          {/* ビューモード切り替えボタン（ブロック=AIPO別ビューのため未実装・disabled） */}
          {[
            { label: 'ブロック', mode: null as ViewMode | null },
            { label: '日', mode: 'day' as ViewMode | null },
            { label: '週', mode: 'week' as ViewMode | null },
            { label: '月', mode: 'month' as ViewMode | null },
            { label: '一覧', mode: 'list' as ViewMode | null },
          ].map(({ label, mode }) => {
            if (mode === null) {
              return (
                <span key={label} className="px-2 py-0.5 text-xs rounded border text-gray-300 border-gray-200 cursor-not-allowed">
                  {label}
                </span>
              )
            }
            const isActive = mode === viewMode
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  // 週ビューに戻る場合は viewDate をもとに weekStart を更新する
                  if (mode === 'week') setWeekStart(getSunday(new Date(viewDate + 'T00:00:00+09:00')))
                  setViewMode(mode)
                }}
                className={`px-2 py-0.5 text-xs rounded border ${
                  isActive ? 'bg-brand text-white border-brand' : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            )
          })}
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-brand rounded hover:bg-brand-dark ml-1"
          >
            <Plus className="w-3.5 h-3.5" />
            予定追加
          </button>
        </div>
      </div>

      {/* 週・日グループビュー用フィルター（AIPO weekly-group/oneday-group 準拠）:
          1段グループセレクトでグループを選択するとグループ全員を別列で並列表示する。
          空文字（自分のみ）がデフォルトで、ログインユーザーの予定のみ表示する。 */}
      {(viewMode === 'week' || viewMode === 'day') && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 bg-gray-50">
          <select
            value={weekDayGroupId ?? ''}
            onChange={(e) => setWeekDayGroupId(e.target.value === '' ? null : Number(e.target.value))}
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand max-w-[200px]"
          >
            {/* 空文字 = 自分のみ（AIPO の filter='' と同じ） */}
            <option value="">{loginUserName || '自分のみ'}</option>
            {weekDayGroups.map((g) => (
              <option key={g.groupId} value={g.groupId}>{g.groupName}</option>
            ))}
          </select>
        </div>
      )}

      {/* 月・一覧ビュー用フィルター（AIPO monthly/list 準拠）:
          グループ選択→ユーザー選択の2段ドロップダウンで単一ユーザーの予定を表示する。 */}
      {(viewMode === 'month' || viewMode === 'list') && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 bg-gray-50 flex-wrap">
          <select
            value={nonWeekGroupId ?? ''}
            onChange={(e) => setNonWeekGroupId(e.target.value === '' ? null : Number(e.target.value))}
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand max-w-[140px] sm:max-w-[180px]"
          >
            <option value="">全グループ</option>
            {nonWeekGroups.map((g) => (
              <option key={g.groupId} value={g.groupId}>{g.groupName}</option>
            ))}
          </select>
          <select
            value={nonWeekTargetUserId ?? ''}
            onChange={(e) => {
              const id = Number(e.target.value)
              if (id) setNonWeekTargetUserId(id)
            }}
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand max-w-[140px] sm:max-w-[180px]"
          >
            <option value="">メンバーを選択</option>
            {nonWeekGroupUsers.map((u) => (
              <option key={u.userId} value={u.userId}>{u.fullName}</option>
            ))}
          </select>
        </div>
      )}

      {/* カレンダー本体: overflow: auto で水平・垂直両方スクロール。
          h-[calc(100vh-160px)]: ヘッダー44px + ウィジェット見出し40px + ナビバー44px + 余白32px ≒ 160px を引いた固定高さ。
          複数ウィジェットが縦に並ぶ場合はページスクロールで対応する。 */}
      <div ref={calendarRef} className="overflow-auto h-[calc(100vh-160px)] relative">

        {/* 週ビュー（時刻グリッド） */}
        {viewMode === 'week' && (
          // min-width: 時刻軸 40px + 7列 × 最小 64px = 488px（モバイル横スクロール）
          <div className="min-w-[490px]">
            {/* 曜日・日付ヘッダー（sticky top-0） */}
            <div className="flex sticky top-0 z-20 bg-white border-b border-gray-200">
              {/* コーナー（sticky left-0 かつ top-0） */}
              <div className="w-10 shrink-0 sticky left-0 z-30 bg-white" />
              {weekDays.map((day, i) => {
                const [, , d] = day.split('-').map(Number)
                const holiday = holidays[day] ?? null
                // 祝日は赤表示（土曜より優先）
                const colorClass = holiday ? 'text-red-600' : dayTextColor(i)
                const today = isTodayJst(day)
                return (
                  <div
                    key={day}
                    className={`flex-1 text-center py-1 border-l border-gray-100 ${today ? 'bg-orange-50' : ''}`}
                  >
                    <div className={`text-sm font-semibold ${today ? 'text-brand' : colorClass}`}>
                      {d}（{DOW_JA[i]}）
                    </div>
                    {holiday && (
                      <div className="text-[9px] text-red-500 leading-tight truncate px-0.5">
                        {holiday}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 終日予定行（終日予定がある場合のみ表示、sticky） */}
            {hasAllDay && (
              <div className="flex sticky top-[58px] z-20 bg-white border-b border-gray-200 min-h-[28px]">
                <div className="w-10 shrink-0 sticky left-0 z-30 bg-white flex items-center justify-center">
                  <span className="text-[10px] text-gray-400 rotate-0">終日</span>
                </div>
                {weekDays.map((day, i) => (
                  <div key={i} className="flex-1 border-l border-gray-100 p-0.5 space-y-0.5">
                    {(allDayByDay[day] ?? []).map((s) => {
                      const color = isMultiUser
                        ? (userColorMap.get(s.viewUserId) ?? USER_COLORS[0])
                        : PUBLIC_FLAG_COLORS[s.publicFlag as 'O' | 'P' | 'C']
                      return (
                        <button
                          key={`${s.scheduleId}-${s.viewUserId}`}
                          type="button"
                          className={`w-full text-left text-xs truncate rounded px-1 py-0.5 hover:opacity-90 ${color}`}
                          onClick={() => handleScheduleClick(s)}
                          title={s.name}
                        >
                          {s.name}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* 時刻グリッド */}
            <div className="relative flex">
              {/* 時刻軸（sticky left-0） */}
              <div className="w-10 shrink-0 sticky left-0 z-10 bg-white">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="relative border-t border-gray-100" style={{ height: HOUR_PX }}>
                    {h > 0 && (
                      <span className="absolute -top-2 right-1 text-[10px] text-gray-400 leading-none">
                        {String(h).padStart(2, '0')}:00
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* 各日カラム */}
              {weekDays.map((day, colIdx) => (
                <div key={colIdx} className="flex-1 relative min-w-0 border-l border-gray-100">
                  {/* 時間区切り線 */}
                  {Array.from({ length: 24 }, (_, h) => (
                    <div
                      key={h}
                      className={`border-t ${h % 6 === 0 ? 'border-gray-200' : 'border-gray-100'}`}
                      style={{ height: HOUR_PX }}
                    />
                  ))}
                  {/* スケジュールブロック */}
                  {(positionedByDay[day] ?? []).map((ps) => (
                    <ScheduleBlock
                      key={`${ps.scheduleId}-${ps.viewUserId}`}
                      schedule={ps}
                      onClick={() => handleScheduleClick(ps)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 日ビュー */}
        {viewMode === 'day' && (
          <ScheduleDayView
            viewDate={viewDate}
            schedules={schedules}
            userColorMap={userColorMap}
            isMultiUser={isMultiUser}
            viewUserIds={weekDayUserIds}
            userNames={userNames}
            holidays={holidays}
            onScheduleClick={handleScheduleClick}
          />
        )}

        {/* 月ビュー */}
        {viewMode === 'month' && (
          <ScheduleMonthView
            monthStart={`${viewDate.slice(0, 7)}-01`}
            schedules={schedules}
            userColorMap={userColorMap}
            isMultiUser={isMultiUser}
            holidays={holidays}
            onScheduleClick={handleScheduleClick}
          />
        )}

        {/* 一覧ビュー（スケジュール取得は ScheduleListView 内部で行う） */}
        {viewMode === 'list' && (
          <ScheduleListView
            viewUserIds={nonWeekTargetUserId !== null ? [nonWeekTargetUserId] : (loginUserId !== null ? [loginUserId] : [])}
            onScheduleClick={handleScheduleClick}
            refreshKey={listRefreshKey}
          />
        )}

      </div>

      {/* ローディング表示 */}
      {isLoading && <Loading />}

      {/* トースト（繰り返し未実装の案内など） */}
      <Toast message={toast} />

      {/* 予定追加モーダル */}
      {showAddForm && (
        <ScheduleFormModal
          loginUserId={loginUserId ?? 0}
          loginUserName={loginUserName}
          onClose={() => setShowAddForm(false)}
          onSave={handleAdd}
        />
      )}

      {/* 予定編集モーダル（AIPO準拠: 自分の予定クリックで直接開く） */}
      {editingSchedule && (
        <ScheduleFormModal
          schedule={editingSchedule}
          editMode={repeatEditMode}
          loginUserId={loginUserId ?? 0}
          loginUserName={loginUserName}
          onClose={() => {
            setEditingSchedule(null)
            setRepeatEditMode('normal')
          }}
          onSave={handleUpdate}
          onDelete={handleDelete}
        />
      )}

      {/* 他ユーザー所有の予定詳細モーダル（閲覧専用） */}
      {selectedSchedule && !editingSchedule && (
        <ScheduleDetailModal
          schedule={selectedSchedule}
          onClose={() => setSelectedSchedule(null)}
        />
      )}

      {/* 繰り返し子の編集モード選択ダイアログ（AIPO準拠: クリック後に「この予定のみ / 全件変更」を選択） */}
      {repeatModeSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <p className="text-sm font-medium text-gray-800 mb-4">繰り返し予定の編集</p>
            <div className="space-y-2">
              <button
                type="button"
                className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-700"
                onClick={() => {
                  setRepeatEditMode('repeatOne')
                  setEditingSchedule(repeatModeSchedule)
                  setRepeatModeSchedule(null)
                }}
              >
                この予定のみ変更
              </button>
              <button
                type="button"
                className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-700"
                onClick={() => {
                  setRepeatEditMode('repeatAll')
                  setEditingSchedule(repeatModeSchedule)
                  setRepeatModeSchedule(null)
                }}
              >
                全ての予定を変更
              </button>
            </div>
            <button
              type="button"
              className="mt-4 w-full text-center text-xs text-gray-400 hover:text-gray-600"
              onClick={() => setRepeatModeSchedule(null)}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
