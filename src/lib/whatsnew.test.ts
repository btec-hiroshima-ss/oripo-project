import { describe, it, expect } from 'vitest'
import {
  getAppLabel,
  getScheduleDisplayName,
  formatWhatsnewDate,
} from './whatsnew.utils'

describe('getAppLabel', () => {
  it('portlet_type=6 は「スケジュール」を返す', () => {
    expect(getAppLabel(6)).toBe('スケジュール')
  })

  it('未知の portlet_type は「更新情報」を返す', () => {
    expect(getAppLabel(99)).toBe('更新情報')
    expect(getAppLabel(0)).toBe('更新情報')
  })

  it('既知の portlet_type が正しいラベルを返す', () => {
    expect(getAppLabel(1)).toBe('ブログ')
    expect(getAppLabel(4)).toBe('掲示板')
    expect(getAppLabel(5)).toBe('メモ')
  })
})

describe('getScheduleDisplayName', () => {
  it('件名がある場合はそのまま返す', () => {
    expect(getScheduleDisplayName('週次定例MTG')).toBe('週次定例MTG')
    expect(getScheduleDisplayName('')).toBe('')
  })

  it('null（スケジュール削除済み）は「（削除済み）」を返す', () => {
    expect(getScheduleDisplayName(null)).toBe('（削除済み）')
  })
})

describe('formatWhatsnewDate', () => {
  it('HH:mm 形式でフォーマットする', () => {
    const date = new Date(2026, 6, 17, 9, 5) // 2026-07-17 09:05
    expect(formatWhatsnewDate(date)).toBe('09:05')
  })

  it('時・分が1桁の場合ゼロ埋めする', () => {
    const date = new Date(2026, 0, 3, 8, 4) // 08:04
    expect(formatWhatsnewDate(date)).toBe('08:04')
  })

  it('23:59 を正しくフォーマットする', () => {
    const date = new Date(2026, 11, 31, 23, 59)
    expect(formatWhatsnewDate(date)).toBe('23:59')
  })
})
