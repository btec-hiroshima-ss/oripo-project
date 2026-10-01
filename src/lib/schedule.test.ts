import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseJst, toJstStr,
  getWeekSchedules, getScheduleDetail, addSchedule, updateSchedule, deleteSchedule,
  getWeekSchedulesMulti, getScheduleUsers, getMyGroups, getGroupList, getGroupMembers, getScheduleParticipantIds,
  addRepeatSchedule, updateRepeatOne, updateRepeatAll, deleteRepeatOne, deleteRepeatAll,
  getListSchedules, searchSchedules, getFacilities, getBookedFacilityIds, getScheduleFacilityIds,
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
  // Phase F: 通常予定・繰り返しの親・ダミーの最大3クエリ。Once で指定しなかったクエリは空配列を返す
  beforeEach(() => {
    mockDb.execute.mockResolvedValue([])
  })

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

  // ---- Phase F（#211）: 動的展開 ----
  // 2026-10-04（日）〜2026-10-11（日）の週。2026-10-08 は木曜
  const weekFrom = new Date('2026-10-04T00:00:00+09:00')
  const weekTo = new Date('2026-10-11T00:00:00+09:00')
  const weeklyParent = {
    schedule_id: 100, name: 'SEミーティング', note: null, place: '大会議室',
    start_date_text: '2025-06-05 15:50:00', end_date_text: '2027-01-31 17:00:00',
    public_flag: 'O', repeat_pattern: 'W0000100L', parent_id: 0, owner_id: 42,
    view_user_id: 42, view_user_name: '田中 太郎',
  }

  it('通常予定は repeat_pattern が N・S のものだけを取得する（繰り返しの親は別クエリ）', async () => {
    await getWeekSchedulesMulti(42, [42], weekFrom, weekTo)
    expect(mockDb.where).toHaveBeenCalledWith('s.repeat_pattern', 'in', ['N', 'S'])
    expect(mockDb.where).toHaveBeenCalledWith('s.repeat_pattern', 'not in', ['N', 'S'])
  })

  it('子レコードの無い繰り返しの親（移行データ）を、該当する曜日の出現として返す', async () => {
    mockDb.execute
      .mockResolvedValueOnce([])              // 通常予定
      .mockResolvedValueOnce([weeklyParent])  // 繰り返しの親
      .mockResolvedValueOnce([])              // ダミー
    const result = await getWeekSchedulesMulti(42, [42], weekFrom, weekTo)

    expect(result).toHaveLength(1)
    expect(result[0].scheduleId).toBe(100)
    expect(result[0].occurrenceDate).toBe('2026-10-08')
    expect(result[0].startDate.toISOString()).toBe(new Date('2026-10-08T15:50:00+09:00').toISOString())
    expect(result[0].endDate.toISOString()).toBe(new Date('2026-10-08T17:00:00+09:00').toISOString())
    expect(result[0].repeatStartDate?.toISOString()).toBe(new Date('2025-06-05T15:50:00+09:00').toISOString())
  })

  it('ダミーのある日（個別削除・個別変更した回）の出現は返さない', async () => {
    mockDb.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([weeklyParent])
      .mockResolvedValueOnce([{ parent_id: 100, date_text: '2026-10-08' }])
    const result = await getWeekSchedulesMulti(42, [42], weekFrom, weekTo)
    expect(result).toHaveLength(0)
    // ダミーは map の status='D' で判定する
    expect(mockDb.where).toHaveBeenCalledWith('sm.status', '=', 'D')
  })

  it('個別変更レコード（parent_id > 0, repeat_pattern=N）は通常予定として返す', async () => {
    mockDb.execute.mockResolvedValueOnce([{ ...{
  schedule_id: 1, name: '予定', note: null, place: null,
  start_date_text: '2026-10-05 10:00:00', end_date_text: '2026-10-05 11:00:00',
  public_flag: 'O', repeat_pattern: 'N', parent_id: 0, owner_id: 42,
  view_user_id: 42, view_user_name: '田中 太郎',
}, schedule_id: 200, parent_id: 100 }])
    const result = await getWeekSchedulesMulti(42, [42], weekFrom, weekTo)
    expect(result).toHaveLength(1)
    expect(result[0].parentId).toBe(100)
    expect(result[0].occurrenceDate).toBeNull()
  })

  it('繰り返しの親が無い場合はダミーを取得しない', async () => {
    await getWeekSchedulesMulti(42, [42], weekFrom, weekTo)
    // 通常予定・繰り返しの親の2クエリのみ
    expect(mockDb.execute).toHaveBeenCalledTimes(2)
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
  it('部署（owner_id=1）とマイグループ（owner_id=userId）を ScheduleGroup 型に変換して返す', async () => {
    mockDb.execute.mockResolvedValueOnce([
      { group_id: 10, group_alias_name: '営業部', owner_id: 1 },
      { group_id: 20, group_alias_name: '開発部', owner_id: 1 },
      { group_id: 30, group_alias_name: 'マイグループA', owner_id: 999 },
    ])

    const result = await getGroupList(999)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ groupId: 10, groupName: '営業部' })
    expect(result[2]).toEqual({ groupId: 30, groupName: 'マイグループA' })
  })

  it('システムグループ（group_id=1,2,3）を除外する条件を設定する', async () => {
    mockDb.execute.mockResolvedValueOnce([])

    await getGroupList(999)

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
describe('getMyGroups', () => {
  it('ログインユーザーが作成したマイグループ一覧を ScheduleGroup 型に変換して返す', async () => {
    // AIPO 準拠: owner_id = userId のグループのみ（自分が作成したマイグループ）
    mockDb.execute.mockResolvedValueOnce([
      { group_id: 10, group_alias_name: 'レスコ チーム' },
      { group_id: 20, group_alias_name: 'SE主要' },
    ])

    const result = await getMyGroups(42)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ groupId: 10, groupName: 'レスコ チーム' })
    expect(result[1]).toEqual({ groupId: 20, groupName: 'SE主要' })
    // owner_id = userId の条件が設定されているか（AIPO 準拠）
    expect(mockDb.where).toHaveBeenCalledWith('owner_id', '=', 42)
  })

  it('システムグループ（group_id=1,2,3）を除外する条件を設定する', async () => {
    mockDb.execute.mockResolvedValueOnce([])

    await getMyGroups(1)

    expect(mockDb.where).toHaveBeenCalledWith('group_id', 'not in', [1, 2, 3])
  })

  it('alias_name が null のグループを除外する条件を設定する', async () => {
    mockDb.execute.mockResolvedValueOnce([])

    await getMyGroups(1)

    expect(mockDb.where).toHaveBeenCalledWith('group_alias_name', 'is not', null)
  })

  it('グループが0件の場合は空配列を返す', async () => {
    mockDb.execute.mockResolvedValueOnce([])

    const result = await getMyGroups(99)

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
  // Phase F: 親レコード 1 件と親の map だけを登録し、子レコードは作らない
  function mockSeq() {
    let seq = 100
    mockDb.executeTakeFirstOrThrow.mockImplementation(async () => ({ seq_id: seq++ }))
    mockDb.execute.mockResolvedValue([])
  }

  it('親レコードだけを INSERT し、子レコードは作成しない', async () => {
    mockSeq()
    await addRepeatSchedule(42, {
      name: '毎日テスト',
      startDate: new Date('2026-07-07T10:00:00+09:00'),
      endDate: new Date('2026-07-07T11:00:00+09:00'),
      publicFlag: 'O',
      repeatType: 'daily',
      limitEndDate: new Date('2026-07-09T00:00:00+09:00'),
    })

    const scheduleInserts = mockDb.insertInto.mock.calls.filter((c) => c[0] === 'eip_t_schedule')
    expect(scheduleInserts).toHaveLength(1)
    const parent = mockDb.values.mock.calls[0][0]
    expect(parent.parent_id).toBe(0)
    expect(parent.repeat_pattern).toBe('DL')
    // start_date = 最初の出現の開始、end_date = 最後の出現の終了（終了日あり）
    expect(parent.start_date).toBe('2026-07-07 10:00:00')
    expect(parent.end_date).toBe('2026-07-09 11:00:00')
  })

  it('親に参加ユーザー・設備の map を登録する（AIPO 準拠）', async () => {
    mockSeq()
    await addRepeatSchedule(42, {
      name: '週次',
      startDate: new Date('2026-10-05T10:00:00+09:00'),
      endDate: new Date('2026-10-05T11:00:00+09:00'),
      publicFlag: 'O',
      repeatType: 'weekly',
      weekDays: [false, true, false, false, false, false, false],
      participantIds: [7],
      facilityIds: [5],
    })

    const parentId = mockDb.values.mock.calls[0][0].schedule_id
    const mapRows = mockDb.values.mock.calls.slice(1).flatMap((c) => (Array.isArray(c[0]) ? c[0] : [c[0]]))
    expect(mapRows.every((r) => r.schedule_id === parentId)).toBe(true)
    expect(mapRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ user_id: 42, type: 'U', status: 'O' }),
      expect.objectContaining({ user_id: 7, type: 'U', status: 'T' }),
      expect.objectContaining({ user_id: 5, type: 'F', status: 'O' }),
    ]))
  })

  it('終了日なし: 開始日以降で最初に一致する日を start_date / end_date にする', async () => {
    mockSeq()
    // 2026-10-01 は木曜。毎週月曜 → 最初の出現は 2026-10-05
    await addRepeatSchedule(42, {
      name: '月曜定例',
      startDate: new Date('2026-10-01T10:00:00+09:00'),
      endDate: new Date('2026-10-01T11:00:00+09:00'),
      publicFlag: 'O',
      repeatType: 'weekly',
      weekDays: [false, true, false, false, false, false, false],
    })
    const parent = mockDb.values.mock.calls[0][0]
    expect(parent.repeat_pattern).toBe('W0100000N')
    expect(parent.start_date).toBe('2026-10-05 10:00:00')
    expect(parent.end_date).toBe('2026-10-05 11:00:00')
  })

  it('期間内に出現日が無い場合はエラーにする', async () => {
    mockSeq()
    await expect(addRepeatSchedule(42, {
      name: '出現なし',
      startDate: new Date('2026-10-01T10:00:00+09:00'),
      endDate: new Date('2026-10-01T11:00:00+09:00'),
      publicFlag: 'O',
      repeatType: 'weekly',
      weekDays: [false, true, false, false, false, false, false],
      limitStartDate: new Date('2026-10-01T00:00:00+09:00'),
      limitEndDate: new Date('2026-10-02T00:00:00+09:00'),
    })).rejects.toThrow('繰り返し出現日が0件です')
  })
})

