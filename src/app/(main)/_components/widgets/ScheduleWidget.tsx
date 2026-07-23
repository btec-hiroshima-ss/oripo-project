'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import {
  getWeekSchedulesAction,
  addScheduleAction,
  updateScheduleAction,
  deleteScheduleAction,
} from '../../actions'
import type { ScheduleEntry, ScheduleInput } from '@/lib/schedule.types'
import ScheduleFormModal from './ScheduleFormModal'
import ScheduleDetailModal from './ScheduleDetailModal'
import { Toast, ConfirmDialog, Loading } from '../ui'

// 1 時間あたりのピクセル高さ（時刻グリッドの基準単位）
const HOUR_PX = 60
// スケジュールブロックの最小高さ（15 分未満の予定でも視認できるよう確保）
const MIN_BLOCK_PX = 20

const DOW_JA = ['月', '火', '水', '木', '金', '土', '日']

// ===========================================================
// 日付ユーティリティ（JST ベース）
// ===========================================================

/** UTC Date → "YYYY-MM-DD"（JST） */
function toJstDateStr(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

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
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  const dow = jst.getUTCDay() // 0=日, 1=月, ..., 6=土
  const daysBack = dow === 0 ? 6 : dow - 1
  return addDays(
    `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')}`,
    -daysBack
  )
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

// ===========================================================
// スケジュール表示ユーティリティ
// ===========================================================

/** UTC Date → "HH:MM"（JST） */
function formatTime(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`
}

/** "YYYY-MM-DD" が今日（JST）かどうか */
function isToday(dateStr: string): boolean {
  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const today = nowJst.toISOString().slice(0, 10)
  return dateStr === today
}

type PositionedSchedule = ScheduleEntry & {
  colIndex: number  // 重複グループ内の横位置（0 始まり）
  colCount: number  // 重複グループの列数
}

/**
 * 同一日カラムの予定に横並び位置を割り当てる。
 * 重複する予定をスロットに振り分け、colIndex / colCount で幅を分割する。
 */
function positionSchedules(schedules: ScheduleEntry[]): PositionedSchedule[] {
  const sorted = [...schedules].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  const slotEndTimes: Date[] = []
  const positioned: (ScheduleEntry & { colIndex: number })[] = []

  for (const s of sorted) {
    const slot = slotEndTimes.findIndex((end) => end <= s.startDate)
    const colIndex = slot === -1 ? slotEndTimes.length : slot
    if (slot === -1) {
      slotEndTimes.push(s.endDate)
    } else {
      // endDate が後ろにずれる場合はスロット終了時刻を更新
      if (s.endDate > slotEndTimes[slot]) slotEndTimes[slot] = s.endDate
    }
    positioned.push({ ...s, colIndex })
  }

  const colCount = slotEndTimes.length
  return positioned.map((s) => ({ ...s, colCount }))
}

// ===========================================================
// ScheduleBlock コンポーネント
// ===========================================================

type ScheduleBlockProps = {
  schedule: PositionedSchedule
  onClick: () => void
}

function ScheduleBlock({ schedule, onClick }: ScheduleBlockProps) {
  const jst = new Date(schedule.startDate.getTime() + 9 * 60 * 60 * 1000)
  const endJst = new Date(schedule.endDate.getTime() + 9 * 60 * 60 * 1000)
  const startMin = jst.getUTCHours() * 60 + jst.getUTCMinutes()
  // all-day（start=end 00:00）はこの関数では呼ばれないが念のため 24h 分に収める
  const endMin = Math.min(endJst.getUTCHours() * 60 + endJst.getUTCMinutes(), 24 * 60)
  const top = (startMin / 60) * HOUR_PX
  const height = Math.max(MIN_BLOCK_PX, ((endMin - startMin) / 60) * HOUR_PX)

  // 公開区分ごとのブロック色（AIPO 準拠のカテゴリ色）
  const colorClass = {
    O: 'bg-brand text-white',
    P: 'bg-gray-400 text-white',
    C: 'bg-gray-600 text-white',
  }[schedule.publicFlag]

  const widthPct = 100 / schedule.colCount
  const leftPct = (schedule.colIndex / schedule.colCount) * 100

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
      aria-label={`${schedule.name} ${formatTime(schedule.startDate)}`}
    >
      <span className="text-xs font-medium block truncate leading-tight">{schedule.name}</span>
      {height >= 30 && (
        <span className="text-xs opacity-90 block truncate leading-tight">
          {formatTime(schedule.startDate)}
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
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleEntry | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ScheduleEntry | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  // カレンダーコンテナ: 初期スクロール位置を 8:00 に合わせるため ref を保持
  const calendarRef = useRef<HTMLDivElement>(null)
  const scrolledRef = useRef(false)

  const fetchSchedules = useCallback((ws: string) => {
    setIsLoading(true)
    getWeekSchedulesAction(ws)
      .then(setSchedules)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    fetchSchedules(weekStart)
  }, [weekStart, fetchSchedules])

  // 初回レンダリング後に 8:00 付近にスクロールする
  useEffect(() => {
    if (!scrolledRef.current && calendarRef.current && !isLoading) {
      calendarRef.current.scrollTop = 8 * HOUR_PX
      scrolledRef.current = true
    }
  }, [isLoading])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const weekDays = getWeekDays(weekStart)

  // 終日予定と時刻付き予定を分離して各日カラムに振り分ける
  const allDayByDay: Record<string, ScheduleEntry[]> = {}
  const timedByDay: Record<string, ScheduleEntry[]> = {}
  const hasAllDay = schedules.some((s) => s.isAllDay)

  for (const s of schedules) {
    const day = toJstDateStr(s.startDate)
    if (s.isAllDay) {
      allDayByDay[day] = [...(allDayByDay[day] ?? []), s]
    } else {
      timedByDay[day] = [...(timedByDay[day] ?? []), s]
    }
  }

  // 各日カラムの予定に重複レイアウト情報を付与する
  const positionedByDay: Record<string, PositionedSchedule[]> = {}
  for (const day of weekDays) {
    positionedByDay[day] = positionSchedules(timedByDay[day] ?? [])
  }

  async function handleAdd(input: ScheduleInput) {
    const added = await addScheduleAction(input)
    setSchedules((prev) => [...prev, added])
    setShowAddForm(false)
  }

  async function handleUpdate(input: ScheduleInput) {
    if (!editingSchedule) return
    const updated = await updateScheduleAction(editingSchedule.scheduleId, input)
    setSchedules((prev) => prev.map((s) => (s.scheduleId === updated.scheduleId ? updated : s)))
    setEditingSchedule(null)
  }

  async function handleDelete(scheduleId: number) {
    await deleteScheduleAction(scheduleId)
    setSchedules((prev) => prev.filter((s) => s.scheduleId !== scheduleId))
    setSelectedSchedule(null)
    setDeleteConfirmId(null)
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

        {/* 表示モード + 追加ボタン */}
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
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-brand rounded hover:bg-brand-dark ml-1"
          >
            <Plus className="w-3.5 h-3.5" />
            予定追加
          </button>
        </div>
      </div>

      {/* カレンダー本体: overflow: auto で水平・垂直両方スクロール */}
      <div ref={calendarRef} className="overflow-auto max-h-[520px] relative">
        {/* min-width: 時刻軸 40px + 7列 × 最小 64px = 488px（モバイル横スクロール） */}
        <div className="min-w-[490px]">

          {/* 曜日・日付ヘッダー（sticky top-0） */}
          <div className="flex sticky top-0 z-20 bg-white border-b border-gray-200">
            {/* コーナー（sticky left-0 かつ top-0） */}
            <div className="w-10 shrink-0 sticky left-0 z-30 bg-white" />
            {weekDays.map((day, i) => {
              const [, , d] = day.split('-').map(Number)
              const colorClass = dayTextColor(i)
              const today = isToday(day)
              return (
                <div
                  key={day}
                  className={`flex-1 text-center py-1.5 border-l border-gray-100 ${today ? 'bg-orange-50' : ''}`}
                >
                  {/* モックアップ準拠: "25（月）" 形式で1行表示 */}
                  <div className={`text-sm font-semibold ${today ? 'text-brand' : colorClass}`}>
                    {d}（{DOW_JA[i]}）
                  </div>
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
                  {(allDayByDay[day] ?? []).map((s) => (
                    <button
                      key={s.scheduleId}
                      type="button"
                      className="w-full text-left text-xs truncate rounded px-1 py-0.5 text-white bg-brand hover:opacity-90"
                      onClick={() => setSelectedSchedule(s)}
                      title={s.name}
                    >
                      {s.name}
                    </button>
                  ))}
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
                    key={ps.scheduleId}
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

      {/* 削除確認ダイアログ */}
      {deleteConfirmId !== null && (
        <ConfirmDialog
          message="この予定を削除しますか？"
          confirmLabel="削除する"
          onConfirm={() => handleDelete(deleteConfirmId)}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}

      {/* 予定追加モーダル */}
      {showAddForm && (
        <ScheduleFormModal
          onClose={() => setShowAddForm(false)}
          onSave={handleAdd}
          onShowRepeatToast={() => showToast('繰り返し予定の設定は Phase C で実装予定です')}
        />
      )}

      {/* 予定編集モーダル */}
      {editingSchedule && (
        <ScheduleFormModal
          schedule={editingSchedule}
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
          onDelete={() => {
            setDeleteConfirmId(selectedSchedule.scheduleId)
            setSelectedSchedule(null)
          }}
        />
      )}
    </div>
  )
}
