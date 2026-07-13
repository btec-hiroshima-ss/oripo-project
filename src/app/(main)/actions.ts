'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import {
  createPage,
  updatePage,
  deletePage,
  addWidget,
  updateWidgetPosition,
  deleteWidget,
  reorderPages,
  type PageLayout,
  type WidgetType,
} from '@/lib/pages'

async function getUserId(): Promise<number> {
  const session = await getSession()
  if (!session.userId) throw new Error('Unauthorized')
  return session.userId
}

export async function addPageAction(pageName: string) {
  const userId = await getUserId()
  const page = await createPage(userId, pageName)
  revalidatePath('/')
  return page
}

export async function updatePageAction(
  pageId: number,
  updates: Partial<{ pageName: string; layout: PageLayout; sortOrder: number }>
) {
  const userId = await getUserId()
  await updatePage(pageId, userId, updates)
  revalidatePath('/')
}

export async function deletePageAction(pageId: number) {
  const userId = await getUserId()
  await deletePage(pageId, userId)
  revalidatePath('/')
}

export async function reorderPagesAction(orderedPageIds: number[]) {
  const userId = await getUserId()
  await reorderPages(userId, orderedPageIds)
  revalidatePath('/')
}

export async function addWidgetAction(pageId: number, widgetType: WidgetType) {
  const widget = await addWidget(pageId, widgetType)
  // revalidatePath を呼ばない: 戻り値で楽観的更新するため、即時 RSC 再レンダリング不要
  // TODO: 楽観的更新が失敗した場合（ネットワークエラーなど）のロールバック未実装
  return widget
}

export async function updateWidgetPositionAction(
  widgetId: number,
  col: number,
  row: number
) {
  await updateWidgetPosition(widgetId, col, row)
  // revalidatePath を呼ばない: D&D で複数件 Promise.all するため revalidatePath が競合し
  // "unexpected response from server" エラーを引き起こす。楽観的更新で UI は同期済み。
}

export async function deleteWidgetAction(widgetId: number) {
  await deleteWidget(widgetId)
  // revalidatePath を呼ばない: onDeleted コールバックで楽観的更新するため不要
}
