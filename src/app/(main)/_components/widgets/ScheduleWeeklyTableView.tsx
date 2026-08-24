'use client'

import { addDays } from 'date-fns'
import type { MultiUserScheduleEntry } from '@/lib/schedule.types'
import { USER_COLORS, PUBLIC_FLAG_COLORS, dayTextColorClass } from '@/lib/schedule.constants'
import { makeDateJst, toJstDateStr, toJstTimeStr, isTodayJst } from '@/lib/jst'

// AIPO の schedule-weekly.vm 相当（テーブル型週表示）
// 7日間を列として並べ、各セルに予定名・時刻を列挙する

type Props = {
  /** 週の開始日（日曜日, YYYY-MM-DD） */
  weekStart: string
  schedules: MultiUserScheduleEntry[]
  userColorMap: Map<number, string>
  isMultiUser: boolean
  holidays: Record<string, string>
  onScheduleClick: (schedule: MultiUserScheduleEntry) => void
  onEmptySlotClick?: (dateStr: string, e: React.MouseEvent<HTMLDivElement>) => void
}

const DOW_LABEL = ['日', '月', '火', '水', '木', '金', '土']

function addDaysStr(dateStr: string, days: number): string {
  return toJstDateStr(addDays(makeDateJst(dateStr), days))
}

export default function ScheduleWeeklyTableView({
  weekStart,
  schedules,
  userColorMap,
  isMultiUser,
  holidays,
  onScheduleClick,
  onEmptySlotClick,
}: Props) {
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysStr(weekStart, i))

  // 日別の予定マップ（時刻順ソート済み）
  const schedulesByDay = new Map<string, MultiUserScheduleEntry[]>()
  for (const day of weekDays) schedulesByDay.set(day, [])
  for (const s of schedules) {
    const day = toJstDateStr(s.startDate)
    if (schedulesByDay.has(day)) {
      schedulesByDay.get(day)!.push(s)
    }
  }
  for (const [, arr] of schedulesByDay) {
    arr.sort((a, b) => {
      if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1
      return a.startDate.getTime() - b.startDate.getTime()
    })
  }

  return (
    <div className="min-w-[400px] overflow-x-auto">
      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 border-b border-gray-200 sticky top-0 bg-white z-10">
        {weekDays.map((day, i) => {
          const [, , d] = day.split('-')
          const holiday = holidays[day] ?? null
          const isToday = isTodayJst(day)
          const colorClass = dayTextColorClass(i, !!holiday)
          return (
            <div
              key={day}
              className={`py-2 text-center border-l border-gray-100 first:border-l-0 ${isToday ? 'bg-orange-50' : ''}`}
            >
              <span className={`text-xs font-semibold ${isToday ? 'text-brand' : colorClass}`}>
                {Number(d)}（{DOW_LABEL[i]}）
              </span>
              {holiday && (
                <div className="text-[9px] text-red-500 leading-tight truncate px-1">{holiday}</div>
              )}
            </div>
          )
        })}
      </div>

      {/* 日別予定グリッド */}
      <div className="grid grid-cols-7 min-h-[200px]">
        {weekDays.map((day, i) => {
          const daySchedules = schedulesByDay.get(day) ?? []
          const isToday = isTodayJst(day)
          return (
            <div
              key={day}
              className={`border-l border-t border-gray-100 first:border-l-0 p-1 min-h-[120px] cursor-pointer ${isToday ? 'bg-orange-50/40' : 'hover:bg-gray-50/50'}`}
              onClick={(e) => onEmptySlotClick?.(day, e)}
            >
              {daySchedules.length === 0 ? null : (
                <div className="space-y-0.5">
                  {daySchedules.map((s) => {
                    const colorClass = isMultiUser
                      ? (userColorMap.get(s.viewUserId) ?? USER_COLORS[0])
                      : (PUBLIC_FLAG_COLORS[s.publicFlag as 'O' | 'P' | 'C'] ?? USER_COLORS[0])
                    return (
                      <button
                        key={`${s.scheduleId}-${s.viewUserId}`}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onScheduleClick(s) }}
                        title={s.name}
                        className={`w-full text-left text-[10px] leading-tight rounded px-1 py-0.5 truncate hover:opacity-80 ${colorClass}`}
                      >
                        {!s.isAllDay && (
                          <span className="opacity-80 mr-0.5">{toJstTimeStr(s.startDate)}</span>
                        )}
                        {s.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
