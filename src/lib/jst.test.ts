import { describe, test, expect } from 'vitest'
import {
  toJstDateStr,
  toJstTimeStr,
  toJstDateJa,
  isTodayJst,
  toJstMinutesSinceMidnight,
  formatJstDatetime,
  makeDateJst,
} from './jst'

// 受け入れ条件ベースのテスト:
// UTC の Date を渡したとき JST（UTC+9）の日時表現に変換されること

describe('toJstDateStr', () => {
  test('UTC日付を JST の日付文字列に変換する', () => {
    // 2026-07-22 00:00:00 UTC = 2026-07-22 09:00:00 JST
    expect(toJstDateStr(new Date('2026-07-22T00:00:00Z'))).toBe('2026-07-22')
  })

  test('日付をまたぐ UTC 時刻は JST の翌日になる', () => {
    // 2026-07-22 16:00:00 UTC = 2026-07-23 01:00:00 JST
    expect(toJstDateStr(new Date('2026-07-22T16:00:00Z'))).toBe('2026-07-23')
  })

  test('UTC 15:59:59 は JST では翌日 00:59:59', () => {
    // 2026-07-22T15:59:59Z = 2026-07-23T00:59:59+09:00
    expect(toJstDateStr(new Date('2026-07-22T15:59:59Z'))).toBe('2026-07-23')
  })

  test('UTC 14:59:59 はまだ同日（JST 23:59:59）', () => {
    // 2026-07-22T14:59:59Z = 2026-07-22T23:59:59+09:00
    expect(toJstDateStr(new Date('2026-07-22T14:59:59Z'))).toBe('2026-07-22')
  })
})

describe('toJstTimeStr', () => {
  test('UTC 00:00 → JST 09:00', () => {
    expect(toJstTimeStr(new Date('2026-07-22T00:00:00Z'))).toBe('09:00')
  })

  test('UTC 23:30 → JST 08:30（翌日）', () => {
    expect(toJstTimeStr(new Date('2026-07-22T23:30:00Z'))).toBe('08:30')
  })

  test('分のゼロ埋めが正しい', () => {
    expect(toJstTimeStr(new Date('2026-07-22T00:05:00Z'))).toBe('09:05')
  })
})

describe('toJstDateJa', () => {
  test('UTC日付を日本語日付表示に変換する', () => {
    // 2026-07-22 は水曜日
    expect(toJstDateJa(new Date('2026-07-22T00:00:00Z'))).toBe('2026年7月22日（水）')
  })

  test('日曜日の曜日表示が正しい', () => {
    // 2026-07-19 は日曜日
    expect(toJstDateJa(new Date('2026-07-19T00:00:00Z'))).toBe('2026年7月19日（日）')
  })

  test('土曜日の曜日表示が正しい', () => {
    // 2026-07-18 は土曜日
    expect(toJstDateJa(new Date('2026-07-18T00:00:00Z'))).toBe('2026年7月18日（土）')
  })

  test('UTC 夕方（JST 翌日）は翌日の曜日になる', () => {
    // 2026-07-22T16:00:00Z = 2026-07-23 JST (木曜)
    expect(toJstDateJa(new Date('2026-07-22T16:00:00Z'))).toBe('2026年7月23日（木）')
  })
})

describe('isTodayJst', () => {
  test('今日の JST 日付文字列で true を返す', () => {
    const today = toJstDateStr(new Date())
    expect(isTodayJst(today)).toBe(true)
  })

  test('昨日の日付で false を返す', () => {
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const yesterday = toJstDateStr(d)
    // 今日と昨日が同じ日になることはない
    if (yesterday !== toJstDateStr(new Date())) {
      expect(isTodayJst(yesterday)).toBe(false)
    }
  })
})

describe('toJstMinutesSinceMidnight', () => {
  test('UTC 00:00 → JST 09:00 = 540分', () => {
    expect(toJstMinutesSinceMidnight(new Date('2026-07-22T00:00:00Z'))).toBe(540)
  })

  test('UTC 14:30 → JST 23:30 = 1410分', () => {
    expect(toJstMinutesSinceMidnight(new Date('2026-07-22T14:30:00Z'))).toBe(1410)
  })

  test('UTC 15:00 → JST 00:00 (翌日) = 0分', () => {
    expect(toJstMinutesSinceMidnight(new Date('2026-07-22T15:00:00Z'))).toBe(0)
  })
})

describe('makeDateJst', () => {
  test('"YYYY-MM-DD" と "HH:MM" から JST の Date を返す', () => {
    // 2026-07-22 10:00 JST = 2026-07-22 01:00:00 UTC
    const result = makeDateJst('2026-07-22', '10:00')
    expect(result.toISOString()).toBe('2026-07-22T01:00:00.000Z')
  })

  test('timeStr を省略すると 00:00 JST（その日の深夜0時）になる', () => {
    // 2026-07-22 00:00 JST = 2026-07-21 15:00:00 UTC
    const result = makeDateJst('2026-07-22')
    expect(result.toISOString()).toBe('2026-07-21T15:00:00.000Z')
  })

  test('日付をまたぐ深夜 00:30 JST が正しく変換される', () => {
    // 2026-07-22 00:30 JST = 2026-07-21 15:30:00 UTC
    const result = makeDateJst('2026-07-22', '00:30')
    expect(result.toISOString()).toBe('2026-07-21T15:30:00.000Z')
  })
})

describe('formatJstDatetime', () => {
  test('日付のみの JST 文字列を日本語に変換する', () => {
    expect(formatJstDatetime('2026-07-22')).toBe('2026年7月22日')
  })

  test('日時の JST 文字列を日本語に変換する', () => {
    expect(formatJstDatetime('2026-07-22 09:05:00')).toBe('2026年7月22日 9時05分')
  })

  test('分のゼロ埋めが正しい', () => {
    expect(formatJstDatetime('2026-07-22 10:00:00')).toBe('2026年7月22日 10時00分')
  })
})