// ===========================================================
describe('updateRepeatOne', () => {
  const input = {
    name: '変更後', startDate: new Date('2026-10-08T13:00:00+09:00'), endDate: new Date('2026-10-08T14:00:00+09:00'),
    isAllDay: false, publicFlag: 'O' as const, participantIds: [7],
  }

  it('個別変更レコードを作成し、出現日にダミーを作成する', async () => {
    mockDb.executeTakeFirstOrThrow
      .mockResolvedValueOnce({ seq_id: 200 })  // 個別変更レコード
      .mockResolvedValueOnce({ seq_id: 400 })  // ダミー
    mockDb.execute
      .mockResolvedValueOnce([{ schedule_id: 100, edit_flag: 'T' }])  // 親（owner 確認）
      .mockResolvedValueOnce([
        { user_id: 42, type: 'U', status: 'O' },
        { user_id: 7, type: 'U', status: 'C' },
        { user_id: 5, type: 'F', status: 'O' },
      ])                                                              // 親の map
      .mockResolvedValueOnce([])                                      // INSERT 個別変更
      .mockResolvedValueOnce([{ seq_id: 301 }, { seq_id: 302 }])     // map ID
      .mockResolvedValueOnce([])                                      // INSERT map
      .mockResolvedValueOnce([])                                      // INSERT ダミー
      .mockResolvedValueOnce([{ seq_id: 501 }, { seq_id: 502 }, { seq_id: 503 }])
      .mockResolvedValueOnce([])

    await updateRepeatOne(100, '2026-10-08', 42, input)

    const child = mockDb.values.mock.calls[0][0]
    expect(child).toEqual(expect.objectContaining({ schedule_id: 200, parent_id: 100, repeat_pattern: 'N', name: '変更後' }))
    // 参加者の status: オーナーは 'O'、それ以外は親の status を引き継ぐ
    expect(mockDb.values.mock.calls[1][0]).toEqual([
      expect.objectContaining({ user_id: 42, status: 'O' }),
      expect.objectContaining({ user_id: 7, status: 'C' }),
    ])
    const dummy = mockDb.values.mock.calls[2][0]
    expect(dummy).toEqual(expect.objectContaining({
      schedule_id: 400, parent_id: 100, name: 'dummy', start_date: '2026-10-08 00:00:00', end_date: '2026-10-08 00:00:00',
    }))
    // ダミーの map は親の参加ユーザー・設備すべてに status='D'
    const dummyMaps = mockDb.values.mock.calls[3][0]
    expect(dummyMaps.every((m: { status: string }) => m.status === 'D')).toBe(true)
    expect(dummyMaps).toEqual(expect.arrayContaining([expect.objectContaining({ user_id: 5, type: 'F' })]))
  })

  it('owner でない場合はエラーにする', async () => {
    mockDb.execute.mockResolvedValueOnce([])
    await expect(updateRepeatOne(100, '2026-10-08', 99, input)).rejects.toThrow()
    expect(mockDb.insertInto).not.toHaveBeenCalled()
  })
})

