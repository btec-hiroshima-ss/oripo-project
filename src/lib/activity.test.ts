import { describe, it, expect } from 'vitest'
import { getScheduleDisplayName, formatActivityDate } from './activity.utils'

describe('getScheduleDisplayName', () => {
  it('件名がある場合はそのまま返す', () => {
    expect(getScheduleDisplayName('週次定例MTG')).toBe('週次定例MTG')
    expect(getScheduleDisplayName('')).toBe('')
  })

  it('null（パース失敗・削除済み）は「（削除済み）」を返す', () => {
    expect(getScheduleDisplayName(null)).toBe('（削除済み）')
  })
})

describe('formatActivityDate', () => {
  it('HH:mm 形式でフォーマットする', () => {
    const date = new Date(2026, 6, 17, 9, 5) // 2026-07-17 09:05
    expect(formatActivityDate(date)).toBe('09:05')
  })

  it('時・分が1桁の場合ゼロ埋めする', () => {
    const date = new Date(2026, 0, 3, 8, 4) // 08:04
    expect(formatActivityDate(date)).toBe('08:04')
  })

  it('23:59 を正しくフォーマットする', () => {
    const date = new Date(2026, 11, 31, 23, 59)
    expect(formatActivityDate(date)).toBe('23:59')
  })
})
