'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, Users, X } from 'lucide-react'
import {
  getWeekSchedulesMultiAction,
  getLoginUserIdAction,
  addScheduleAction,
  updateScheduleAction,
  deleteScheduleAction,
  getHolidaysAction,
} from '../../actions'
import type { ScheduleInput, MultiUserScheduleEntry } from '@/lib/schedule.types'
import ScheduleFormModal from './ScheduleFormModal'
import ScheduleDetailModal from './ScheduleDetailModal'
import UserPickerModal from './UserPickerModal'
import { Toast, Loading } from '../ui'
import { toJstDateStr, toJstTimeStr, isTodayJst, toJstMinutesSinceMidnight } from '@/lib/jst'

// 単独ユーザービューでの公開区分色（Phase A 互換。自分のみ表示時に使用）
const PUBLIC_FLAG_COLORS: Record<'O' | 'P' | 'C', string> = {
  O: 'bg-brand text-white',
  P: 'bg-gray-400 text-white',
  C: 'bg-gray-600 text-white',
}

// マルチユーザービューで使用するプリセットカラー（自分はブランドカラー、追加ユーザーはここから順に割り当て）
// 最大30人（AIPO 準拠）に対応できる色数を確保する
const USER_COLORS = [
  'bg-brand text-white',       // 0: 自分（オレンジ）
  'bg-blue-500 text-white',    // 1
  'bg-green-500 text-white',   // 2
  'bg-purple-500 text-white',  // 3
  'bg-teal-500 text-white',    // 4
  'bg-pink-500 text-white',    // 5
  'bg-amber-500 text-white',   // 6
  'bg-indigo-500 text-white',  // 7
  'bg-red-400 text-white',     // 8
  'bg-cyan-500 text-white',    // 9
  'bg-lime-500 text-white',    // 10
  'bg-orange-400 text-white',  // 11
  'bg-violet-500 text-white',  // 12
  'bg-rose-400 text-white',    // 13
  'bg-emerald-500 text-white', // 14
  'bg-fuchsia-500 text-white', // 15
  'bg-sky-500 text-white',     // 16
  'bg-yellow-500 text-white',  // 17
  'bg-slate-500 text-white',   // 18
  'bg-blue-700 text-white',    // 19
] as const

// 最大表示人数（AIPO 準拠）
const MAX_USERS = 30

// 1 時間あたりのピクセル高さ（時刻グリッドの基準単位）
const HOUR_PX = 60
// スケジュールブロックの最小高さ（15 分未満の予定でも視認できるよう確保）
const MIN_BLOCK_PX = 20

const DOW_JA = ['月', '火', '水', '木', '金', '土', '日']

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

