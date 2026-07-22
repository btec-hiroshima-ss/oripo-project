import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseJst, toJstStr, getWeekSchedules, addSchedule, updateSchedule, deleteSchedule } from './schedule'

// Kysely の流暢 API を模倣するモック。pages.test.ts と同構造。
const mockDb = vi.hoisted(() => {
  const m: Record<string, ReturnType<typeof vi.fn>> = {
    selectFrom: vi.fn(),
    insertInto: vi.fn(),
    updateTable: vi.fn(),
    deleteFrom: vi.fn(),
    innerJoin: vi.fn(),
    select: vi.fn(),
    where: vi.fn(),
    set: vi.fn(),
    values: vi.fn(),
    execute: vi.fn(),
    executeTakeFirstOrThrow: vi.fn(),
  }
  return m
})

vi.mock('./db', () => ({ db: mockDb }))

// logger はサーバーサイド専用。テストでは何もしないスタブに差し替える。
vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

beforeEach(() => {
  vi.resetAllMocks()
  for (const method of ['selectFrom', 'insertInto', 'updateTable', 'deleteFrom', 'innerJoin', 'select', 'where', 'set', 'values']) {
    mockDb[method].mockReturnValue(mockDb)
  }
})

// ===========================================================
describe('parseJst', () => {
  it('"YYYY-MM-DD HH:MM:SS" を JST として解釈し UTC Date に変換する', () => {
    const result = parseJst('2026-07-22 14:00:00')
    // 14:00 JST = 05:00 UTC
    expect(result.toISOString()).toBe('2026-07-22T05:00:00.000Z')
  })

  it('終日予定の "YYYY-MM-DD 00:00:00" を正しく変換する', () => {
    const result = parseJst('2026-07-22 00:00:00')
    // 00:00 JST = 前日 15:00 UTC
    expect(result.toISOString()).toBe('2026-07-21T15:00:00.000Z')
  })

  it('週の月曜 00:00 JST を正しく変換する', () => {
    const result = parseJst('2026-07-20 00:00:00')
    expect(result.toISOString()).toBe('2026-07-19T15:00:00.000Z')
  })
})

// ===========================================================
describe('toJstStr', () => {
  it('UTC Date を "YYYY-MM-DD HH:MM:SS"（JST）文字列に変換する', () => {
    // 2026-07-22T05:00:00Z = 14:00 JST
    const date = new Date('2026-07-22T05:00:00.000Z')
    expect(toJstStr(date)).toBe('2026-07-22 14:00:00')
  })

  it('parseJst のラウンドトリップが一致する', () => {
    const original = '2026-07-22 09:30:00'
    expect(toJstStr(parseJst(original))).toBe(original)
  })

  it('終日予定の 00:00 JST を正しく変換する', () => {
    // 前日 15:00 UTC = 当日 00:00 JST
    const date = new Date('2026-07-21T15:00:00.000Z')
    expect(toJstStr(date)).toBe('2026-07-22 00:00:00')
  })
})

