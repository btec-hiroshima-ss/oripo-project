import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getOrCreateDefaultPages,
  createPage,
  updatePage,
  deletePage,
  addWidget,
  deleteWidget,
  reorderPages,
} from './pages'

// Kysely の流暢 API（メソッドチェーン）を模倣するモック。
// チェーンメソッドは self を返し、execute / executeTakeFirstOrThrow だけをテストごとに制御する。
const mockDb = vi.hoisted(() => {
  const m: Record<string, ReturnType<typeof vi.fn>> = {
    selectFrom: vi.fn(),
    insertInto: vi.fn(),
    updateTable: vi.fn(),
    deleteFrom: vi.fn(),
    select: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
    set: vi.fn(),
    execute: vi.fn(),
    executeTakeFirstOrThrow: vi.fn(),
  }
  return m
})

vi.mock('./db', () => ({ db: mockDb }))

beforeEach(() => {
  // resetAllMocks: 実装・戻り値キューを含めて完全リセット
  vi.resetAllMocks()
  // チェーンメソッドは常に self を返すよう再設定
  for (const method of [
    'selectFrom', 'insertInto', 'updateTable', 'deleteFrom',
    'select', 'where', 'orderBy', 'values', 'returning', 'set',
  ]) {
    mockDb[method].mockReturnValue(mockDb)
  }
})

// --- ヘルパー: DB行形式のフィクスチャ ---
const pageRow = (id: number, name: string, sortOrder: number) => ({
  page_id: id,
  page_name: name,
  layout: 'TwoColumnsRight',
  sort_order: sortOrder,
  is_default: sortOrder === 0,
})

const widgetRow = (id: number, col: number, row: number) => ({
  widget_id: id,
  page_id: 1,
  widget_type: 'Schedule',
  col,
  row,
})

// ============================================================
describe('getOrCreateDefaultPages', () => {
  it('ページ未存在の場合、マイページとデフォルトウィジェット3件を作成して返す', async () => {
    mockDb.execute
      .mockResolvedValueOnce([]) // getUserPages → ページなし
      .mockResolvedValueOnce([]) // oripo_page_widgets の INSERT
    mockDb.executeTakeFirstOrThrow.mockResolvedValueOnce(
      pageRow(1, 'マイページ', 0)
    )

    const result = await getOrCreateDefaultPages(1)

    expect(result).toHaveLength(1)
    expect(result[0].pageName).toBe('マイページ')
    expect(result[0].layout).toBe('TwoColumnsRight')
    expect(result[0].isDefault).toBe(true)
    // ウィジェット INSERT が実行されること
    expect(mockDb.insertInto).toHaveBeenCalledWith('oripo_page_widgets')
  })

  it('ページ既存の場合、INSERT を行わずそのまま返す', async () => {
    mockDb.execute.mockResolvedValueOnce([pageRow(1, 'マイページ', 0)])

    const result = await getOrCreateDefaultPages(1)

    expect(result).toHaveLength(1)
    expect(result[0].pageId).toBe(1)
    // 既存ページがあれば INSERT しない
    expect(mockDb.insertInto).not.toHaveBeenCalled()
  })
})

// ============================================================
describe('createPage', () => {
  it('sort_order = 既存の最大 sort_order + 1 で作成する', async () => {
    mockDb.execute.mockResolvedValueOnce([pageRow(1, 'マイページ', 0)]) // getUserPages
    mockDb.executeTakeFirstOrThrow.mockResolvedValueOnce(pageRow(2, '新規ページ', 1))

    const result = await createPage(1, '新規ページ')

    expect(result.pageName).toBe('新規ページ')
    expect(result.sortOrder).toBe(1)
    // values() に渡された sort_order が 1（既存最大 0 + 1）
    expect(mockDb.values.mock.calls[0][0]).toMatchObject({ sort_order: 1 })
  })

  it('ページが0件の場合は sort_order = 0 で作成する', async () => {
    mockDb.execute.mockResolvedValueOnce([]) // getUserPages → ページなし
    mockDb.executeTakeFirstOrThrow.mockResolvedValueOnce(pageRow(1, '最初のページ', 0))

    await createPage(1, '最初のページ')

    expect(mockDb.values.mock.calls[0][0]).toMatchObject({ sort_order: 0 })
  })
})

