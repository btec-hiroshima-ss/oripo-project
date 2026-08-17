import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseJst, toJstStr,
  getWeekSchedules, getScheduleDetail, addSchedule, updateSchedule, deleteSchedule,
  getWeekSchedulesMulti, getScheduleUsers, getGroupList, getGroupMembers, getScheduleParticipantIds,
  addRepeatSchedule, updateRepeatOne, updateRepeatAll, deleteRepeatOne, deleteRepeatAll,
  getListSchedules, getFacilities, getBookedFacilityIds, getScheduleFacilityIds,
} from './schedule'

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
    orderBy: vi.fn(),
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
  // Phase D で追加した leftJoin/limit/offset は mockDb オブジェクトの初期定義にないため
  // 初回呼び出し時に vi.fn() として登録する
  for (const method of ['selectFrom', 'insertInto', 'updateTable', 'deleteFrom', 'innerJoin', 'leftJoin', 'select', 'where', 'set', 'values', 'orderBy', 'limit', 'offset']) {
    if (!mockDb[method]) mockDb[method] = vi.fn()
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
describe('getScheduleDetail', () => {
  it('登録者・更新者名と日時（JST文字列）・参加ユーザー名一覧を返す', async () => {
    // executeTakeFirstOrThrow: schedule + user JOIN 結果
    mockDb.executeTakeFirstOrThrow.mockResolvedValueOnce({
      creator_name: '金子遼太郎',
      create_date_text: '2026-07-22',
      updater_name: '金子遼太郎',
      update_date_text: '2026-07-22 14:24:44',
    })
    // execute: 参加者一覧（type='U'）、続いて設備一覧（type='F'、Phase D で追加）
    mockDb.execute
      .mockResolvedValueOnce([{ name: '金子遼太郎' }, { name: '中村翔太' }])
      .mockResolvedValueOnce([])  // 設備なし

    const result = await getScheduleDetail(1701251)

    expect(result.creatorName).toBe('金子遼太郎')
    // create_date は date 型のため::text が日付のみを返す
    expect(result.creatorDateJst).toBe('2026-07-22')
    expect(result.updaterName).toBe('金子遼太郎')
    // update_date は timestamp 型のため::text が日時を返す
    expect(result.updaterDateJst).toBe('2026-07-22 14:24:44')
    expect(result.participantNames).toEqual(['金子遼太郎', '中村翔太'])
    expect(result.facilityNames).toEqual([])
  })

  it('参加ユーザーが0件の場合は空配列を返す', async () => {
    mockDb.executeTakeFirstOrThrow.mockResolvedValueOnce({
      creator_name: '金子遼太郎',
      create_date_text: '2026-07-22',
      updater_name: '金子遼太郎',
      update_date_text: '2026-07-22 14:24:44',
    })
    mockDb.execute
      .mockResolvedValueOnce([])   // 参加者なし
      .mockResolvedValueOnce([])   // 設備なし

    const result = await getScheduleDetail(999)
    expect(result.participantNames).toEqual([])
    expect(result.facilityNames).toEqual([])
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

  it('participantIds 指定時: 作成者=status="O"、追加参加者=status="T" で登録される', async () => {
    // 作成者(42) + 参加者(99) の 2 人分:
    // nextSeqId x3 (schedule + schedule_map x2), INSERT execute x3 (schedule + schedule_map x2)
    mockDb.executeTakeFirstOrThrow
      .mockResolvedValueOnce({ seq_id: 103 })  // pk_eip_t_schedule
      .mockResolvedValueOnce({ seq_id: 203 })  // pk_eip_t_schedule_map (owner)
      .mockResolvedValueOnce({ seq_id: 204 })  // pk_eip_t_schedule_map (participant)
    mockDb.execute
      .mockResolvedValueOnce([])  // INSERT eip_t_schedule
      .mockResolvedValueOnce([])  // INSERT schedule_map (owner)
      .mockResolvedValueOnce([])  // INSERT schedule_map (participant)

    await addSchedule(42, {
      name: '参加者あり',
      startDate: new Date('2026-07-22T01:00:00Z'),
      endDate: new Date('2026-07-22T02:00:00Z'),
      isAllDay: false,
      publicFlag: 'O',
      participantIds: [99],
    })

    // owner レコード（2回目の insertInto 呼び出し）は status='O'
    const ownerMapValues = mockDb.values.mock.calls[1][0]
    expect(ownerMapValues.user_id).toBe(42)
    expect(ownerMapValues.status).toBe('O')

    // 参加者レコード（3回目の insertInto 呼び出し）は status='T'
    const participantMapValues = mockDb.values.mock.calls[2][0]
    expect(participantMapValues.user_id).toBe(99)
    expect(participantMapValues.status).toBe('T')
  })

  it('期間で指定: end_date が periodEndDate + 24h の JST 深夜0時になる', async () => {
    // periodEndDate = 2026-07-29 00:00 JST = 2026-07-28T15:00:00Z
    // +24h = 2026-07-29T15:00:00Z = 2026-07-30 00:00 JST → exclusive end
    mockDb.executeTakeFirstOrThrow
      .mockResolvedValueOnce({ seq_id: 104 })  // pk_eip_t_schedule
      .mockResolvedValueOnce({ seq_id: 205 })  // pk_eip_t_schedule_map
    mockDb.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([])

    const startDate = new Date('2026-07-26T15:00:00Z')      // 2026-07-27 00:00 JST
    const periodEndDate = new Date('2026-07-28T15:00:00Z')  // 2026-07-29 00:00 JST
    await addSchedule(42, {
      name: '期間テスト',
      startDate,
      endDate: startDate,
      isAllDay: true,
      publicFlag: 'O',
      periodEndDate,
    })

    const valuesCall = mockDb.values.mock.calls[0][0]
    expect(valuesCall.start_date).toBe('2026-07-27 00:00:00')
    // end_date = 2026-07-29 + 1日 = 2026-07-30 00:00 JST（exclusive end）
    expect(valuesCall.end_date).toBe('2026-07-30 00:00:00')
  })

  it('facilityIds 指定時: type="F" の設備マップが登録される', async () => {
    // 流れ: nextSeqId(schedule) → INSERT schedule → insertScheduleParticipants(owner)
    //       → insertScheduleFacilities: nextNSeqIds → INSERT type='F' map
    mockDb.executeTakeFirstOrThrow
      .mockResolvedValueOnce({ seq_id: 105 })  // pk_eip_t_schedule
      .mockResolvedValueOnce({ seq_id: 206 })  // pk_eip_t_schedule_map (owner)
    mockDb.execute
      .mockResolvedValueOnce([])                   // INSERT eip_t_schedule
      .mockResolvedValueOnce([])                   // INSERT schedule_map (owner)
      .mockResolvedValueOnce([{ seq_id: 207 }])    // nextNSeqIds: facility map ID
      .mockResolvedValueOnce([])                   // INSERT schedule_map (facility)

    await addSchedule(42, {
      name: '設備予約テスト',
      startDate: new Date('2026-07-22T01:00:00Z'),
      endDate: new Date('2026-07-22T02:00:00Z'),
      isAllDay: false,
      publicFlag: 'O',
      facilityIds: [7],
    })

    // schedule_map に type='F' で挿入されること
    // insertScheduleFacilities は .values(array) を呼ぶため calls[N][0] が配列になる
    const facilityMapValues = mockDb.values.mock.calls[2][0][0]
    expect(facilityMapValues.type).toBe('F')
    expect(facilityMapValues.user_id).toBe(7)
    expect(facilityMapValues.schedule_id).toBe(105)
  })
})

// ===========================================================
describe('updateSchedule', () => {
  it('owner_id = userId の条件で UPDATE する', async () => {
    // updateSchedule は UPDATE → DELETE schedule_map → nextSeqId → INSERT schedule_map の順に呼ぶ
    mockDb.executeTakeFirstOrThrow.mockResolvedValueOnce({ seq_id: 200 })  // nextSeqId (owner)
    mockDb.execute
      .mockResolvedValueOnce([])  // UPDATE eip_t_schedule
      .mockResolvedValueOnce([])  // DELETE eip_t_schedule_map
      .mockResolvedValueOnce([])  // INSERT eip_t_schedule_map (owner)

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
    mockDb.executeTakeFirstOrThrow.mockResolvedValueOnce({ seq_id: 200 })
    mockDb.execute
      .mockResolvedValueOnce([])  // UPDATE
      .mockResolvedValueOnce([])  // DELETE schedule_map
      .mockResolvedValueOnce([])  // INSERT schedule_map (owner)

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

  it('participantIds 指定時: 全削除→再登録。owner=status="O"、追加参加者=status="T"', async () => {
    // UPDATE → DELETE → nextSeqId x2 (owner + participant) → INSERT x2
    mockDb.executeTakeFirstOrThrow
      .mockResolvedValueOnce({ seq_id: 200 })  // nextSeqId for owner
      .mockResolvedValueOnce({ seq_id: 201 })  // nextSeqId for participant
    mockDb.execute
      .mockResolvedValueOnce([])  // UPDATE
      .mockResolvedValueOnce([])  // DELETE schedule_map
      .mockResolvedValueOnce([])  // INSERT schedule_map (owner)
      .mockResolvedValueOnce([])  // INSERT schedule_map (participant)

    await updateSchedule(1, 42, {
      name: '更新',
      startDate: new Date('2026-07-22T01:00:00Z'),
      endDate: new Date('2026-07-22T02:00:00Z'),
      isAllDay: false,
      publicFlag: 'O',
      participantIds: [99],
    })

    // schedule_map を削除してから再登録することを確認
    expect(mockDb.deleteFrom).toHaveBeenCalledWith('eip_t_schedule_map')
    const ownerMap = mockDb.values.mock.calls[0][0]
    expect(ownerMap.user_id).toBe(42)
    expect(ownerMap.status).toBe('O')
    const participantMap = mockDb.values.mock.calls[1][0]
    expect(participantMap.user_id).toBe(99)
    expect(participantMap.status).toBe('T')
  })

  it('facilityIds 指定時: DELETE 後に type="F" の設備マップが登録される', async () => {
    // UPDATE → DELETE schedule_map → nextSeqId (owner) → INSERT owner map
    //       → insertScheduleFacilities: nextNSeqIds → INSERT type='F' map
    mockDb.executeTakeFirstOrThrow
      .mockResolvedValueOnce({ seq_id: 200 })  // nextSeqId for owner
      .mockResolvedValueOnce({ seq_id: 201 })  // nextSeqId for facility (nextNSeqIds)
    mockDb.execute
      .mockResolvedValueOnce([])  // UPDATE eip_t_schedule
      .mockResolvedValueOnce([])  // DELETE eip_t_schedule_map
      .mockResolvedValueOnce([])  // INSERT schedule_map (owner)
      .mockResolvedValueOnce([])  // INSERT schedule_map (facility)

    await updateSchedule(1, 42, {
      name: '更新',
      startDate: new Date('2026-07-22T01:00:00Z'),
      endDate: new Date('2026-07-22T02:00:00Z'),
      isAllDay: false,
      publicFlag: 'O',
      facilityIds: [7],
    })

    // insertScheduleFacilities は .values(array) を呼ぶため calls[N][0] が配列になる
    // ownerMap は calls[0][0]（オブジェクト）、facilityMap は calls[1][0][0]（配列の先頭要素）
    const facilityMapValues = mockDb.values.mock.calls[1][0][0]
    expect(facilityMapValues.type).toBe('F')
    expect(facilityMapValues.user_id).toBe(7)
    expect(facilityMapValues.schedule_id).toBe(1)
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

// ===========================================================
// Phase B テスト
// ===========================================================

describe('getWeekSchedulesMulti', () => {
  it('ユーザー ID リストが空の場合は DB を叩かずに空配列を返す', async () => {
    const result = await getWeekSchedulesMulti(42, [], new Date(), new Date())
    expect(result).toEqual([])
    expect(mockDb.selectFrom).not.toHaveBeenCalled()
  })

  it('loginUserId と同じユーザーの public_flag="P" 予定はマスキングしない', async () => {
    mockDb.execute.mockResolvedValueOnce([
      {
        schedule_id: 1,
        name: '自分の非公開予定',
        note: '非公開メモ',
        place: '非公開の場所',
        start_date_text: '2026-07-22 10:00:00',
        end_date_text: '2026-07-22 11:00:00',
        public_flag: 'P',
        repeat_pattern: 'N',
        parent_id: 0,
        owner_id: 42,
        view_user_id: 42,
        view_user_name: '田中 太郎',
      },
    ])

    const from = new Date('2026-07-21T15:00:00Z')
    const to = new Date('2026-07-28T15:00:00Z')
    const result = await getWeekSchedulesMulti(42, [42], from, to)

    expect(result).toHaveLength(1)
    // 自分の予定は public_flag='P' でもマスキングしない（AIPO 準拠）
    expect(result[0].name).toBe('自分の非公開予定')
    expect(result[0].note).toBe('非公開メモ')
    expect(result[0].place).toBe('非公開の場所')
    expect(result[0].viewUserId).toBe(42)
    expect(result[0].isOwner).toBe(true)
  })

  it('他ユーザーの public_flag="P" 予定はタイトル・メモ・場所を "非公開" にマスキングする', async () => {
    mockDb.execute.mockResolvedValueOnce([
      {
        schedule_id: 2,
        name: '秘密の予定',
        note: '秘密のメモ',
        place: '秘密の場所',
        start_date_text: '2026-07-22 14:00:00',
        end_date_text: '2026-07-22 15:00:00',
        public_flag: 'P',
        repeat_pattern: 'N',
        parent_id: 0,
        owner_id: 99,
        view_user_id: 99,
        view_user_name: '山田 花子',
      },
    ])

    const from = new Date('2026-07-21T15:00:00Z')
    const to = new Date('2026-07-28T15:00:00Z')
    const result = await getWeekSchedulesMulti(42, [42, 99], from, to)

    expect(result[0].name).toBe('非公開')
    expect(result[0].note).toBeNull()
    expect(result[0].place).toBeNull()
    expect(result[0].viewUserId).toBe(99)
    expect(result[0].viewUserName).toBe('山田 花子')
  })

  it('フィールドを MultiUserScheduleEntry 型に正しくマッピングする', async () => {
    mockDb.execute.mockResolvedValueOnce([
      {
        schedule_id: 3,
        name: 'チーム定例',
        note: 'アジェンダ',
        place: '大会議室',
        start_date_text: '2026-07-22 09:00:00',
        end_date_text: '2026-07-22 10:00:00',
        public_flag: 'O',
        repeat_pattern: 'N',
        parent_id: 0,
        owner_id: 42,
        view_user_id: 42,
        view_user_name: '田中 太郎',
      },
    ])

    const from = new Date('2026-07-21T15:00:00Z')
    const to = new Date('2026-07-28T15:00:00Z')
    const result = await getWeekSchedulesMulti(42, [42], from, to)

    expect(result[0].scheduleId).toBe(3)
    expect(result[0].viewUserName).toBe('田中 太郎')
    expect(result[0].isAllDay).toBe(false)
    expect(result[0].startDate.toISOString()).toBe('2026-07-22T00:00:00.000Z')  // 09:00 JST = 00:00 UTC
  })
})

// ===========================================================
describe('getScheduleUsers', () => {
  it('ユーザー一覧を ScheduleUser 型に変換して返す', async () => {
    mockDb.execute.mockResolvedValueOnce([
      { user_id: 10, full_name: '田中 太郎', full_name_kana: 'タナカ タロウ' },
      { user_id: 20, full_name: '山田 花子', full_name_kana: 'ヤマダ ハナコ' },
    ])

    const result = await getScheduleUsers()

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ userId: 10, fullName: '田中 太郎' })
    expect(result[1]).toEqual({ userId: 20, fullName: '山田 花子' })
  })

  it('disabled="T" 除外とシステムアカウント（user_id=1,3）除外の条件を設定する', async () => {
    mockDb.execute.mockResolvedValueOnce([])

    await getScheduleUsers()

    expect(mockDb.where).toHaveBeenCalledWith('disabled', '!=', 'T')
    expect(mockDb.where).toHaveBeenCalledWith('user_id', 'not in', [1, 3])
  })
})

// ===========================================================
describe('getGroupList', () => {
  it('グループ一覧を ScheduleGroup 型に変換して返す', async () => {
    mockDb.execute.mockResolvedValueOnce([
      { group_id: 10, group_alias_name: '営業部' },
      { group_id: 20, group_alias_name: '開発部' },
    ])

    const result = await getGroupList()

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ groupId: 10, groupName: '営業部' })
    expect(result[1]).toEqual({ groupId: 20, groupName: '開発部' })
  })

  it('システムグループ（group_id=1,2,3）を除外する条件を設定する', async () => {
    mockDb.execute.mockResolvedValueOnce([])

    await getGroupList()

    expect(mockDb.where).toHaveBeenCalledWith('group_id', 'not in', [1, 2, 3])
  })
})

// ===========================================================
describe('getGroupMembers', () => {
  it('グループメンバーを ScheduleUser 型に変換して返す', async () => {
    mockDb.execute.mockResolvedValueOnce([
      { user_id: 10, full_name: '田中 太郎', full_name_kana: 'タナカ タロウ' },
    ])

    const result = await getGroupMembers(5)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ userId: 10, fullName: '田中 太郎' })
    // groupId の絞り込み条件が設定されているか
    expect(mockDb.where).toHaveBeenCalledWith('ugr.group_id', '=', 5)
  })

  it('メンバーがいない場合は空配列を返す', async () => {
    mockDb.execute.mockResolvedValueOnce([])

    const result = await getGroupMembers(99)

    expect(result).toEqual([])
  })
})

// ===========================================================
describe('getScheduleParticipantIds', () => {
  it('スケジュールの参加者 ID リストを返す', async () => {
    mockDb.execute.mockResolvedValueOnce([
      { user_id: 42 },
      { user_id: 99 },
    ])

    const result = await getScheduleParticipantIds(1)

    expect(result).toEqual([42, 99])
    expect(mockDb.where).toHaveBeenCalledWith('schedule_id', '=', 1)
  })

  it('参加者がいない場合は空配列を返す', async () => {
    mockDb.execute.mockResolvedValueOnce([])

    const result = await getScheduleParticipantIds(1)

    expect(result).toEqual([])
  })
})

// ===========================================================
// Phase C: 繰り返し予定
// ===========================================================

describe('addRepeatSchedule', () => {
  it('親レコード（parent_id=0）と子レコード（parent_id=parentId）が INSERT される', async () => {
    // startDate = 2026-07-07 10:00 JST, limitEndDate = 2026-07-07 00:00 JST → 1件のみ出現
    const startDate = new Date('2026-07-07T01:00:00Z')      // 10:00 JST
    const endDate = new Date('2026-07-07T02:00:00Z')        // 11:00 JST
    const limitEndDate = new Date('2026-07-06T15:00:00Z')   // 2026-07-07 00:00 JST

    // nextSeqId(parentId): executeTakeFirstOrThrow
    mockDb.executeTakeFirstOrThrow.mockResolvedValueOnce({ seq_id: 100 })
    mockDb.execute
      .mockResolvedValueOnce([])                // INSERT parent schedule
      .mockResolvedValueOnce([{ seq_id: 101 }]) // nextNSeqIds(childCount=1)
      .mockResolvedValueOnce([])                // INSERT children schedule
      .mockResolvedValueOnce([{ seq_id: 200 }]) // nextNSeqIds(mapCount=1)
      .mockResolvedValueOnce([])                // INSERT maps

    await addRepeatSchedule(42, {
      name: '毎日テスト',
      startDate,
      endDate,
      publicFlag: 'O',
      repeatType: 'daily',
      limitEndDate,
    })

    // 親レコード: parent_id=0, schedule_id=100
    const parentValues = mockDb.values.mock.calls[0][0]
    expect(parentValues.schedule_id).toBe(100)
    expect(parentValues.parent_id).toBe(0)

    // 子レコード配列の1件目: parent_id=100（parentId）, repeat_pattern='N'
    const childrenValues = mockDb.values.mock.calls[1][0]
    expect(childrenValues[0].schedule_id).toBe(101)
    expect(childrenValues[0].parent_id).toBe(100)
    expect(childrenValues[0].repeat_pattern).toBe('N')
  })

  it('参加者あり: 子レコード × 参加者数 分のマップレコードが INSERT される', async () => {
    // 1件の出現 × (owner + 1参加者) = 2 map レコード
    const startDate = new Date('2026-07-07T01:00:00Z')
    const endDate = new Date('2026-07-07T02:00:00Z')
    const limitEndDate = new Date('2026-07-06T15:00:00Z')

    mockDb.executeTakeFirstOrThrow.mockResolvedValueOnce({ seq_id: 100 })
    mockDb.execute
      .mockResolvedValueOnce([])                              // INSERT parent
      .mockResolvedValueOnce([{ seq_id: 101 }])              // nextNSeqIds(child 1件)
      .mockResolvedValueOnce([])                              // INSERT children
      .mockResolvedValueOnce([{ seq_id: 200 }, { seq_id: 201 }])  // nextNSeqIds(map 2件)
      .mockResolvedValueOnce([])                              // INSERT maps

    await addRepeatSchedule(42, {
      name: '参加者あり繰り返し',
      startDate,
      endDate,
      publicFlag: 'O',
      repeatType: 'daily',
      limitEndDate,
      participantIds: [99],
    })

    const mapValues = mockDb.values.mock.calls[2][0]
    // owner: status='O', participant: status='T'
    expect(mapValues[0].user_id).toBe(42)
    expect(mapValues[0].status).toBe('O')
    expect(mapValues[1].user_id).toBe(99)
    expect(mapValues[1].status).toBe('T')
  })

  it('facilityIds 指定時: 全子レコードに type="F" の設備マップが一括登録される', async () => {
    // 1出現 × 1設備の最小構成: 親ID取得 → INSERT parent → childIds → INSERT children
    //   → userMapIds → INSERT userMaps → facilityMapIds → INSERT facilityMaps
    const startDate = new Date('2026-07-07T01:00:00Z')      // 10:00 JST
    const endDate = new Date('2026-07-07T02:00:00Z')        // 11:00 JST
    const limitEndDate = new Date('2026-07-06T15:00:00Z')   // 2026-07-07 00:00 JST → 1件出現

    mockDb.executeTakeFirstOrThrow.mockResolvedValueOnce({ seq_id: 100 })  // parentId
    mockDb.execute
      .mockResolvedValueOnce([])                   // INSERT parent
      .mockResolvedValueOnce([{ seq_id: 101 }])    // nextNSeqIds(child 1件)
      .mockResolvedValueOnce([])                   // INSERT children
      .mockResolvedValueOnce([{ seq_id: 200 }])    // nextNSeqIds(userMap 1件)
      .mockResolvedValueOnce([])                   // INSERT userMaps
      .mockResolvedValueOnce([{ seq_id: 201 }])    // nextNSeqIds(facilityMap 1件)
      .mockResolvedValueOnce([])                   // INSERT facilityMaps

    await addRepeatSchedule(42, {
      name: '設備付き繰り返しテスト',
      startDate,
      endDate,
      publicFlag: 'O',
      repeatType: 'daily',
      limitEndDate,
      facilityIds: [7],
    })

    // 4回目の .values() 呼び出し（0=parent, 1=children配列, 2=userMaps配列, 3=facilityMaps配列）
    // facilityMaps は .values(array) なので calls[3][0] が配列
    const facilityMapValues = mockDb.values.mock.calls[3][0][0]
    expect(facilityMapValues.type).toBe('F')
    expect(facilityMapValues.user_id).toBe(7)
    expect(facilityMapValues.schedule_id).toBe(101)  // 子レコード ID
  })

  it('limitStartDate 指定時: その日付以降から出現日を生成する', async () => {
    // startDate = 2026-07-07 10:00 JST, limitStartDate = 2026-07-09 00:00 JST, limitEndDate = 2026-07-10 00:00 JST
    // 毎日繰り返し → limitStartDate 以降の 2026-07-09 と 2026-07-10 の 2件が出現
    const startDate = new Date('2026-07-07T01:00:00Z')        // 2026-07-07 10:00 JST
    const endDate = new Date('2026-07-07T02:00:00Z')          // 2026-07-07 11:00 JST
    const limitStartDate = new Date('2026-07-08T15:00:00Z')   // 2026-07-09 00:00 JST
    const limitEndDate = new Date('2026-07-09T15:00:00Z')     // 2026-07-10 00:00 JST

    mockDb.executeTakeFirstOrThrow.mockResolvedValueOnce({ seq_id: 100 })
    mockDb.execute
      .mockResolvedValueOnce([])                              // INSERT parent
      .mockResolvedValueOnce([{ seq_id: 101 }, { seq_id: 102 }])  // nextNSeqIds(child 2件)
      .mockResolvedValueOnce([])                              // INSERT children
      .mockResolvedValueOnce([{ seq_id: 200 }, { seq_id: 201 }])  // nextNSeqIds(map 2件)
      .mockResolvedValueOnce([])                              // INSERT maps

    await addRepeatSchedule(42, {
      name: 'limitStartDate テスト',
      startDate,
      endDate,
      publicFlag: 'O',
      repeatType: 'daily',
      limitStartDate,
      limitEndDate,
    })

    // 子レコードは 2026-07-09 と 2026-07-10 の 2件（startDate=2026-07-07 からではなく limitStartDate から）
    const childrenValues = mockDb.values.mock.calls[1][0]
    expect(childrenValues).toHaveLength(2)
    expect(childrenValues[0].start_date).toBe('2026-07-09 10:00:00')
    expect(childrenValues[1].start_date).toBe('2026-07-10 10:00:00')
  })
})

// ===========================================================
describe('updateRepeatOne', () => {
  it('指定した schedule_id の子レコードのみ UPDATE し参加者を再登録する', async () => {
    // 流れ: UPDATE eip_t_schedule → DELETE map → nextSeqId(owner) → INSERT map
    mockDb.executeTakeFirstOrThrow.mockResolvedValueOnce({ seq_id: 200 })
    mockDb.execute
      .mockResolvedValueOnce([])  // UPDATE
      .mockResolvedValueOnce([])  // DELETE schedule_map
      .mockResolvedValueOnce([])  // INSERT schedule_map (owner)

    await updateRepeatOne(101, 42, {
      name: '変更タイトル',
      startDate: new Date('2026-07-07T01:00:00Z'),
      endDate: new Date('2026-07-07T02:00:00Z'),
      isAllDay: false,
      publicFlag: 'O',
    })

    expect(mockDb.updateTable).toHaveBeenCalledWith('eip_t_schedule')
    // 指定した子レコードのみ更新
    expect(mockDb.where).toHaveBeenCalledWith('schedule_id', '=', 101)
    // owner_id 条件で他人の予定を変更できないようにする
    expect(mockDb.where).toHaveBeenCalledWith('owner_id', '=', 42)
    // 参加者マップが再登録される
    expect(mockDb.insertInto).toHaveBeenCalledWith('eip_t_schedule_map')
  })

  it('facilityIds 指定時: DELETE 後に type="F" の設備マップが再登録される', async () => {
    // 流れ: UPDATE schedule → DELETE schedule_map → insertScheduleParticipants(owner)
    //       → insertScheduleFacilities: nextNSeqIds → INSERT type='F' map
    mockDb.executeTakeFirstOrThrow.mockResolvedValueOnce({ seq_id: 200 })  // nextSeqId (owner)
    mockDb.execute
      .mockResolvedValueOnce([])                   // UPDATE eip_t_schedule
      .mockResolvedValueOnce([])                   // DELETE eip_t_schedule_map
      .mockResolvedValueOnce([])                   // INSERT schedule_map (owner)
      .mockResolvedValueOnce([{ seq_id: 201 }])    // nextNSeqIds: facility map ID
      .mockResolvedValueOnce([])                   // INSERT schedule_map (facility)

    await updateRepeatOne(101, 42, {
      name: '設備変更テスト',
      startDate: new Date('2026-07-07T01:00:00Z'),
      endDate: new Date('2026-07-07T02:00:00Z'),
      isAllDay: false,
      publicFlag: 'O',
      facilityIds: [9],
    })

    // schedule_map が一度 DELETE される（参加者・設備の両方を削除）
    expect(mockDb.deleteFrom).toHaveBeenCalledWith('eip_t_schedule_map')
    // type='F' の設備マップが挿入される
    // insertScheduleFacilities は .values(array) を呼ぶため calls[N][0] が配列になる
    const facilityMapValues = mockDb.values.mock.calls[1][0][0]
    expect(facilityMapValues.type).toBe('F')
    expect(facilityMapValues.user_id).toBe(9)
  })
})

// ===========================================================
describe('updateRepeatAll', () => {
  it('全子レコードと親レコードを UPDATE する', async () => {
    // participantIds なしの場合: UPDATE children → UPDATE parent のみ
    mockDb.execute
      .mockResolvedValueOnce([])  // UPDATE children
      .mockResolvedValueOnce([])  // UPDATE parent

    await updateRepeatAll(100, 42, {
      name: '全件変更',
      startDate: new Date('2026-07-07T01:00:00Z'),
      endDate: new Date('2026-07-07T02:00:00Z'),
      isAllDay: false,
      publicFlag: 'O',
    })

    // 2回 UPDATE（子 → 親）
    expect(mockDb.updateTable).toHaveBeenCalledTimes(2)
    // 子レコードは parent_id で絞り込む
    expect(mockDb.where).toHaveBeenCalledWith('parent_id', '=', 100)
    // 親レコードは schedule_id で絞り込む
    expect(mockDb.where).toHaveBeenCalledWith('schedule_id', '=', 100)
  })

  it('participantIds 指定時: 全子の参加者マップを一括置き換えする', async () => {
    // children SELECT → DELETE type='U' → nextNSeqIds → INSERT maps
    mockDb.execute
      .mockResolvedValueOnce([])                              // UPDATE children
      .mockResolvedValueOnce([])                              // UPDATE parent
      .mockResolvedValueOnce([{ schedule_id: 101 }])         // SELECT children
      .mockResolvedValueOnce([])                              // DELETE type='U' maps
      .mockResolvedValueOnce([{ seq_id: 200 }, { seq_id: 201 }])  // nextNSeqIds(map 2件)
      .mockResolvedValueOnce([])                              // INSERT maps

    await updateRepeatAll(100, 42, {
      name: '全件変更（参加者あり）',
      startDate: new Date('2026-07-07T01:00:00Z'),
      endDate: new Date('2026-07-07T02:00:00Z'),
      isAllDay: false,
      publicFlag: 'O',
      participantIds: [99],
    })

    expect(mockDb.deleteFrom).toHaveBeenCalledWith('eip_t_schedule_map')
    expect(mockDb.insertInto).toHaveBeenCalledWith('eip_t_schedule_map')
  })

  it('facilityIds のみ指定時: 設備マップのみ置き換え、参加者マップの DELETE は1回のみ', async () => {
    // children SELECT → DELETE type='F' → nextNSeqIds → INSERT facility maps
    mockDb.execute
      .mockResolvedValueOnce([])                              // UPDATE children
      .mockResolvedValueOnce([])                              // UPDATE parent
      .mockResolvedValueOnce([{ schedule_id: 101 }])         // SELECT children
      .mockResolvedValueOnce([])                              // DELETE type='F' maps
      .mockResolvedValueOnce([{ seq_id: 300 }])              // nextNSeqIds(facility 1件)
      .mockResolvedValueOnce([])                              // INSERT facility maps

    await updateRepeatAll(100, 42, {
      name: '全件変更（設備のみ）',
      startDate: new Date('2026-07-07T01:00:00Z'),
      endDate: new Date('2026-07-07T02:00:00Z'),
      isAllDay: false,
      publicFlag: 'O',
      facilityIds: [5],
    })

    // DELETE は type='F' のみ（type='U' 参加者は削除されない）
    expect(mockDb.deleteFrom).toHaveBeenCalledTimes(1)
    expect(mockDb.deleteFrom).toHaveBeenCalledWith('eip_t_schedule_map')
    expect(mockDb.where).toHaveBeenCalledWith('type', '=', 'F')
    expect(mockDb.where).not.toHaveBeenCalledWith('type', '=', 'U')
    expect(mockDb.insertInto).toHaveBeenCalledWith('eip_t_schedule_map')
  })

  it('facilityIds と participantIds の両方指定時: それぞれ独立して削除・再挿入する', async () => {
    // children SELECT → DELETE type='U' → INSERT U maps → DELETE type='F' → INSERT F maps
    mockDb.execute
      .mockResolvedValueOnce([])                              // UPDATE children
      .mockResolvedValueOnce([])                              // UPDATE parent
      .mockResolvedValueOnce([{ schedule_id: 101 }])         // SELECT children
      .mockResolvedValueOnce([])                              // DELETE type='U' maps
      .mockResolvedValueOnce([{ seq_id: 200 }, { seq_id: 201 }])  // nextNSeqIds(U 2件)
      .mockResolvedValueOnce([])                              // INSERT U maps
      .mockResolvedValueOnce([])                              // DELETE type='F' maps
      .mockResolvedValueOnce([{ seq_id: 300 }])              // nextNSeqIds(F 1件)
      .mockResolvedValueOnce([])                              // INSERT F maps

    await updateRepeatAll(100, 42, {
      name: '全件変更（両方）',
      startDate: new Date('2026-07-07T01:00:00Z'),
      endDate: new Date('2026-07-07T02:00:00Z'),
      isAllDay: false,
      publicFlag: 'O',
      participantIds: [99],
      facilityIds: [5],
    })

    // DELETE は type='U' と type='F' の2回
    expect(mockDb.deleteFrom).toHaveBeenCalledTimes(2)
    expect(mockDb.where).toHaveBeenCalledWith('type', '=', 'U')
    expect(mockDb.where).toHaveBeenCalledWith('type', '=', 'F')
  })
})

// ===========================================================
describe('deleteRepeatOne', () => {
  it('schedule_map を削除してから子レコードを削除する', async () => {
    mockDb.execute
      .mockResolvedValueOnce([])  // DELETE schedule_map
      .mockResolvedValueOnce([])  // DELETE eip_t_schedule (child)

    await deleteRepeatOne(101, 42)

    // map を先に削除
    expect(mockDb.deleteFrom).toHaveBeenNthCalledWith(1, 'eip_t_schedule_map')
    // 子レコード削除（schedule_id と owner_id で絞り込む）
    expect(mockDb.deleteFrom).toHaveBeenNthCalledWith(2, 'eip_t_schedule')
    expect(mockDb.where).toHaveBeenCalledWith('schedule_id', '=', 101)
    expect(mockDb.where).toHaveBeenCalledWith('owner_id', '=', 42)
  })
})

// ===========================================================
describe('deleteRepeatAll', () => {
  it('全子レコードの map → 全子 → 親の順に削除する', async () => {
    mockDb.execute
      .mockResolvedValueOnce([{ schedule_id: 101 }, { schedule_id: 102 }])  // SELECT children
      .mockResolvedValueOnce([])  // DELETE maps
      .mockResolvedValueOnce([])  // DELETE children
      .mockResolvedValueOnce([])  // DELETE parent

    await deleteRepeatAll(100, 42)

    // 子レコードを先に SELECT
    expect(mockDb.selectFrom).toHaveBeenCalledWith('eip_t_schedule')
    // map 削除
    expect(mockDb.deleteFrom).toHaveBeenCalledWith('eip_t_schedule_map')
    // 子レコード全削除（parent_id で絞り込む）
    expect(mockDb.where).toHaveBeenCalledWith('parent_id', '=', 100)
    // 親レコード削除（schedule_id と owner_id で絞り込む）
    expect(mockDb.where).toHaveBeenCalledWith('schedule_id', '=', 100)
    expect(mockDb.where).toHaveBeenCalledWith('owner_id', '=', 42)
  })

  it('子レコードが0件の場合: map/子削除をスキップして親のみ削除する', async () => {
    mockDb.execute
      .mockResolvedValueOnce([])  // SELECT children → 0件
      .mockResolvedValueOnce([])  // DELETE parent

    await deleteRepeatAll(100, 42)

    // map・子の削除は呼ばれない（0件なのでスキップ）
    expect(mockDb.deleteFrom).not.toHaveBeenCalledWith('eip_t_schedule_map')
    // 親のみ削除
    expect(mockDb.deleteFrom).toHaveBeenCalledWith('eip_t_schedule')
    expect(mockDb.where).toHaveBeenCalledWith('schedule_id', '=', 100)
  })
})

// ===========================================================
// Phase D: 一覧ビュー
// ===========================================================

describe('getListSchedules', () => {
  it('指定ユーザーの start_date 以降の予定を昇順で返す', async () => {
    mockDb.execute.mockResolvedValueOnce([
      {
        schedule_id: 1,
        name: 'テスト予定',
        note: null,
        place: null,
        start_date_text: '2026-08-10 09:00:00',
        end_date_text: '2026-08-10 10:00:00',
        public_flag: 'O',
        repeat_pattern: 'N',
        parent_id: 0,
        owner_id: 42,
        view_user_id: 42,
        view_user_name: '山田 太郎',
      },
    ])

    const from = new Date('2026-08-10T00:00:00+09:00')
    const result = await getListSchedules(42, [42], from, 30, 0)

    expect(result).toHaveLength(1)
    expect(result[0].scheduleId).toBe(1)
    expect(result[0].name).toBe('テスト予定')
    expect(result[0].viewUserId).toBe(42)
    expect(result[0].viewUserName).toBe('山田 太郎')
    // start_date ベースで取得する（週ビューとは異なる）
    expect(mockDb.where).toHaveBeenCalledWith(expect.anything(), '>=', expect.any(String))
    expect(mockDb.limit).toHaveBeenCalledWith(30)
    expect(mockDb.offset).toHaveBeenCalledWith(0)
  })

  it('他ユーザーの非公開予定（P）はタイトル・場所・内容をマスクする', async () => {
    mockDb.execute.mockResolvedValueOnce([
      {
        schedule_id: 2,
        name: '機密予定',
        note: '秘密のメモ',
        place: '秘密の場所',
        start_date_text: '2026-08-11 13:00:00',
        end_date_text: '2026-08-11 14:00:00',
        public_flag: 'P',
        repeat_pattern: 'N',
        parent_id: 0,
        owner_id: 99,
        view_user_id: 99,
        view_user_name: '佐藤 花子',
      },
    ])

    const result = await getListSchedules(42, [42, 99], new Date('2026-08-11T00:00:00+09:00'), 30, 0)

    expect(result[0].name).toBe('非公開')
    expect(result[0].note).toBeNull()
    expect(result[0].place).toBeNull()
  })

  it('userIds が空の場合は空配列を返す（DB クエリを実行しない）', async () => {
    const result = await getListSchedules(42, [], new Date(), 30, 0)
    expect(result).toEqual([])
    expect(mockDb.selectFrom).not.toHaveBeenCalled()
  })

  it('offset > 0 でページング（2ページ目）取得できる', async () => {
    mockDb.execute.mockResolvedValueOnce([
      {
        schedule_id: 31,
        name: '31件目',
        note: null,
        place: null,
        start_date_text: '2026-08-20 10:00:00',
        end_date_text: '2026-08-20 11:00:00',
        public_flag: 'O',
        repeat_pattern: 'N',
        parent_id: 0,
        owner_id: 42,
        view_user_id: 42,
        view_user_name: '山田 太郎',
      },
    ])

    const result = await getListSchedules(42, [42], new Date('2026-08-10T00:00:00+09:00'), 30, 30)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('31件目')
    expect(mockDb.limit).toHaveBeenCalledWith(30)
    expect(mockDb.offset).toHaveBeenCalledWith(30)
  })

  it('keyword を指定すると where に関数形式（eb.or）が追加される', async () => {
    mockDb.execute.mockResolvedValueOnce([])

    await getListSchedules(42, [42], new Date('2026-08-10T00:00:00+09:00'), 30, 0, '打ち合わせ')

    // keyword 指定時は eb.or を使う関数形式の where が追加で呼ばれる
    const fnCalls = mockDb.where.mock.calls.filter((args: unknown[]) => typeof args[0] === 'function')
    expect(fnCalls.length).toBeGreaterThan(0)
  })

  it('keyword が空文字の場合は keyword 用 where を追加しない', async () => {
    mockDb.execute.mockResolvedValueOnce([])
    await getListSchedules(42, [42], new Date('2026-08-10T00:00:00+09:00'), 30, 0, '')
    const callsWithEmpty = mockDb.where.mock.calls.length

    vi.clearAllMocks()
    for (const method of ['selectFrom', 'insertInto', 'updateTable', 'deleteFrom', 'innerJoin', 'leftJoin', 'select', 'where', 'set', 'values', 'orderBy', 'limit', 'offset']) {
      if (!mockDb[method]) mockDb[method] = vi.fn()
      mockDb[method].mockReturnValue(mockDb)
    }
    mockDb.execute.mockResolvedValueOnce([])
    await getListSchedules(42, [42], new Date('2026-08-10T00:00:00+09:00'), 30, 0)
    const callsWithoutKeyword = mockDb.where.mock.calls.length

    // 空文字はキーワードなしと同じ where 回数（条件が追加されない）
    expect(callsWithEmpty).toBe(callsWithoutKeyword)
  })
})

// ===========================================================
// Phase D: 設備取得
// ===========================================================

describe('getFacilities', () => {
  it('設備一覧をグループ名付きで返す', async () => {
    mockDb.execute.mockResolvedValueOnce([
      { facility_id: 1, facility_name: '大会議室', group_name: '会議室', sort: 1 },
      { facility_id: 2, facility_name: '小会議室', group_name: '会議室', sort: 2 },
      { facility_id: 3, facility_name: 'プロジェクター', group_name: null, sort: 10 },
    ])

    const result = await getFacilities()

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ facilityId: 1, facilityName: '大会議室', groupName: '会議室', sort: 1 })
    expect(result[2]).toEqual({ facilityId: 3, facilityName: 'プロジェクター', groupName: null, sort: 10 })
    // leftJoin で設備グループを結合する
    expect(mockDb.leftJoin).toHaveBeenCalled()
    expect(mockDb.orderBy).toHaveBeenCalledWith('f.sort', 'asc')
  })

  it('設備が0件の場合は空配列を返す', async () => {
    mockDb.execute.mockResolvedValueOnce([])
    const result = await getFacilities()
    expect(result).toEqual([])
  })
})

// ===========================================================
// Phase D: 設備空き確認
// ===========================================================

describe('getBookedFacilityIds', () => {
  it('指定時間帯に予約済みの設備 ID 一覧を返す', async () => {
    mockDb.execute.mockResolvedValueOnce([
      { facility_id: 1 },
      { facility_id: 3 },
    ])

    const start = new Date('2026-08-10T10:00:00+09:00')
    const end = new Date('2026-08-10T11:00:00+09:00')
    const result = await getBookedFacilityIds(start, end)

    expect(result).toEqual([1, 3])
    // type='F' で絞り込む
    expect(mockDb.where).toHaveBeenCalledWith('sm.type', '=', 'F')
  })

  it('予約なしの場合は空配列を返す', async () => {
    mockDb.execute.mockResolvedValueOnce([])
    const result = await getBookedFacilityIds(new Date(), new Date())
    expect(result).toEqual([])
  })

  it('excludeScheduleId 指定時: 自身の schedule を除外して重複判定する', async () => {
    mockDb.execute.mockResolvedValueOnce([])
    const start = new Date('2026-08-10T10:00:00+09:00')
    const end = new Date('2026-08-10T11:00:00+09:00')
    await getBookedFacilityIds(start, end, 99)

    // schedule_id != 99 の条件が追加されること
    expect(mockDb.where).toHaveBeenCalledWith('s.schedule_id', '!=', 99)
  })
})

// ===========================================================
// Phase D: スケジュール設備 ID 取得
// ===========================================================

describe('getScheduleFacilityIds', () => {
  it('スケジュールの予約設備 ID 一覧を返す', async () => {
    mockDb.execute.mockResolvedValueOnce([
      { user_id: 2 },
      { user_id: 5 },
    ])

    const result = await getScheduleFacilityIds(100)

    expect(result).toEqual([2, 5])
    expect(mockDb.where).toHaveBeenCalledWith('schedule_id', '=', 100)
    expect(mockDb.where).toHaveBeenCalledWith('type', '=', 'F')
  })

  it('設備なしの場合は空配列を返す', async () => {
    mockDb.execute.mockResolvedValueOnce([])
    const result = await getScheduleFacilityIds(100)
    expect(result).toEqual([])
  })
})

// ===========================================================
// Phase D: getScheduleDetail の facilityNames
// ===========================================================

describe('getScheduleDetail - facilityNames', () => {
  it('予約設備名を facilityNames に含めて返す', async () => {
    mockDb.executeTakeFirstOrThrow.mockResolvedValueOnce({
      creator_name: '山田 太郎',
      create_date_text: '2026-08-01 09:00:00',
      updater_name: '山田 太郎',
      update_date_text: '2026-08-01 09:00:00',
    })
    // participants（type='U'）
    mockDb.execute
      .mockResolvedValueOnce([{ name: '山田 太郎' }])
      // facilities（type='F'）
      .mockResolvedValueOnce([{ facility_name: '大会議室' }, { facility_name: 'プロジェクター' }])

    const result = await getScheduleDetail(10)

    expect(result.facilityNames).toEqual(['大会議室', 'プロジェクター'])
  })

  it('設備予約なしの場合は facilityNames が空配列になる', async () => {
    mockDb.executeTakeFirstOrThrow.mockResolvedValueOnce({
      creator_name: '山田 太郎',
      create_date_text: '2026-08-01 09:00:00',
      updater_name: '山田 太郎',
      update_date_text: '2026-08-01 09:00:00',
    })
    mockDb.execute
      .mockResolvedValueOnce([{ name: '山田 太郎' }])
      .mockResolvedValueOnce([])

    const result = await getScheduleDetail(10)

    expect(result.facilityNames).toEqual([])
  })
})
