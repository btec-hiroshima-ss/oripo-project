import { describe, it, expect } from 'vitest'
import {
  encodeRepeatPattern,
  decodeRepeatPattern,
  calcOccurrenceDates,
  getJstMidnightUtc,
  getJstTimeOffsetMs,
  msToIntervalStr,
} from './repeat'

// テスト用のJST→UTC変換ヘルパー
const jst = (dateStr: string) => new Date(dateStr + '+09:00')

describe('encodeRepeatPattern', () => {
  it('毎日・終了日なし', () => {
    expect(encodeRepeatPattern('daily', false)).toBe('DN')
  })
  it('毎日・終了日あり', () => {
    expect(encodeRepeatPattern('daily', true)).toBe('DL')
  })
  it('毎週・月〜金・終了日あり', () => {
    // [日, 月, 火, 水, 木, 金, 土] = [false, true, true, true, true, true, false]
    const weekDays = [false, true, true, true, true, true, false]
    expect(encodeRepeatPattern('weekly', true, weekDays)).toBe('W0111110L')
  })
  it('毎週・水曜のみ・終了日なし', () => {
    const weekDays = [false, false, false, true, false, false, false]
    expect(encodeRepeatPattern('weekly', false, weekDays)).toBe('W0001000N')
  })
  it('毎月15日・終了日なし', () => {
    expect(encodeRepeatPattern('monthly', false, undefined, 15)).toBe('M15N')
  })
  it('毎月5日・終了日あり（2桁ゼロ埋め）', () => {
    expect(encodeRepeatPattern('monthly', true, undefined, 5)).toBe('M05L')
  })
})

describe('decodeRepeatPattern', () => {
  it('DL → 毎日・終了日あり', () => {
    const result = decodeRepeatPattern('DL')
    expect(result.repeatType).toBe('daily')
    expect(result.hasLimit).toBe(true)
  })
  it('DN → 毎日・終了日なし', () => {
    const result = decodeRepeatPattern('DN')
    expect(result.repeatType).toBe('daily')
    expect(result.hasLimit).toBe(false)
  })
  it('W0111110L → 毎週月〜金・終了日あり', () => {
    const result = decodeRepeatPattern('W0111110L')
    expect(result.repeatType).toBe('weekly')
    expect(result.weekDays).toEqual([false, true, true, true, true, true, false])
    expect(result.hasLimit).toBe(true)
  })
  it('M15N → 毎月15日・終了日なし', () => {
    const result = decodeRepeatPattern('M15N')
    expect(result.repeatType).toBe('monthly')
    expect(result.monthDay).toBe(15)
    expect(result.hasLimit).toBe(false)
  })
  it('N → 繰り返しなし', () => {
    expect(decodeRepeatPattern('N').repeatType).toBe('none')
  })
  it('S → 繰り返しなし（終日）', () => {
    expect(decodeRepeatPattern('S').repeatType).toBe('none')
  })
})

describe('calcOccurrenceDates', () => {
  describe('毎日', () => {
    it('3日間分の出現日を返す', () => {
      const firstStart = jst('2026-07-01T10:00:00')
      const limitEndDate = jst('2026-07-03T11:00:00')
      const result = calcOccurrenceDates({ repeatType: 'daily', firstStart, limitEndDate })
      expect(result).toHaveLength(3)
      // 各要素はJST深夜0時（UTC: 前日15:00）
      expect(result[0]).toEqual(jst('2026-07-01T00:00:00'))
      expect(result[1]).toEqual(jst('2026-07-02T00:00:00'))
      expect(result[2]).toEqual(jst('2026-07-03T00:00:00'))
    })

    it('終了日なしの場合は最大730件を返す', () => {
      const firstStart = jst('2024-01-01T10:00:00')
      const result = calcOccurrenceDates({ repeatType: 'daily', firstStart, limitEndDate: null })
      expect(result).toHaveLength(730)
    })
  })

  describe('毎週', () => {
    it('水曜のみ・2週間で2件', () => {
      // 2026-07-01 = 水曜
      const firstStart = jst('2026-07-01T10:00:00')
      const limitEndDate = jst('2026-07-14T11:00:00')
      const weekDays = [false, false, false, true, false, false, false] // 水曜
      const result = calcOccurrenceDates({ repeatType: 'weekly', firstStart, weekDays, limitEndDate })
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(jst('2026-07-01T00:00:00')) // 水
      expect(result[1]).toEqual(jst('2026-07-08T00:00:00')) // 翌週水
    })

    it('月〜金・1週間で5件', () => {
      // 2026-06-29 = 月曜
      const firstStart = jst('2026-06-29T09:00:00')
      const limitEndDate = jst('2026-07-03T10:00:00')
      const weekDays = [false, true, true, true, true, true, false]
      const result = calcOccurrenceDates({ repeatType: 'weekly', firstStart, weekDays, limitEndDate })
      expect(result).toHaveLength(5)
    })
  })

  describe('毎月', () => {
    it('毎月15日・3ヶ月で3件', () => {
      const firstStart = jst('2026-05-15T10:00:00')
      const limitEndDate = jst('2026-07-15T11:00:00')
      const result = calcOccurrenceDates({ repeatType: 'monthly', firstStart, limitEndDate })
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual(jst('2026-05-15T00:00:00'))
      expect(result[1]).toEqual(jst('2026-06-15T00:00:00'))
      expect(result[2]).toEqual(jst('2026-07-15T00:00:00'))
    })

    it('終了日なしの場合は最大24件（2年分）', () => {
      const firstStart = jst('2024-01-31T10:00:00')
      // 1月31日: 2月は28/29日しかないので2月は含まれない
      const result = calcOccurrenceDates({ repeatType: 'monthly', firstStart, limitEndDate: null })
      // 31日がある月のみ: 1,3,5,7,8,10,12 → 2年で14件程度（2年以内に収まる）
      expect(result.length).toBeLessThanOrEqual(24)
      expect(result.length).toBeGreaterThan(0)
      // 全て31日であることを確認
      for (const d of result) {
        const jstDate = new Date(d.getTime() + 9 * 60 * 60 * 1000)
        expect(jstDate.getUTCDate()).toBe(31)
      }
    })
  })
})

describe('getJstMidnightUtc', () => {
  it('JST 10:00 の UTC Date から JST 深夜0時の UTC Date を返す', () => {
    // 2026-07-15 10:00 JST = 2026-07-15 01:00 UTC
    const input = jst('2026-07-15T10:00:00')
    // JST midnight = 2026-07-15 00:00 JST = 2026-07-14 15:00 UTC
    const expected = new Date('2026-07-14T15:00:00.000Z')
    expect(getJstMidnightUtc(input)).toEqual(expected)
  })
})

describe('getJstTimeOffsetMs', () => {
  it('JST 11:00 → 39600000 ms (11h)', () => {
    const input = jst('2026-07-15T11:00:00')
    expect(getJstTimeOffsetMs(input)).toBe(11 * 60 * 60 * 1000)
  })
  it('JST 00:00 → 0 ms', () => {
    const input = jst('2026-07-15T00:00:00')
    expect(getJstTimeOffsetMs(input)).toBe(0)
  })
})

describe('msToIntervalStr', () => {
  it('11時間 → "11:00:00"', () => {
    expect(msToIntervalStr(11 * 3600000)).toBe('11:00:00')
  })
  it('9時間30分 → "09:30:00"', () => {
    expect(msToIntervalStr(9 * 3600000 + 30 * 60000)).toBe('09:30:00')
  })
})