// ============================================================
describe('updatePage', () => {
  it('pageName のみを更新する（layout は SET に含まない）', async () => {
    mockDb.execute.mockResolvedValueOnce([])

    await updatePage(1, 1, { pageName: '変更後のページ名' })

    const setArg = mockDb.set.mock.calls[0][0]
    expect(setArg.page_name).toBe('変更後のページ名')
    expect(setArg.layout).toBeUndefined()
  })

  it('layout のみを更新する（pageName は SET に含まない）', async () => {
    mockDb.execute.mockResolvedValueOnce([])

    await updatePage(1, 1, { layout: 'ThreeColumns' })

    const setArg = mockDb.set.mock.calls[0][0]
    expect(setArg.layout).toBe('ThreeColumns')
    expect(setArg.page_name).toBeUndefined()
  })
})

// ============================================================
describe('deletePage', () => {
  it('page_id と user_id の両方でフィルタして削除する', async () => {
    mockDb.execute.mockResolvedValueOnce([])

    await deletePage(5, 3)

    expect(mockDb.deleteFrom).toHaveBeenCalledWith('oripo_pages')
    // 他ユーザーのページを誤削除しないよう user_id 条件が必須
    expect(mockDb.where).toHaveBeenCalledWith('page_id', '=', 5)
    expect(mockDb.where).toHaveBeenCalledWith('user_id', '=', 3)
  })
})

// ============================================================
describe('addWidget', () => {
  it('col=0・既存ウィジェット最大 row+1 の位置に追加する', async () => {
    mockDb.execute.mockResolvedValueOnce([
      widgetRow(1, 0, 0),
      widgetRow(2, 0, 1),
    ]) // getPageWidgets
    mockDb.executeTakeFirstOrThrow.mockResolvedValueOnce({
      widget_id: 3, page_id: 1, widget_type: 'UserList', col: 0, row: 2,
    })

    const result = await addWidget(1, 'UserList')

    expect(result.col).toBe(0)
    expect(result.row).toBe(2)
    // values() に渡された col / row が正しいこと
    expect(mockDb.values.mock.calls[0][0]).toMatchObject({ col: 0, row: 2 })
  })

  it('ウィジェットが0件の場合は row=0 で追加する', async () => {
    mockDb.execute.mockResolvedValueOnce([]) // getPageWidgets → 空
    mockDb.executeTakeFirstOrThrow.mockResolvedValueOnce({
      widget_id: 1, page_id: 1, widget_type: 'Schedule', col: 0, row: 0,
    })

    const result = await addWidget(1, 'Schedule')

    expect(result.row).toBe(0)
    expect(mockDb.values.mock.calls[0][0]).toMatchObject({ col: 0, row: 0 })
  })
})

// ============================================================
describe('deleteWidget', () => {
  it('widget_id でフィルタして削除する', async () => {
    mockDb.execute.mockResolvedValueOnce([])

    await deleteWidget(7)

    expect(mockDb.deleteFrom).toHaveBeenCalledWith('oripo_page_widgets')
    expect(mockDb.where).toHaveBeenCalledWith('widget_id', '=', 7)
  })
})

// ============================================================
describe('reorderPages', () => {
  it('配列の順番どおりに sort_order を更新する', async () => {
    mockDb.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    await reorderPages(1, [10, 20, 30])

    // 3ページ分 updateTable が3回呼ばれること
    expect(mockDb.updateTable).toHaveBeenCalledTimes(3)
    const setCalls = mockDb.set.mock.calls
    expect(setCalls[0][0]).toMatchObject({ sort_order: 0 })
    expect(setCalls[1][0]).toMatchObject({ sort_order: 1 })
    expect(setCalls[2][0]).toMatchObject({ sort_order: 2 })
  })
})
