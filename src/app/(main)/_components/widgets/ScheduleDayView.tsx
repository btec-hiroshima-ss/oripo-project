'use client'

import type { MultiUserScheduleEntry } from '@/lib/schedule.types'
import { HOUR_PX, MIN_BLOCK_PX, USER_COLORS, PUBLIC_FLAG_COLORS, USER_BLOCK_COLORS, PUBLIC_FLAG_BLOCK_CLASSES } from '@/lib/schedule.constants'
import { getDay, parseISO } from 'date-fns'
import { toJstDateStr, toJstTimeStr, isTodayJst, toJstMinutesSinceMidnight } from '@/lib/jst'

type PositionedSchedule = MultiUserScheduleEntry & {
  colIndex: number
  colCount: number
  colorClass: string      // 終日帯など全背景塗りつぶし用クラス
  blockColorClass: string // 時刻グリッドのブロック用（左端バー + 薄い背景）
}

/** 同日の予定に横並び位置と色クラスを割り当てる（週ビューの positionSchedules と同ロジック） */
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
    colorClass: isMultiUser
      ? (userColorMap.get(s.viewUserId) ?? USER_COLORS[0])
      : (PUBLIC_FLAG_COLORS[s.publicFlag as 'O' | 'P' | 'C'] ?? USER_COLORS[0]),
    // 時刻グリッドのブロック用スタイル（左端カラーバー + 薄い背景）
    blockColorClass: isMultiUser
      ? (() => {
          const colorVal = userColorMap.get(s.viewUserId) ?? USER_COLORS[0]
          const idx = (USER_COLORS as readonly string[]).indexOf(colorVal)
          return USER_BLOCK_COLORS[idx >= 0 ? idx : 0]
        })()
      : (PUBLIC_FLAG_BLOCK_CLASSES[s.publicFlag as 'O' | 'P' | 'C'] ?? USER_BLOCK_COLORS[0]),
  }))
}

type Props = {
  /** 表示日（YYYY-MM-DD）*/
  viewDate: string
  schedules: MultiUserScheduleEntry[]
  userColorMap: Map<number, string>
  isMultiUser: boolean
  /** isMultiUser=true 時にユーザー列ヘッダーを表示するためのユーザー順序リスト */
  viewUserIds: number[]
  /** userId → 表示名（ヘッダー用） */
  userNames: Map<number, string>
  holidays: Record<string, string>
  onScheduleClick: (schedule: MultiUserScheduleEntry) => void
  /** 空き時間クリックで予定追加（AIPO準拠）: クリック日と時刻を渡す */
  onEmptySlotClick?: (dateStr: string, e: React.MouseEvent<HTMLDivElement>) => void
}