// ===========================================================
describe('updateRepeatAll', () => {
  const input = {
    name: '全変更', startDate: new Date('2026-10-08T13:00:00+09:00'), endDate: new Date('2026-10-08T14:00:00+09:00'),
    isAllDay: false, publicFlag: 'O' as const,
  }

  it('親レコードだけを更新し、時刻は日付部分を変えずに置き換える（子レコードは変更しない）', async () => {
    mockDb.execute.mockResolvedValueOnce([{ schedule_id: 100, edit_flag: 'T' }]).mockResolvedValue([])
    await updateRepeatAll(100, 42, input)

    expect(mockDb.updateTable).toHaveBeenCalledTimes(1)
    const set = mockDb.set.mock.calls[0][0]
    expect(set.name).toBe('全変更')
    // date_trunc('day', ...) + interval の sql 式（文字列の日時で上書きしない）
    expect(typeof set.start_date).not.toBe('string')
    expect(mockDb.where).toHaveBeenCalledWith('schedule_id', '=', 100)
    expect(mockDb.where).not.toHaveBeenCalledWith('parent_id', '=', 100)
  })

  it('participantIds 指定時: 親の参加ユーザーの map だけを置き換える', async () => {
    mockDb.executeTakeFirstOrThrow.mockResolvedValue({ seq_id: 900 })
    mockDb.execute.mockResolvedValueOnce([{ schedule_id: 100, edit_flag: 'T' }]).mockResolvedValue([])
    await updateRepeatAll(100, 42, { ...input, participantIds: [7] })

    expect(mockDb.where).toHaveBeenCalledWith('type', '=', 'U')
    expect(mockDb.where).not.toHaveBeenCalledWith('type', '=', 'F')
  })

  it('owner でない場合はエラーにする', async () => {
    mockDb.execute.mockResolvedValueOnce([])
    await expect(updateRepeatAll(100, 99, input)).rejects.toThrow()
    expect(mockDb.updateTable).not.toHaveBeenCalled()
  })
})

