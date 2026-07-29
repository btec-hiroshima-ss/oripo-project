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
  settings?: Record<string, unknown> | null
}