/** 指定 Date の週の月曜日を "YYYY-MM-DD"（JST）で返す */
function getMonday(date: Date): string {
  const dateStr = toJstDateStr(date)
  const [y, m, d] = dateStr.split('-').map(Number)
  // 日付文字列から曜日を算出（UTC 基準で構わない: 日付のみで時刻なし）
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=日, 1=月, ..., 6=土
  const daysBack = dow === 0 ? 6 : dow - 1
  return addDays(dateStr, -daysBack)
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

/** 曜日インデックスに対応するテキストカラークラス（土=青、日=赤、平日=デフォルト） */
function dayTextColor(dowIndex: number): string {
  if (dowIndex === 5) return 'text-blue-600' // 土
  if (dowIndex === 6) return 'text-red-600'  // 日
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

  // マルチユーザービューではユーザーごとのプリセット色を使用する。
  // 単独ユーザービューでは公開区分（P/C）をグレー系で表現する。
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

export default function ScheduleWidget() {
  const [weekStart, setWeekStart] = useState<string>(() => getMonday(new Date()))
  const [schedules, setSchedules] = useState<MultiUserScheduleEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedSchedule, setSelectedSchedule] = useState<MultiUserScheduleEntry | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<MultiUserScheduleEntry | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  // 祝日データ: 初回マウント時に外部APIから取得しキャッシュ済みのものを受け取る
  const [holidays, setHolidays] = useState<Record<string, string>>({})

  // loginUserId: マウント時に getLoginUserIdAction で取得。null の間はスケジュール取得をスキップ。
  const [loginUserId, setLoginUserId] = useState<number | null>(null)
  // loginUserName: チップの自分ラベル用。スケジュール0件の週でも正しく名前を表示するために別途保持する。
  const [loginUserName, setLoginUserName] = useState<string>('')
  // knownUserNames: ピッカー確定時に取得したユーザー ID → 氏名マップ。スケジュールがない週でも名前を表示するため保持する。
  const [knownUserNames, setKnownUserNames] = useState<Map<number, string>>(new Map())
  // viewUserIds: 表示対象ユーザー ID 一覧（自分が常に先頭。setViewUserIds で明示的に更新する）
  const [viewUserIds, setViewUserIds] = useState<number[]>([])
  const [showUserPicker, setShowUserPicker] = useState(false)

  // カレンダーコンテナ: 初期スクロール位置を 8:00 に合わせるため ref を保持
  const calendarRef = useRef<HTMLDivElement>(null)
  const scrolledRef = useRef(false)

  // viewUserIds の順番に対応するプリセット色マップ
  const userColorMap = new Map<number, string>(
    viewUserIds.map((uid, i) => [uid, USER_COLORS[i % USER_COLORS.length]])
  )
  // schedules からの userId → 表示氏名マップ。
  // ピッカーで取得した knownUserNames で初期化し、スケジュール有無に関わらず名前を表示する。
  // 自分の名前は loginUserName で上書き（スケジュール0件の週でも正しく表示）。
  const userNames = new Map<number, string>([
    ...knownUserNames,
    ...schedules.map((s) => [s.viewUserId, s.viewUserName] as [number, string]),
    ...(loginUserId !== null ? [[loginUserId, loginUserName] as [number, string]] : []),
  ])

  const isMultiUser = viewUserIds.length > 1

  const fetchSchedules = useCallback((ws: string, userIds: number[]) => {
    if (userIds.length === 0) return
    setIsLoading(true)
    getWeekSchedulesMultiAction(userIds, ws)
      .then(setSchedules)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  // マウント時にログインユーザー ID と氏名を取得し、viewUserIds を初期化する。
  // Client Component から直接 requireAuth() は呼べないため Server Action 経由で取得する。
  useEffect(() => {
    getLoginUserIdAction()
      .then(({ userId, fullName }) => {
        setLoginUserId(userId)
        setLoginUserName(fullName)
        setViewUserIds([userId])
      })
      .catch(() => {})
  }, [])

  // viewUserIds または weekStart が変わったときにスケジュールを再取得する
  useEffect(() => {
    fetchSchedules(weekStart, viewUserIds)
  }, [weekStart, viewUserIds, fetchSchedules])
  // NOTE: viewUserIds はプリミティブ配列だが参照比較になる。
  // setViewUserIds で新配列を渡すのはユーザー追加/削除/週変更などの意図的な操作のみなので問題ない。

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
    const day = toJstDateStr(s.startDate)
    if (s.isAllDay) {
      allDayByDay[day] = [...(allDayByDay[day] ?? []), s]
    } else {
      timedByDay[day] = [...(timedByDay[day] ?? []), s]
    }
  }

  // 各日カラムの予定に重複レイアウト情報と色クラスを付与する
  const positionedByDay: Record<string, PositionedSchedule[]> = {}
  for (const day of weekDays) {
    positionedByDay[day] = positionSchedules(timedByDay[day] ?? [], userColorMap, isMultiUser)
  }

  async function handleAdd(input: ScheduleInput) {
    const added = await addScheduleAction(input)
    const entry: MultiUserScheduleEntry = {
      ...added,
      viewUserId: loginUserId ?? 0,
      viewUserName: loginUserName,
    }
    setSchedules((prev) => [...prev, entry])
    setShowAddForm(false)
  }

  async function handleUpdate(input: ScheduleInput) {
    if (!editingSchedule) return
    const updated = await updateScheduleAction(editingSchedule.scheduleId, input)
    const entry: MultiUserScheduleEntry = {
      ...updated,
      viewUserId: editingSchedule.viewUserId,
      viewUserName: editingSchedule.viewUserName,
    }
    setSchedules((prev) => prev.map((s) => (s.scheduleId === entry.scheduleId ? entry : s)))
    setEditingSchedule(null)
  }

  async function handleDelete(scheduleId: number) {
    // TODO Phase C: スコープ（single/all/participants）に応じた繰り返し削除を実装する
    await deleteScheduleAction(scheduleId)
    setSchedules((prev) => prev.filter((s) => s.scheduleId !== scheduleId))
    setSelectedSchedule(null)
  }

  function handleCopy() {
    showToast('コピーして登録する機能は Phase C で実装予定です')
    setSelectedSchedule(null)
  }

  function handleUserPickerConfirm(ids: Set<number>, names?: Map<number, string>) {
    if (ids.size > MAX_USERS) {
      showToast(`最大${MAX_USERS}人まで選択できます`)
      return
    }
    // ピッカーから受け取った氏名マップを knownUserNames にマージして保持する
    if (names) {
      setKnownUserNames((prev) => new Map([...prev, ...names]))
    }
    // ログインユーザーを先頭に固定して並び替える
    const sorted = loginUserId !== null
      ? [loginUserId, ...Array.from(ids).filter((id) => id !== loginUserId)]
      : Array.from(ids)
    // ピッカーで選択解除されたユーザーの予定をローカルから即時削除する
    setSchedules((prev) => prev.filter((s) => ids.has(s.viewUserId)))
    setViewUserIds(sorted)
    setShowUserPicker(false)
  }

  return (
    <div className="flex flex-col select-none">
      {/* ナビゲーションヘッダー */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 gap-2 flex-wrap">
        {/* 週移動 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekStart(getMonday(new Date()))}
            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
          >
            今日
          </button>
          <button
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
            aria-label="前の週"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
            aria-label="次の週"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-600 hidden sm:inline">
            {formatJapaneseDate(weekStart)}
          </span>
        </div>

        {/* 表示モード + ユーザー追加 + 予定追加ボタン */}
        <div className="flex items-center gap-1">
          {/* ブロック・週ビューのみ有効（Phase D で日/月/一覧を実装予定） */}
          {(['ブロック', '日', '週', '月', '一覧'] as const).map((label) => (
            <span
              key={label}
              className={`px-2 py-0.5 text-xs rounded border ${
                label === 'ブロック'
                  ? 'bg-brand text-white border-brand'
                  : 'text-gray-300 border-gray-200 cursor-not-allowed'
              }`}
            >
              {label}
            </span>
          ))}
          <button
            onClick={() => setShowUserPicker(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-600 ml-1"
            title="ユーザーを追加"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ユーザーを追加</span>
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-brand rounded hover:bg-brand-dark"
          >
            <Plus className="w-3.5 h-3.5" />
            予定追加
          </button>
        </div>
      </div>

      {/* 選択ユーザーチップ（追加ユーザーがいる場合のみ表示） */}
      {isMultiUser && (
        <div className="flex flex-wrap gap-1 px-3 py-1.5 border-b border-gray-100 bg-gray-50">
          {viewUserIds.map((uid, i) => {
            const color = USER_COLORS[i % USER_COLORS.length]
            const name = userNames.get(uid) ?? `ユーザー${uid}`
            const isLogin = uid === loginUserId
            return (
              <span key={uid} className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium ${color}`}>
                {name}
                {/* 自分自身のチップは削除ボタンを表示しない（常に表示） */}
                {!isLogin && (
                  <button
                    type="button"
                    onClick={() => {
                      setViewUserIds((prev) => prev.filter((id) => id !== uid))
                      setSchedules((prev) => prev.filter((s) => s.viewUserId !== uid))
                    }}
                    className="opacity-80 hover:opacity-100 ml-0.5"
                    aria-label={`${name}を削除`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}

      {/* カレンダー本体: overflow: auto で水平・垂直両方スクロール。
          h-[calc(100vh-160px)]: ヘッダー44px + ウィジェット見出し40px + ナビバー44px + 余白32px ≒ 160px を引いた固定高さ。
          複数ウィジェットが縦に並ぶ場合はページスクロールで対応する。 */}
      <div ref={calendarRef} className="overflow-auto h-[calc(100vh-160px)] relative">
        {/* min-width: 時刻軸 40px + 7列 × 最小 64px = 488px（モバイル横スクロール） */}
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
                  {/* 祝日名（省略表示） */}
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
                        onClick={() => setSelectedSchedule(s)}
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
                    onClick={() => setSelectedSchedule(ps)}
                  />
                ))}
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ローディング表示 */}
      {isLoading && <Loading />}

      {/* トースト（繰り返し未実装の案内など） */}
      <Toast message={toast} />

      {/* ユーザーピッカーモーダル（loginUserId が確定してから表示） */}
      {showUserPicker && loginUserId !== null && (
        <UserPickerModal
          selectedIds={new Set(viewUserIds)}
          lockedIds={new Set([loginUserId])}
          onConfirm={handleUserPickerConfirm}
          onClose={() => setShowUserPicker(false)}
        />
      )}

      {/* 予定追加モーダル */}
      {showAddForm && (
        <ScheduleFormModal
          loginUserId={loginUserId ?? 0}
          loginUserName={loginUserName}
          onClose={() => setShowAddForm(false)}
          onSave={handleAdd}
          onShowRepeatToast={() => showToast('繰り返し予定の設定は Phase C で実装予定です')}
        />
      )}

      {/* 予定編集モーダル */}
      {editingSchedule && (
        <ScheduleFormModal
          schedule={editingSchedule}
          loginUserId={loginUserId ?? 0}
          loginUserName={loginUserName}
          onClose={() => setEditingSchedule(null)}
          onSave={handleUpdate}
          onShowRepeatToast={() => showToast('繰り返し予定の設定は Phase C で実装予定です')}
        />
      )}

      {/* 予定詳細モーダル */}
      {selectedSchedule && !editingSchedule && (
        <ScheduleDetailModal
          schedule={selectedSchedule}
          onClose={() => setSelectedSchedule(null)}
          onEdit={() => {
            setEditingSchedule(selectedSchedule)
            setSelectedSchedule(null)
          }}
          onDelete={(_scope) => handleDelete(selectedSchedule.scheduleId)}
          onCopy={handleCopy}
        />
      )}
    </div>
  )
}