// ===========================================================
describe('deleteRepeatOne', () => {
  it('出現日にダミーを作成し、親レコードは変更・削除しない', async () => {
    mockDb.executeTakeFirstOrThrow.mockResolvedValueOnce({ seq_id: 400 })
    mockDb.execute
      .mockResolvedValueOnce([{ schedule_id: 100, edit_flag: 'T' }])
      .mockResolvedValueOnce([{ user_id: 42, type: 'U', status: 'O' }])
      .mockResolvedValue([{ seq_id: 501 }])

    await deleteRepeatOne(100, '2026-10-08', 42)

    expect(mockDb.values.mock.calls[0][0]).toEqual(expect.objectContaining({
      parent_id: 100, name: 'dummy', start_date: '2026-10-08 00:00:00',
    }))
    expect(mockDb.deleteFrom).not.toHaveBeenCalled()
    expect(mockDb.updateTable).not.toHaveBeenCalled()
  })

  it('owner でない場合はエラーにする', async () => {
    mockDb.execute.mockResolvedValueOnce([])
    await expect(deleteRepeatOne(100, '2026-10-08', 99)).rejects.toThrow()
  })
})

// ===========================================================
describe('deleteRepeatAll', () => {
  it('親とダミーを削除し、個別変更レコードは残す（AIPO 準拠）', async () => {
    mockDb.execute
      .mockResolvedValueOnce([{ schedule_id: 100, edit_flag: 'T' }])
      // ダミー（同じダミーの map が複数行返る）
      .mockResolvedValueOnce([{ schedule_id: 501 }, { schedule_id: 501 }, { schedule_id: 502 }])
      .mockResolvedValue([])

    await deleteRepeatAll(100, 42)

    // ダミーは map の status='D' で判定する（個別変更レコードは対象にならない）
    expect(mockDb.where).toHaveBeenCalledWith('sm.status', '=', 'D')
    expect(mockDb.where).toHaveBeenCalledWith('schedule_id', 'in', [100, 501, 502])
    expect(mockDb.where).toHaveBeenCalledWith('schedule_id', 'in', [501, 502])
    expect(mockDb.where).toHaveBeenCalledWith('owner_id', '=', 42)
    expect(mockDb.where).not.toHaveBeenCalledWith('parent_id', '=', 100)
  })

  it('owner でない場合はエラーにする', async () => {
    mockDb.execute.mockResolvedValueOnce([])
    await expect(deleteRepeatAll(100, 99)).rejects.toThrow()
    expect(mockDb.deleteFrom).not.toHaveBeenCalled()
  })
})