// ===========================================================
describe('getWeekSchedules', () => {
  it('スケジュール行をフィールドマッピングして ScheduleEntry の配列を返す', async () => {
    mockDb.execute.mockResolvedValueOnce([
      {
        schedule_id: 1,
        name: '週次定例',
        note: null,
        place: '会議室A',
        start_date_text: '2026-07-22 10:00:00',
        end_date_text: '2026-07-22 11:00:00',
        public_flag: 'O',
        repeat_pattern: 'N',
        parent_id: 0,
        owner_id: 42,
      },
    ])

    const from = new Date('2026-07-19T15:00:00Z') // 2026-07-20 00:00 JST
    const to = new Date('2026-07-26T15:00:00Z')   // 2026-07-27 00:00 JST
    const result = await getWeekSchedules(42, from, to)

    expect(result).toHaveLength(1)
    expect(result[0].scheduleId).toBe(1)
    expect(result[0].name).toBe('週次定例')
    expect(result[0].place).toBe('会議室A')
    // 10:00 JST = 01:00 UTC
    expect(result[0].startDate.toISOString()).toBe('2026-07-22T01:00:00.000Z')
    expect(result[0].isAllDay).toBe(false)
    expect(result[0].isOwner).toBe(true)
    expect(result[0].parentId).toBe(0)
  })

  it('終日予定（repeat_pattern="S"）は isAllDay=true になる', async () => {
    mockDb.execute.mockResolvedValueOnce([
      {
        schedule_id: 2,
        name: '有給休暇',
        note: null,
        place: null,
        start_date_text: '2026-07-22 00:00:00',
        end_date_text: '2026-07-22 00:00:00',
        public_flag: 'P',
        repeat_pattern: 'S',
        parent_id: 0,
        owner_id: 42,
      },
    ])

    const result = await getWeekSchedules(42, new Date(), new Date())
    expect(result[0].isAllDay).toBe(true)
    expect(result[0].repeatPattern).toBe('S')
    expect(result[0].publicFlag).toBe('P')
  })

  it('繰り返し子レコード（parent_id > 0）は parentId > 0 で返る', async () => {
    mockDb.execute.mockResolvedValueOnce([
      {
        schedule_id: 10,
        name: '毎週定例',
        note: null,
        place: null,
        start_date_text: '2026-07-22 13:00:00',
        end_date_text: '2026-07-22 14:00:00',
        public_flag: 'O',
        repeat_pattern: 'N',
        parent_id: 5,
        owner_id: 42,
      },
    ])

    const result = await getWeekSchedules(42, new Date(), new Date())
    expect(result[0].parentId).toBe(5)
  })

  it('他ユーザーの予定は isOwner=false になる', async () => {
    mockDb.execute.mockResolvedValueOnce([
      {
        schedule_id: 3,
        name: '他者の予定',
        note: null,
        place: null,
        start_date_text: '2026-07-22 09:00:00',
        end_date_text: '2026-07-22 10:00:00',
        public_flag: 'O',
        repeat_pattern: 'N',
        parent_id: 0,
        owner_id: 99,
      },
    ])

    const result = await getWeekSchedules(42, new Date(), new Date())
    expect(result[0].isOwner).toBe(false)
  })
})

// ===========================================================
describe('addSchedule', () => {
  it('eip_t_schedule と eip_t_schedule_map の両方に INSERT する', async () => {
    // nextSeqId: 2 回の selectFrom→executeTakeFirstOrThrow
    mockDb.executeTakeFirstOrThrow
      .mockResolvedValueOnce({ seq_id: 100 })  // pk_eip_t_schedule
      .mockResolvedValueOnce({ seq_id: 200 })  // pk_eip_t_schedule_map
    // 2 回の INSERT execute
    mockDb.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const input = {
      name: '新規予定',
      startDate: new Date('2026-07-22T01:00:00Z'), // 10:00 JST
      endDate: new Date('2026-07-22T02:00:00Z'),   // 11:00 JST
      isAllDay: false,
      publicFlag: 'O' as const,
    }
    const result = await addSchedule(42, input)

    // 両テーブルに INSERT が呼ばれたこと
    expect(mockDb.insertInto).toHaveBeenCalledWith('eip_t_schedule')
    expect(mockDb.insertInto).toHaveBeenCalledWith('eip_t_schedule_map')
    // 戻り値の検証
    expect(result.scheduleId).toBe(100)
    expect(result.name).toBe('新規予定')
    expect(result.isOwner).toBe(true)
    expect(result.parentId).toBe(0)
  })

  it('終日予定は repeat_pattern="S"、end_date が start_date と同じになる', async () => {
    mockDb.executeTakeFirstOrThrow
      .mockResolvedValueOnce({ seq_id: 101 })
      .mockResolvedValueOnce({ seq_id: 201 })
    mockDb.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([])

    const startDate = new Date('2026-07-21T15:00:00Z') // 2026-07-22 00:00 JST
    await addSchedule(42, {
      name: '終日テスト',
      startDate,
      endDate: new Date('2026-07-22T15:00:00Z'),
      isAllDay: true,
      publicFlag: 'P',
    })

    const valuesCall = mockDb.values.mock.calls[0][0]
    expect(valuesCall.repeat_pattern).toBe('S')
    // all-day は start_date = end_date（AIPO 準拠）
    expect(valuesCall.start_date).toBe(valuesCall.end_date)
    expect(valuesCall.start_date).toBe('2026-07-22 00:00:00')
  })

  it('schedule_map には type="U", status="O" が設定される', async () => {
    mockDb.executeTakeFirstOrThrow
      .mockResolvedValueOnce({ seq_id: 102 })
      .mockResolvedValueOnce({ seq_id: 202 })
    mockDb.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([])

    await addSchedule(42, {
      name: 'テスト',
      startDate: new Date('2026-07-22T01:00:00Z'),
      endDate: new Date('2026-07-22T02:00:00Z'),
      isAllDay: false,
      publicFlag: 'O',
    })

    // insertInto の2回目の呼び出し = schedule_map
    const mapValuesCall = mockDb.values.mock.calls[1][0]
    expect(mapValuesCall.type).toBe('U')
    expect(mapValuesCall.status).toBe('O')
    expect(mapValuesCall.user_id).toBe(42)
  })
})

