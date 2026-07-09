import { db } from './db'

export type PageLayout =
  | 'OneColumn'
  | 'TwoColumns'
  | 'TwoColumnsRight'
  | 'TwoColumnsLeft'
  | 'ThreeColumns'

export const LAYOUT_COLUMNS: Record<PageLayout, number> = {
  OneColumn: 1,
  TwoColumns: 2,
  TwoColumnsRight: 2,
  TwoColumnsLeft: 2,
  ThreeColumns: 3,
}

export const LAYOUT_LABELS: Record<PageLayout, string> = {
  OneColumn: '1列',
  TwoColumns: '2列（等幅）',
  TwoColumnsRight: '2列（右広）',
  TwoColumnsLeft: '2列（左広）',
  ThreeColumns: '3列',
}

export type WidgetType = 'Schedule' | 'Whatsnew' | 'UserList'

export const WIDGET_LABELS: Record<WidgetType, string> = {
  Schedule: 'スケジュール',
  Whatsnew: '更新情報',
  UserList: 'ユーザー名簿',
}

export type Page = {
  pageId: number
  pageName: string
  layout: PageLayout
  sortOrder: number
  isDefault: boolean
}

export type PageWidget = {
  widgetId: number
  pageId: number
  widgetType: WidgetType
  col: number
  row: number
}

const DEFAULT_PAGE_NAME = 'マイページ'
const DEFAULT_LAYOUT: PageLayout = 'TwoColumnsRight'
const DEFAULT_WIDGETS: Omit<PageWidget, 'widgetId' | 'pageId'>[] = [
  { widgetType: 'Whatsnew', col: 0, row: 0 },
  { widgetType: 'UserList', col: 0, row: 1 },
  { widgetType: 'Schedule', col: 1, row: 0 },
]

export async function getUserPages(userId: number): Promise<Page[]> {
  const rows = await db
    .selectFrom('oripo_pages')
    .select(['page_id', 'page_name', 'layout', 'sort_order', 'is_default'])
    .where('user_id', '=', userId)
    .orderBy('sort_order', 'asc')
    .execute()

  return rows.map((r) => ({
    pageId: r.page_id,
    pageName: r.page_name,
    layout: r.layout as PageLayout,
    sortOrder: r.sort_order,
    isDefault: r.is_default,
  }))
}

export async function getOrCreateDefaultPages(userId: number): Promise<Page[]> {
  const pages = await getUserPages(userId)
  if (pages.length > 0) return pages

  const inserted = await db
    .insertInto('oripo_pages')
    .values({
      user_id: userId,
      page_name: DEFAULT_PAGE_NAME,
      layout: DEFAULT_LAYOUT,
      sort_order: 0,
      is_default: true,
    })
    .returning(['page_id', 'page_name', 'layout', 'sort_order', 'is_default'])
    .executeTakeFirstOrThrow()

  await db
    .insertInto('oripo_page_widgets')
    .values(
      DEFAULT_WIDGETS.map((w) => ({
        page_id: inserted.page_id,
        widget_type: w.widgetType,
        col: w.col,
        row: w.row,
      }))
    )
    .execute()

  return [
    {
      pageId: inserted.page_id,
      pageName: inserted.page_name,
      layout: inserted.layout as PageLayout,
      sortOrder: inserted.sort_order,
      isDefault: inserted.is_default,
    },
  ]
}

export async function getPageWidgets(pageId: number): Promise<PageWidget[]> {
  const rows = await db
    .selectFrom('oripo_page_widgets')
    .select(['widget_id', 'page_id', 'widget_type', 'col', 'row'])
    .where('page_id', '=', pageId)
    .orderBy('col', 'asc')
    .orderBy('row', 'asc')
    .execute()

  return rows.map((r) => ({
    widgetId: r.widget_id,
    pageId: r.page_id,
    widgetType: r.widget_type as WidgetType,
    col: r.col,
    row: r.row,
  }))
}

export async function createPage(
  userId: number,
  pageName: string
): Promise<Page> {
  const existing = await getUserPages(userId)
  const maxOrder = existing.reduce((m, p) => Math.max(m, p.sortOrder), -1)

  const row = await db
    .insertInto('oripo_pages')
    .values({
      user_id: userId,
      page_name: pageName,
      layout: DEFAULT_LAYOUT,
      sort_order: maxOrder + 1,
      is_default: false,
    })
    .returning(['page_id', 'page_name', 'layout', 'sort_order', 'is_default'])
    .executeTakeFirstOrThrow()

  return {
    pageId: row.page_id,
    pageName: row.page_name,
    layout: row.layout as PageLayout,
    sortOrder: row.sort_order,
    isDefault: row.is_default,
  }
}

export async function updatePage(
  pageId: number,
  userId: number,
  updates: Partial<{ pageName: string; layout: PageLayout; sortOrder: number }>
): Promise<void> {
  await db
    .updateTable('oripo_pages')
    .set({
      ...(updates.pageName !== undefined && { page_name: updates.pageName }),
      ...(updates.layout !== undefined && { layout: updates.layout }),
      ...(updates.sortOrder !== undefined && { sort_order: updates.sortOrder }),
      updated_at: new Date(),
    })
    .where('page_id', '=', pageId)
    .where('user_id', '=', userId)
    .execute()
}

export async function deletePage(pageId: number, userId: number): Promise<void> {
  await db
    .deleteFrom('oripo_pages')
    .where('page_id', '=', pageId)
    .where('user_id', '=', userId)
    .execute()
}

export async function addWidget(
  pageId: number,
  widgetType: WidgetType
): Promise<PageWidget> {
  const existing = await getPageWidgets(pageId)
  const colWidgets = existing.filter((w) => w.col === 0)
  const maxRow = colWidgets.reduce((m, w) => Math.max(m, w.row), -1)

  const row = await db
    .insertInto('oripo_page_widgets')
    .values({ page_id: pageId, widget_type: widgetType, col: 0, row: maxRow + 1 })
    .returning(['widget_id', 'page_id', 'widget_type', 'col', 'row'])
    .executeTakeFirstOrThrow()

  return {
    widgetId: row.widget_id,
    pageId: row.page_id,
    widgetType: row.widget_type as WidgetType,
    col: row.col,
    row: row.row,
  }
}

export async function updateWidgetPosition(
  widgetId: number,
  col: number,
  row: number
): Promise<void> {
  await db
    .updateTable('oripo_page_widgets')
    .set({ col, row, updated_at: new Date() })
    .where('widget_id', '=', widgetId)
    .execute()
}

export async function deleteWidget(widgetId: number): Promise<void> {
  await db
    .deleteFrom('oripo_page_widgets')
    .where('widget_id', '=', widgetId)
    .execute()
}

export async function reorderPages(
  userId: number,
  orderedPageIds: number[]
): Promise<void> {
  for (let i = 0; i < orderedPageIds.length; i++) {
    await db
      .updateTable('oripo_pages')
      .set({ sort_order: i, updated_at: new Date() })
      .where('page_id', '=', orderedPageIds[i])
      .where('user_id', '=', userId)
      .execute()
  }
}