export default function ScheduleDayView({
  viewDate,
  schedules,
  userColorMap,
  isMultiUser,
  viewUserIds,
  userNames,
  holidays,
  onScheduleClick,
  onEmptySlotClick,
}: Props) {
  const [y, m, d] = viewDate.split('-').map(Number)
  const dow = getDay(parseISO(viewDate))
  const DOW_ALL = ['日', '月', '火', '水', '木', '金', '土']

  const holiday = holidays[viewDate] ?? null
  const colorClass = holiday
    ? 'text-red-600'
    : dow === 6 ? 'text-blue-600'
    : dow === 0 ? 'text-red-600'
    : 'text-gray-700'

  const allDaySchedules = schedules.filter((s) => s.isAllDay)
  const timedSchedules = schedules.filter((s) => !s.isAllDay)
  const hasAllDay = allDaySchedules.length > 0

  const isToday = isTodayJst(viewDate)

  // マルチユーザー: ユーザーごとに別列で表示（AIPO oneday-group 準拠）
  if (isMultiUser && viewUserIds.length > 1) {
    return (
      // min-width: 時刻軸 40px + ユーザー列 × 最小 80px
      <div className="min-w-[490px]">
        {/* 日付ヘッダー（sticky top-0） */}
        <div className="flex sticky top-0 z-20 bg-white border-b border-gray-200">
          <div className="w-10 shrink-0 sticky left-0 z-30 bg-white" />
          <div className={`flex-1 text-center py-2 ${isToday ? 'bg-orange-50' : ''}`}>
            <div className={`text-sm font-semibold ${isToday ? 'text-brand' : colorClass}`}>
              {y}年{m}月{d}日（{DOW_ALL[dow]}）
            </div>
            {holiday && (
              <div className="text-[9px] text-red-500 leading-tight">{holiday}</div>
            )}
          </div>
        </div>

        {/* ユーザー名列ヘッダー（sticky） */}
        <div className="flex sticky top-[42px] z-20 bg-white border-b border-gray-200">
          <div className="w-10 shrink-0 sticky left-0 z-30 bg-white" />
          {viewUserIds.map((uid, i) => {
            const color = USER_COLORS[i % USER_COLORS.length]
            return (
              <div key={uid} className={`flex-1 text-center py-1 border-l border-gray-100 text-xs font-medium truncate px-1 ${color}`}>
                {userNames.get(uid) ?? `ユーザー${uid}`}
              </div>
            )
          })}
        </div>

        {/* 終日予定行（ある場合のみ） */}
        {hasAllDay && (
          <div className="flex sticky top-[74px] z-20 bg-white border-b border-gray-200 min-h-[28px]">
            <div className="w-10 shrink-0 sticky left-0 z-30 bg-white flex items-center justify-center">
              <span className="text-[10px] text-gray-400">終日</span>
            </div>
            {viewUserIds.map((uid) => {
              const userAllDay = allDaySchedules.filter((s) => s.viewUserId === uid)
              return (
                <div key={uid} className="flex-1 border-l border-gray-100 p-0.5 space-y-0.5">
                  {userAllDay.map((s) => (
                    <button
                      key={`${s.scheduleId}-${s.viewUserId}`}
                      type="button"
                      className={`w-full text-left text-xs truncate rounded px-1 py-0.5 hover:opacity-90 ${userColorMap.get(uid) ?? USER_COLORS[0]}`}
                      onClick={() => onScheduleClick(s)}
                      title={s.name}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {/* 時刻グリッド（ユーザー別列） */}
        <div className="relative flex">
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
          {viewUserIds.map((uid) => {
            const userTimed = timedSchedules.filter((s) => s.viewUserId === uid)
            const positioned = positionSchedules(userTimed, userColorMap, true)
            return (
              <div
                key={uid}
                className="flex-1 relative min-w-0 border-l border-gray-100 cursor-pointer"
                onClick={(e) => onEmptySlotClick?.(viewDate, e)}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    className={`border-t ${h % 6 === 0 ? 'border-gray-200' : 'border-gray-100'}`}
                    style={{ height: HOUR_PX }}
                  />
                ))}
                {positioned.map((ps) => {
                  const startMin = toJstMinutesSinceMidnight(ps.startDate)
                  const endMin = Math.min(toJstMinutesSinceMidnight(ps.endDate), 24 * 60)
                  const top = (startMin / 60) * HOUR_PX
                  const height = Math.max(MIN_BLOCK_PX, ((endMin - startMin) / 60) * HOUR_PX)
                  const widthPct = 100 / ps.colCount
                  const leftPct = (ps.colIndex / ps.colCount) * 100
                  return (
                    <button
                      key={`${ps.scheduleId}-${ps.viewUserId}`}
                      type="button"
                      className={`absolute rounded px-0.5 py-0.5 text-left overflow-hidden hover:opacity-90 transition-opacity ${ps.blockColorClass}`}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        left: `calc(${leftPct}% + 1px)`,
                        width: `calc(${widthPct}% - 2px)`,
                      }}
                      onClick={() => onScheduleClick(ps)}
                      title={ps.name}
                      aria-label={`${ps.name} ${toJstTimeStr(ps.startDate)}`}
                    >
                      <span className="text-xs font-medium block truncate leading-tight">{ps.name}</span>
                      {height >= 30 && (
                        <span className="text-xs opacity-90 block truncate leading-tight">
                          {toJstTimeStr(ps.startDate)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // 単一ユーザー: 従来の1列表示
  const positioned = positionSchedules(timedSchedules, userColorMap, isMultiUser)

  return (
    <div className="min-w-[320px]">
      {/* 日付ヘッダー（sticky top-0） */}
      <div className="flex sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="w-10 shrink-0 sticky left-0 z-30 bg-white" />
        <div className={`flex-1 text-center py-2 ${isToday ? 'bg-orange-50' : ''}`}>
          <div className={`text-sm font-semibold ${isToday ? 'text-brand' : colorClass}`}>
            {y}年{m}月{d}日（{DOW_ALL[dow]}）
          </div>
          {holiday && (
            <div className="text-[9px] text-red-500 leading-tight">{holiday}</div>
          )}
        </div>
      </div>

      {/* 終日予定行（ある場合のみ） */}
      {hasAllDay && (
        <div className="flex sticky top-[42px] z-20 bg-white border-b border-gray-200 min-h-[28px]">
          <div className="w-10 shrink-0 sticky left-0 z-30 bg-white flex items-center justify-center">
            <span className="text-[10px] text-gray-400">終日</span>
          </div>
          <div className="flex-1 p-0.5 space-y-0.5">
            {allDaySchedules.map((s) => {
              const color = isMultiUser
                ? (userColorMap.get(s.viewUserId) ?? USER_COLORS[0])
                : PUBLIC_FLAG_COLORS[s.publicFlag as 'O' | 'P' | 'C']
              return (
                <button
                  key={`${s.scheduleId}-${s.viewUserId}`}
                  type="button"
                  className={`w-full text-left text-xs truncate rounded px-1 py-0.5 hover:opacity-90 ${color}`}
                  onClick={() => onScheduleClick(s)}
                  title={s.name}
                >
                  {s.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 時刻グリッド */}
      <div className="relative flex">
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

        <div
          className="flex-1 relative min-w-0 border-l border-gray-100 cursor-pointer"
          onClick={(e) => onEmptySlotClick?.(viewDate, e)}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              className={`border-t ${h % 6 === 0 ? 'border-gray-200' : 'border-gray-100'}`}
              style={{ height: HOUR_PX }}
            />
          ))}
          {positioned.map((ps) => {
            const startMin = toJstMinutesSinceMidnight(ps.startDate)
            const endMin = Math.min(toJstMinutesSinceMidnight(ps.endDate), 24 * 60)
            const top = (startMin / 60) * HOUR_PX
            const height = Math.max(MIN_BLOCK_PX, ((endMin - startMin) / 60) * HOUR_PX)
            const widthPct = 100 / ps.colCount
            const leftPct = (ps.colIndex / ps.colCount) * 100
            return (
              <button
                key={`${ps.scheduleId}-${ps.viewUserId}`}
                type="button"
                className={`absolute rounded px-0.5 py-0.5 text-left overflow-hidden hover:opacity-90 transition-opacity ${ps.blockColorClass}`}
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                  left: `calc(${leftPct}% + 1px)`,
                  width: `calc(${widthPct}% - 2px)`,
                }}
                onClick={() => onScheduleClick(ps)}
                title={ps.name}
                aria-label={`${ps.name} ${toJstTimeStr(ps.startDate)}`}
              >
                <span className="text-xs font-medium block truncate leading-tight">{ps.name}</span>
                {height >= 30 && (
                  <span className="text-xs opacity-90 block truncate leading-tight">
                    {toJstTimeStr(ps.startDate)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
