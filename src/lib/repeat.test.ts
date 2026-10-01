import { describe, it, expect } from 'vitest'
import {
  encodeRepeatPattern,
  decodeRepeatPattern,
  getJstTimeOffsetMs,
  msToIntervalStr,
  addDaysToDateStr,
  isRepeatMatch,
  isRepeatPattern,
  occurrenceRange,
  listPatternDates,
  findFirstPatternDate,
  expandRepeatEntries,
  dummyKey,
  findBookedFacilityIds,
  describeRepeat,
  type FacilityBooking,
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

// ===========================================================
// Phase F（#211）: 動的展開
// ===========================================================

describe('addDaysToDateStr', () => {
  it('月末・年末をまたいで日付を加減算する', () => {
    expect(addDaysToDateStr('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDaysToDateStr('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysToDateStr('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('isRepeatPattern', () => {
  it("'N'・'S' 以外を繰り返しの親とみなす", () => {
    expect(isRepeatPattern('W0000100L')).toBe(true)
    expect(isRepeatPattern('DN')).toBe(true)
    expect(isRepeatPattern('N')).toBe(false)
    expect(isRepeatPattern('S')).toBe(false)
  })
})

describe('isRepeatMatch', () => {
  // 毎週木曜 15:50〜17:00、2026-01-01（木）〜2026-12-31（木）
  const weeklyStart = jst('2026-01-01T15:50:00')
  const weeklyEnd = jst('2026-12-31T17:00:00')

  it('毎週: 該当する曜日だけ出現する', () => {
    expect(isRepeatMatch('2026-10-08', 'W0000100L', weeklyStart, weeklyEnd)).toBe(true)  // 木
    expect(isRepeatMatch('2026-10-07', 'W0000100L', weeklyStart, weeklyEnd)).toBe(false) // 水
  })

  it('終了日あり: 開始日・終了日を含み、範囲外には出現しない', () => {
    expect(isRepeatMatch('2026-01-01', 'W0000100L', weeklyStart, weeklyEnd)).toBe(true)
    expect(isRepeatMatch('2026-12-31', 'W0000100L', weeklyStart, weeklyEnd)).toBe(true)
    expect(isRepeatMatch('2025-12-25', 'W0000100L', weeklyStart, weeklyEnd)).toBe(false)
    expect(isRepeatMatch('2027-01-07', 'W0000100L', weeklyStart, weeklyEnd)).toBe(false)
  })

  it('終了日なし: 開始日より前には出現しない（AIPO からの意図的な逸脱）', () => {
    // 親の end_date は最初の出現の終了時刻（同日）
    const start = jst('2026-01-01T15:50:00')
    const end = jst('2026-01-01T17:00:00')
    expect(isRepeatMatch('2025-12-25', 'W0000100N', start, end)).toBe(false)
    expect(isRepeatMatch('2026-01-01', 'W0000100N', start, end)).toBe(true)
    expect(isRepeatMatch('2030-01-03', 'W0000100N', start, end)).toBe(true)
  })

  it('毎日: 期間内のすべての日に出現する', () => {
    const start = jst('2026-10-01T09:00:00')
    const end = jst('2026-10-03T10:00:00')
    expect(isRepeatMatch('2026-10-02', 'DL', start, end)).toBe(true)
    expect(isRepeatMatch('2026-10-04', 'DL', start, end)).toBe(false)
  })

  it('毎月 31 日: 31 日が無い月には出現しない（AIPO 準拠）', () => {
    const start = jst('2026-01-31T10:00:00')
    const end = jst('2026-01-31T11:00:00')
    expect(isRepeatMatch('2026-03-31', 'M31N', start, end)).toBe(true)
    expect(isRepeatMatch('2026-04-30', 'M31N', start, end)).toBe(false)
  })

  it("繰り返しでないパターン（'N'・'S'）は出現しない", () => {
    expect(isRepeatMatch('2026-10-08', 'N', weeklyStart, weeklyEnd)).toBe(false)
  })
})

describe('occurrenceRange', () => {
  it('出現日に親の開始・終了の時:分を組み合わせる', () => {
    const { startDate, endDate } = occurrenceRange('2026-10-08', jst('2025-06-05T15:50:00'), jst('2027-01-31T17:00:00'))
    expect(startDate.toISOString()).toBe(jst('2026-10-08T15:50:00').toISOString())
    expect(endDate.toISOString()).toBe(jst('2026-10-08T17:00:00').toISOString())
  })
})

describe('listPatternDates / findFirstPatternDate', () => {
  it('範囲内でパターンに一致する日付を返す', () => {
    // 2026-10-01 は木曜
    expect(listPatternDates('W0100010L', '2026-10-01', '2026-10-10')).toEqual(['2026-10-02', '2026-10-05', '2026-10-09'])
  })

  it('最初の出現日を返す（毎月 31 日は 31 日のある月まで進む）', () => {
    expect(findFirstPatternDate('W0000100N', '2026-10-01')).toBe('2026-10-01')
    expect(findFirstPatternDate('M31N', '2026-04-01')).toBe('2026-05-31')
  })
})

describe('expandRepeatEntries', () => {
  // 毎週木曜 15:50〜17:00、2026-01-01〜2026-12-31
  const parent = {
    scheduleId: 100,
    name: 'SEミーティング',
    startDate: jst('2026-01-01T15:50:00'),
    endDate: jst('2026-12-31T17:00:00'),
    repeatPattern: 'W0000100L',
    parentId: 0,
  }
  // 2026-10-04（日）〜2026-10-11（日）の週
  const from = jst('2026-10-04T00:00:00')
  const to = jst('2026-10-11T00:00:00')

  it('表示期間内の該当する曜日に出現を生成し、親 ID・出現日・親の期間を持たせる', () => {
    const result = expandRepeatEntries([parent], new Set(), from, to)
    expect(result).toHaveLength(1)
    expect(result[0].scheduleId).toBe(100)
    expect(result[0].parentId).toBe(0)
    expect(result[0].occurrenceDate).toBe('2026-10-08')
    expect(result[0].startDate.toISOString()).toBe(jst('2026-10-08T15:50:00').toISOString())
    expect(result[0].repeatStartDate).toBe(parent.startDate)
    expect(result[0].repeatEndDate).toBe(parent.endDate)
  })

  it('同じ親のダミーがある日の出現は除外する（個別削除・個別変更した回）', () => {
    const result = expandRepeatEntries([parent], new Set([dummyKey(100, '2026-10-08')]), from, to)
    expect(result).toHaveLength(0)
  })

  it('別の親のダミーでは除外しない', () => {
    const result = expandRepeatEntries([parent], new Set([dummyKey(999, '2026-10-08')]), from, to)
    expect(result).toHaveLength(1)
  })

  it('繰り返しの期間外の週には出現しない', () => {
    const result = expandRepeatEntries([parent], new Set(), jst('2027-01-03T00:00:00'), jst('2027-01-10T00:00:00'))
    expect(result).toHaveLength(0)
  })
})

describe('findBookedFacilityIds', () => {
  // 既存予約: 設備 1 = 2026-10-30 12:00〜19:00 の通常予定、設備 2 = 毎週木曜 15:50〜17:00 の繰り返し
  const normal: FacilityBooking = {
    scheduleId: 10, facilityId: 1, repeatPattern: 'N',
    startDate: jst('2026-10-30T12:00:00'), endDate: jst('2026-10-30T19:00:00'),
  }
  const weekly: FacilityBooking = {
    scheduleId: 20, facilityId: 2, repeatPattern: 'W0000100L',
    startDate: jst('2025-06-05T15:50:00'), endDate: jst('2027-01-31T17:00:00'),
  }
  const bookings = [normal, weekly]

  it('通常予定と時刻が重なる設備を使用中にする（従来通り）', () => {
    const result = findBookedFacilityIds(
      { startDate: jst('2026-10-30T13:00:00'), endDate: jst('2026-10-30T14:00:00') }, bookings, new Set(),
    )
    expect(result).toEqual([1])
  })

  it('繰り返し予定の出現と時刻が重なる設備を使用中にする（#204）', () => {
    const result = findBookedFacilityIds(
      { startDate: jst('2026-10-08T16:00:00'), endDate: jst('2026-10-08T16:30:00') }, bookings, new Set(),
    )
    expect(result).toEqual([2])
  })

  it('出現の無い曜日・ダミーで削除された日では使用中にしない', () => {
    // 水曜
    expect(findBookedFacilityIds(
      { startDate: jst('2026-10-07T16:00:00'), endDate: jst('2026-10-07T16:30:00') }, bookings, new Set(),
    )).toEqual([])
    // ダミーのある木曜
    expect(findBookedFacilityIds(
      { startDate: jst('2026-10-08T16:00:00'), endDate: jst('2026-10-08T16:30:00') }, bookings, new Set([dummyKey(20, '2026-10-08')]),
    )).toEqual([])
  })

  it('「この予定のみ変更」では変更元の出現だけを除外する', () => {
    const target = { startDate: jst('2026-10-08T16:00:00'), endDate: jst('2026-10-08T16:30:00') }
    expect(findBookedFacilityIds(target, bookings, new Set(), { scheduleId: 20, date: '2026-10-08' })).toEqual([])
    // 別の日の出現を除外しても、対象日の出現は使用中のまま
    expect(findBookedFacilityIds(target, bookings, new Set(), { scheduleId: 20, date: '2026-10-15' })).toEqual([2])
  })

  it('通常予定の編集時は編集中の予定自身を除外する', () => {
    const target = { startDate: jst('2026-10-30T13:00:00'), endDate: jst('2026-10-30T14:00:00') }
    expect(findBookedFacilityIds(target, bookings, new Set(), { scheduleId: 10 })).toEqual([])
  })

  it('新しく作る繰り返しは、いずれかの出現が重なる設備を使用中にする', () => {
    // 毎週金曜 13:00〜14:00、2026-10-01〜2026-12-31 → 10/30（金）の通常予定と重なる
    const result = findBookedFacilityIds(
      {
        startDate: jst('2026-10-02T13:00:00'),
        endDate: jst('2026-10-02T14:00:00'),
        repeat: { pattern: 'W0000010L', limitStartDate: jst('2026-10-01T00:00:00'), limitEndDate: jst('2026-12-31T00:00:00') },
      },
      bookings,
      new Set(),
    )
    expect(result).toEqual([1])
  })

  it('終了日なしの繰り返しどうしは、同じ曜日・時刻なら使用中、曜日が違えば使用中にしない', () => {
    const unlimited: FacilityBooking = {
      scheduleId: 30, facilityId: 3, repeatPattern: 'W0100000N',
      startDate: jst('2026-01-05T10:00:00'), endDate: jst('2026-01-05T11:00:00'),
    }
    const target = (pattern: string) => ({
      startDate: jst('2026-10-05T10:30:00'),
      endDate: jst('2026-10-05T11:30:00'),
      repeat: { pattern, limitStartDate: jst('2026-10-05T00:00:00'), limitEndDate: null },
    })
    expect(findBookedFacilityIds(target('W0100000N'), [unlimited], new Set())).toEqual([3])
    expect(findBookedFacilityIds(target('W0010000N'), [unlimited], new Set())).toEqual([])
  })

  it('全ての予定を変更: 対象自身のダミーがある日（個別変更・個別削除）は確認しない', () => {
    // 対象 = 既存の毎週木曜の繰り返し（親 ID 20）を「全ての予定を変更」。10/8 は個別変更済みで、
    // 個別変更レコード（通常予定 ID 21）が親から設備 2 を引き継いでいる
    const modified: FacilityBooking = {
      scheduleId: 21, facilityId: 2, repeatPattern: 'N',
      startDate: jst('2026-10-08T13:00:00'), endDate: jst('2026-10-08T14:00:00'),
    }
    const target = {
      startDate: jst('2026-10-08T13:00:00'),
      endDate: jst('2026-10-08T14:00:00'),
      repeat: { pattern: 'W0000100L', limitStartDate: jst('2025-06-05T00:00:00'), limitEndDate: jst('2027-01-31T00:00:00') },
    }
    const dummies = new Set([dummyKey(20, '2026-10-08')])
    expect(findBookedFacilityIds(target, [weekly, modified], dummies, { scheduleId: 20 })).toEqual([])
    // ダミーが無ければ、同じ日時の個別変更レコードと重なるので使用中
    expect(findBookedFacilityIds(target, [weekly, modified], new Set(), { scheduleId: 20 })).toEqual([2])
  })

  it('開始と終了が同じ時刻（長さ 0）の繰り返しは使用中にしない', () => {
    const zero: FacilityBooking = {
      scheduleId: 40, facilityId: 4, repeatPattern: 'DN',
      startDate: jst('2026-01-01T00:00:00'), endDate: jst('2026-01-01T00:00:00'),
    }
    expect(findBookedFacilityIds(
      { startDate: jst('2026-10-08T00:00:00'), endDate: jst('2026-10-08T01:00:00') }, [zero], new Set(),
    )).toEqual([])
  })
})

describe('describeRepeat', () => {
  it('毎週・終了日あり', () => {
    expect(describeRepeat('W0000100L', jst('2025-06-05T15:50:00'), jst('2027-01-31T17:00:00')))
      .toBe('毎週 木 15:50〜17:00（2025/06/05〜2027/01/31）')
  })
  it('毎月・終了日なし', () => {
    expect(describeRepeat('M15N', jst('2026-01-15T10:00:00'), jst('2026-01-15T11:00:00')))
      .toBe('毎月 15日 10:00〜11:00')
  })
})
