'use client'

import type { MultiUserScheduleEntry } from '@/lib/schedule.types'
import { getDaysInMonth, getDay, parseISO } from 'date-fns'
import { USER_COLORS, PUBLIC_FLAG_COLORS, MAX_EVENTS_PER_CELL, dayTextColorClass } from '@/lib/schedule.constants'
import { toJstDateStr, isTodayJst, toJstTimeStr } from '@/lib/jst'

type Props = {
  /** 表示月の1日（YYYY-MM-DD）*/
  monthStart: string
  schedules: MultiUserScheduleEntry[]
  userColorMap: Map<number, string>
  isMultiUser: boolean
  holidays: Record<string, string>
  onScheduleClick: (schedule: MultiUserScheduleEntry) => void
}

export default function ScheduleMonthView({
  monthStart,
  schedules,
  userColorMap,
  isMultiUser,
  holidays,
  onScheduleClick,
}: Props) {
  const [y, m] = monthStart.split('-').map(Number)

  // 月の全日付を生成する（1日〜末日）
  const daysInMonth = getDaysInMonth(parseISO(monthStart))
  const allDays: string[] = Array.from({ length: daysInMonth }, (_, i) => {
    const day = String(i + 1).padStart(2, '0')
    const month = String(m).padStart(2, '0')
    return `${y}-${month}-${day}`
  })

  // 日曜始まりで7列のカレンダーグリッドを作る（AIPO仕様に準拠）
  // 先頭のオフセット（月の1日が何曜日か、日曜=0,月曜=1,...,土曜=6）
  const firstDow = getDay(parseISO(monthStart)) // 0=日,1=月,...
  const startOffset = firstDow

  // グリッドセルの配列（先頭は前月の空セル）
  const gridCells: (string | null)[] = [
    ...Array(startOffset).fill(null),
    ...allDays,
  ]
  // 6行に合わせるため末尾をパディング（42セルが上限）
  while (gridCells.length % 7 !== 0) gridCells.push(null)

  // 日別の予定マップを作成
  // 終日予定は開始日〜終了日（exclusive）の全日に配置する
  const schedulesByDay = new Map<string, MultiUserScheduleEntry[]>()
  for (const s of schedules) {
    if (s.isAllDay) {
      const startDay = toJstDateStr(s.startDate)
      const endDayExclusive = toJstDateStr(s.endDate)
      // 終日（start=end）or 期間予定を月内の全日に配置
      for (const day of allDays) {
        if (day >= startDay && (startDay === endDayExclusive || day < endDayExclusive)) {
          schedulesByDay.set(day, [...(schedulesByDay.get(day) ?? []), s])
        }
      }
    } else {
      const day = toJstDateStr(s.startDate)
      if (schedulesByDay.has(day)) {
        schedulesByDay.get(day)!.push(s)
      } else {
        schedulesByDay.set(day, [s])
      }
    }
  }

  const DOW_HEADER = ['日', '月', '火', '水', '木', '金', '土']

  return (
    <div className="min-w-[280px]">
      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {DOW_HEADER.map((dow, i) => (
          <div
            key={dow}
            className={`py-1 text-center text-xs font-medium ${
              i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            {dow}
          </div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7">
        {gridCells.map((dateStr, idx) => {
          if (!dateStr) {
            // 前月・翌月のパディングセル（当月外はグレーアウト）
            return <div key={`pad-${idx}`} className="min-h-[80px] border-b border-r border-gray-100 bg-gray-50" />
          }

          const [, , dayNum] = dateStr.split('-').map(Number)
          const colIdx = idx % 7 // 日=0, 月=1, ..., 土=6
          const holiday = holidays[dateStr] ?? null
          const isToday = isTodayJst(dateStr)

          // 日=赤字、土=青字、祝=赤字
          const dateColorClass = dayTextColorClass(colIdx, !!holiday)

          const daySchedules = schedulesByDay.get(dateStr) ?? []
          // 開始時刻昇順でソート
          const sorted = [...daySchedules].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
          const visible = sorted.slice(0, MAX_EVENTS_PER_CELL)
          const overflow = sorted.length - visible.length

          return (
            <div
              key={dateStr}
              className="min-h-[80px] border-b border-r border-gray-100 p-1"
            >
              {/* 日付番号 */}
              <div className="flex items-center justify-between mb-0.5">
                <span
                  className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-brand text-white' : dateColorClass
                  }`}
                >
                  {dayNum}
                </span>
                {holiday && (
                  <span className="text-[8px] text-red-500 leading-tight truncate flex-1 ml-0.5">
                    {holiday}
                  </span>
                )}
              </div>

              {/* 予定リスト */}
              <div className="space-y-0.5">
                {visible.map((s) => {
                  const colorClass = isMultiUser
                    ? (userColorMap.get(s.viewUserId) ?? USER_COLORS[0])
                    : PUBLIC_FLAG_COLORS[s.publicFlag as 'O' | 'P' | 'C']
                  const timeLabel = s.isAllDay ? '' : `${toJstTimeStr(s.startDate)} `
                  return (
                    <button
                      key={`${s.scheduleId}-${s.viewUserId}-${dateStr}`}
                      type="button"
                      className={`w-full text-left text-[10px] truncate rounded px-1 py-0.5 leading-tight hover:opacity-90 ${colorClass}`}
                      onClick={(e) => {
                        // セルクリックより優先してモーダルを開く
                        e.stopPropagation()
                        onScheduleClick(s)
                      }}
                      title={s.name}
                    >
                      {timeLabel}{s.name}
                    </button>
                  )
                })}
                {overflow > 0 && (
                  <p className="text-[10px] text-gray-400 pl-1">+{overflow}件</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