// ===========================================================
// Phase D: 一覧ビュー
// ===========================================================

describe('getListSchedules', () => {
  it('from から 7 日間の予定を開始日時の昇順で返す（一覧モード）', async () => {
    mockDb.execute
      .mockResolvedValueOnce([
        { ...{
  schedule_id: 1, name: '予定', note: null, place: null,
  start_date_text: '2026-10-05 10:00:00', end_date_text: '2026-10-05 11:00:00',
  public_flag: 'O', repeat_pattern: 'N', parent_id: 0, owner_id: 42,
  view_user_id: 42, view_user_name: '田中 太郎',
}, schedule_id: 2, start_date_text: '2026-10-07 09:00:00', end_date_text: '2026-10-07 10:00:00' },
        { ...{
  schedule_id: 1, name: '予定', note: null, place: null,
  start_date_text: '2026-10-05 10:00:00', end_date_text: '2026-10-05 11:00:00',
  public_flag: 'O', repeat_pattern: 'N', parent_id: 0, owner_id: 42,
  view_user_id: 42, view_user_name: '田中 太郎',
}, schedule_id: 1, start_date_text: '2026-10-05 09:00:00', end_date_text: '2026-10-05 10:00:00' },
      ])
      .mockResolvedValue([])
    const result = await getListSchedules(42, [42], new Date('2026-10-05T00:00:00+09:00'))
    expect(result.map((r) => r.scheduleId)).toEqual([1, 2])
  })

  it('繰り返しの親は出現ごとに返す', async () => {
    mockDb.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        ...{
  schedule_id: 1, name: '予定', note: null, place: null,
  start_date_text: '2026-10-05 10:00:00', end_date_text: '2026-10-05 11:00:00',
  public_flag: 'O', repeat_pattern: 'N', parent_id: 0, owner_id: 42,
  view_user_id: 42, view_user_name: '田中 太郎',
}, schedule_id: 100, repeat_pattern: 'DN',
        start_date_text: '2026-01-01 09:00:00', end_date_text: '2026-01-01 10:00:00',
      }])
      .mockResolvedValue([])
    const result = await getListSchedules(42, [42], new Date('2026-10-05T00:00:00+09:00'))
    // 2026-10-05〜2026-10-11 の 7 日分
    expect(result).toHaveLength(7)
    expect(result[0].occurrenceDate).toBe('2026-10-05')
    expect(result[6].occurrenceDate).toBe('2026-10-11')
  })

  it('userIds が空の場合は空配列を返す（DB クエリを実行しない）', async () => {
    const result = await getListSchedules(42, [], new Date())
    expect(result).toEqual([])
    expect(mockDb.selectFrom).not.toHaveBeenCalled()
  })
})

