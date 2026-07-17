'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
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
import type { PageWidget } from '@/lib/pages.types'
import { getUserList, getUserDetail } from '@/lib/user-list'
import type { UserListUser, UserListDetail } from '@/lib/user-list.types'
import { getActivityList } from '@/lib/activity'
import type { ActivityEntry } from '@/lib/activity.types'

export async function addPageAction(pageName: string) {
  const { userId } = await requireAuth()
  const page = await createPage(userId, pageName)
  revalidatePath('/')
  return page
}

export async function updatePageAction(
  pageId: number,
  updates: Partial<{ pageName: string; layout: PageLayout; sortOrder: number }>
) {
  const { userId } = await requireAuth()
  await updatePage(pageId, userId, updates)
  revalidatePath('/')
}

export async function deletePageAction(pageId: number) {
  const { userId } = await requireAuth()
  await deletePage(pageId, userId)
  revalidatePath('/')
}

export async function reorderPagesAction(orderedPageIds: number[]) {
  const { userId } = await requireAuth()
  await reorderPages(userId, orderedPageIds)
  revalidatePath('/')
}

export async function addWidgetAction(pageId: number, widgetType: WidgetType) {
  const widget = await addWidget(pageId, widgetType)
  // revalidatePath を呼ばない: 戻り値で楽観的更新するため、即時 RSC 再レンダリング不要
  // TODO: 楽観的更新が失敗した場合（ネットワークエラーなど）のロールバック未実装
  return widget
}

// AIPO 方式のページ設定モーダルから複数ウィジェットを一括追加する。
// 1件ずつ addWidgetAction を呼ぶよりも往復回数が少ない。
export async function addWidgetsAction(pageId: number, widgetTypes: WidgetType[]): Promise<PageWidget[]> {
  return Promise.all(widgetTypes.map((type) => addWidget(pageId, type)))
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

// ユーザー名簿ウィジェット用。ログイン済みユーザーなら誰でも閲覧可能。
export async function getUserListAction(): Promise<UserListUser[]> {
  await requireAuth()
  return getUserList()
}

// ユーザー詳細モーダル用。ログイン済みユーザーなら誰でも閲覧可能。
export async function getUserDetailAction(userId: number): Promise<UserListDetail | null> {
  await requireAuth()
  return getUserDetail(userId)
}

// 更新情報ウィジェット用。ログイン済みユーザーなら誰でも閲覧可能。
// page: 1始まり。loginName を渡して全員向け + 自分が共有相手のアクティビティを取得する。
export async function getActivityAction(
  page = 1
): Promise<{ entries: ActivityEntry[]; totalCount: number }> {
  const { loginName } = await requireAuth()
  return getActivityList(loginName, page)
}