// ===========================================================
describe('updateSchedule', () => {
  it('owner_id = userId の条件で UPDATE する', async () => {
    mockDb.execute.mockResolvedValueOnce([])

    await updateSchedule(1, 42, {
      name: '更新後タイトル',
      startDate: new Date('2026-07-22T01:00:00Z'),
      endDate: new Date('2026-07-22T02:00:00Z'),
      isAllDay: false,
      publicFlag: 'O',
    })

    expect(mockDb.updateTable).toHaveBeenCalledWith('eip_t_schedule')
    // owner_id 条件が WHERE に含まれること（他ユーザーの予定を更新できないようにする）
    expect(mockDb.where).toHaveBeenCalledWith('owner_id', '=', 42)
    expect(mockDb.where).toHaveBeenCalledWith('schedule_id', '=', 1)
  })

  it('SET に name, start_date, end_date, public_flag が含まれる', async () => {
    mockDb.execute.mockResolvedValueOnce([])

    await updateSchedule(1, 42, {
      name: '変更タイトル',
      place: '新会議室',
      startDate: new Date('2026-07-22T01:00:00Z'),
      endDate: new Date('2026-07-22T02:00:00Z'),
      isAllDay: false,
      publicFlag: 'P',
    })

    const setArg = mockDb.set.mock.calls[0][0]
    expect(setArg.name).toBe('変更タイトル')
    expect(setArg.place).toBe('新会議室')
    expect(setArg.public_flag).toBe('P')
    expect(setArg.start_date).toBe('2026-07-22 10:00:00') // 01:00 UTC = 10:00 JST
  })
})

// ===========================================================
describe('deleteSchedule', () => {
  it('eip_t_schedule_map と eip_t_schedule の両方を削除する', async () => {
    mockDb.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([])

    await deleteSchedule(5, 42)

    expect(mockDb.deleteFrom).toHaveBeenCalledWith('eip_t_schedule_map')
    expect(mockDb.deleteFrom).toHaveBeenCalledWith('eip_t_schedule')
  })

  it('eip_t_schedule の削除に owner_id 条件が含まれる', async () => {
    mockDb.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([])

    await deleteSchedule(5, 42)

    // where の呼び出し履歴から owner_id 条件を確認
    expect(mockDb.where).toHaveBeenCalledWith('owner_id', '=', 42)
    expect(mockDb.where).toHaveBeenCalledWith('schedule_id', '=', 5)
  })

  it('schedule_map は schedule_id のみで削除する（owner チェック不要）', async () => {
    mockDb.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([])

    await deleteSchedule(5, 42)

    // deleteFrom('eip_t_schedule_map') 直後の where は schedule_id だけ
    const firstDeleteFromCall = mockDb.deleteFrom.mock.calls[0][0]
    expect(firstDeleteFromCall).toBe('eip_t_schedule_map')
  })
})