describe('searchSchedules', () => {
  it('キーワードが空の場合は DB を叩かずに空配列を返す', async () => {
    expect(await searchSchedules(42, [42], '  ', 30, 0)).toEqual([])
    expect(mockDb.selectFrom).not.toHaveBeenCalled()
  })

  it('開始日時の降順で limit / offset を指定して検索する（日付の条件は付けない）', async () => {
    mockDb.execute.mockResolvedValueOnce([])
    await searchSchedules(42, [42], '会議', 31, 30)
    expect(mockDb.orderBy).toHaveBeenCalledWith(expect.anything(), 'desc')
    expect(mockDb.limit).toHaveBeenCalledWith(31)
    expect(mockDb.offset).toHaveBeenCalledWith(30)
  })

  it('繰り返しの親は出現に展開せず 1 件として返す', async () => {
    mockDb.execute.mockResolvedValueOnce([{ ...{
  schedule_id: 1, name: '予定', note: null, place: null,
  start_date_text: '2026-10-05 10:00:00', end_date_text: '2026-10-05 11:00:00',
  public_flag: 'O', repeat_pattern: 'N', parent_id: 0, owner_id: 42,
  view_user_id: 42, view_user_name: '田中 太郎',
}, schedule_id: 100, repeat_pattern: 'W0000100L' }])
    const result = await searchSchedules(42, [42], '会議', 30, 0)
    expect(result).toHaveLength(1)
    expect(result[0].repeatPattern).toBe('W0000100L')
    expect(result[0].occurrenceDate).toBeNull()
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
  const normalRow = {
    schedule_id: 10, facility_id: 1, repeat_pattern: 'N',
    start_date_text: '2026-10-30 12:00:00', end_date_text: '2026-10-30 19:00:00',
  }
  const weeklyRow = {
    schedule_id: 20, facility_id: 2, repeat_pattern: 'W0000100L',
    start_date_text: '2025-06-05 15:50:00', end_date_text: '2027-01-31 17:00:00',
  }

  it('通常予定と時刻が重なる設備 ID を返す', async () => {
    mockDb.execute.mockResolvedValueOnce([normalRow]).mockResolvedValueOnce([])
    const result = await getBookedFacilityIds(new Date('2026-10-30T13:00:00+09:00'), new Date('2026-10-30T14:00:00+09:00'))
    expect(result).toEqual([1])
    expect(mockDb.where).toHaveBeenCalledWith('sm.type', '=', 'F')
    // ダミーの設備 map は予約として扱わない
    expect(mockDb.where).toHaveBeenCalledWith('sm.status', '!=', 'D')
  })

  it('繰り返し予定の出現と時刻が重なる設備 ID を返す（#204）', async () => {
    mockDb.execute
      .mockResolvedValueOnce([])           // 通常予定
      .mockResolvedValueOnce([weeklyRow])  // 繰り返しの親
      .mockResolvedValueOnce([])           // ダミー
    const result = await getBookedFacilityIds(new Date('2026-10-08T16:00:00+09:00'), new Date('2026-10-08T16:30:00+09:00'))
    expect(result).toEqual([2])
  })

  it('ダミーで削除された日の出現は使用中にしない', async () => {
    mockDb.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([weeklyRow])
      .mockResolvedValueOnce([{ parent_id: 20, date_text: '2026-10-08' }])
    const result = await getBookedFacilityIds(new Date('2026-10-08T16:00:00+09:00'), new Date('2026-10-08T16:30:00+09:00'))
    expect(result).toEqual([])
  })

  it('excludeScheduleId + excludeDate 指定時: その日の出現だけを除外する', async () => {
    mockDb.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([weeklyRow]).mockResolvedValueOnce([])
    const result = await getBookedFacilityIds(
      new Date('2026-10-08T16:00:00+09:00'), new Date('2026-10-08T16:30:00+09:00'), 20, '2026-10-08',
    )
    expect(result).toEqual([])
  })

  it('repeat 指定時: 新しく作る繰り返しのいずれかの出現と重なる設備を返す', async () => {
    mockDb.execute.mockResolvedValueOnce([normalRow]).mockResolvedValueOnce([])
    // 毎週金曜 13:00〜14:00、2026-10-01〜2026-12-31 → 10/30（金）の通常予定と重なる
    const result = await getBookedFacilityIds(
      new Date('2026-10-02T13:00:00+09:00'),
      new Date('2026-10-02T14:00:00+09:00'),
      undefined,
      undefined,
      { pattern: 'W0000010L', limitStartDate: new Date('2026-10-01T00:00:00+09:00'), limitEndDate: new Date('2026-12-31T00:00:00+09:00') },
    )
    expect(result).toEqual([1])
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
