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
  getWidgetSettings,
  saveWidgetSettings,
  getMobileWidgetSettings,
  saveMobileWidgetSettings,
  type PageLayout,
  type WidgetType,
} from '@/lib/pages'
import type { PageWidget } from '@/lib/pages.types'
import { getUserList, getUserDetail } from '@/lib/user-list'
import type { UserListUser, UserListDetail } from '@/lib/user-list.types'
import { getActivityList } from '@/lib/activity'
import type { ActivityEntry } from '@/lib/activity.types'
import {
  getWeekSchedules,
  getScheduleDetail,
  addSchedule,
  updateSchedule,
  deleteSchedule,
  getWeekSchedulesMulti,
  getScheduleUsers,
  getMyGroups,
  getGroupList,
  getGroupMembers,
  getScheduleParticipantIds,
  getLoginUserName,
  addRepeatSchedule,
  updateRepeatOne,
  updateRepeatAll,
  deleteRepeatOne,
  deleteRepeatAll,
  getListSchedules,
  getFacilities,
  getBookedFacilityIds,
  getScheduleFacilityIds,
} from '@/lib/schedule'
import type {
  ScheduleEntry,
  ScheduleDetail,
  ScheduleInput,
  RepeatScheduleInput,
  ScheduleUser,
  ScheduleGroup,
  MultiUserScheduleEntry,
  FacilityWithGroup,
} from '@/lib/schedule.types'
import { addDays, addWeeks } from 'date-fns'
import { fetchHolidays } from '@/lib/holidays'
import { makeDateJst } from '@/lib/jst'

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

// スケジュールウィジェット用。

// weekStart: "YYYY-MM-DD"（JST 日曜日）。週の日曜〜翌週日曜 00:00 JST 範囲で取得する。
export async function getWeekSchedulesAction(weekStart: string): Promise<ScheduleEntry[]> {
  const { userId } = await requireAuth()
  // weekStart を JST 00:00 として解釈し、7日間の範囲を計算する
  const from = makeDateJst(weekStart)
  const to = addWeeks(from, 1)
  return getWeekSchedules(userId, from, to)
}

export async function getScheduleDetailAction(scheduleId: number): Promise<ScheduleDetail> {
  await requireAuth()
  return getScheduleDetail(scheduleId)
}

export async function addScheduleAction(input: ScheduleInput): Promise<ScheduleEntry> {
  const { userId } = await requireAuth()
  return addSchedule(userId, input)
}

export async function updateScheduleAction(
  scheduleId: number,
  input: ScheduleInput
): Promise<ScheduleEntry> {
  const { userId } = await requireAuth()
  return updateSchedule(scheduleId, userId, input)
}

export async function deleteScheduleAction(scheduleId: number): Promise<void> {
  const { userId } = await requireAuth()
  return deleteSchedule(scheduleId, userId)
}

// ===========================================================
// Phase C: 繰り返し予定
// ===========================================================

export async function addRepeatScheduleAction(input: RepeatScheduleInput): Promise<void> {
  const { userId } = await requireAuth()
  return addRepeatSchedule(userId, input)
}

export async function updateRepeatOneAction(scheduleId: number, input: ScheduleInput): Promise<void> {
  const { userId } = await requireAuth()
  return updateRepeatOne(scheduleId, userId, input)
}

export async function updateRepeatAllAction(parentId: number, input: ScheduleInput): Promise<void> {
  const { userId } = await requireAuth()
  return updateRepeatAll(parentId, userId, input)
}

export async function deleteRepeatOneAction(scheduleId: number): Promise<void> {
  const { userId } = await requireAuth()
  return deleteRepeatOne(scheduleId, userId)
}

export async function deleteRepeatAllAction(parentId: number): Promise<void> {
  const { userId } = await requireAuth()
  return deleteRepeatAll(parentId, userId)
}

// 祝日データ取得。ログイン済みユーザーのみ利用可能。
// holidays-jp API から取得し Next.js fetch キャッシュで24時間保持する。
export async function getHolidaysAction(): Promise<Record<string, string>> {
  await requireAuth()
  return fetchHolidays()
}

// Phase B: マルチユーザービュー・ユーザーピッカー用アクション

// ログインユーザーの userId と氏名を返す（Client Component からマルチユーザービューの初期化に使用）
// fullName はチップ表示に使う。スケジュールが0件の週でも正しく表示するために氏名を別途取得する。
export async function getLoginUserIdAction(): Promise<{ userId: number; fullName: string }> {
  const { userId } = await requireAuth()
  const fullName = await getLoginUserName(userId)
  return { userId, fullName }
}

// 複数ユーザーの週スケジュールを一括取得する（ユーザー選択ビュー用）。
// 他ユーザーの public_flag='C' は除外し、'P' は "非公開" にマスキングする。
export async function getWeekSchedulesMultiAction(
  userIds: number[],
  weekStart: string
): Promise<MultiUserScheduleEntry[]> {
  const { userId } = await requireAuth()
  const from = makeDateJst(weekStart)
  const to = addWeeks(from, 1)
  return getWeekSchedulesMulti(userId, userIds, from, to)
}

// ユーザーピッカー用アクティブユーザー一覧（氏名カナ昇順）
export async function getScheduleUsersAction(): Promise<ScheduleUser[]> {
  await requireAuth()
  return getScheduleUsers()
}

// 週・日グループビュー用: ログインユーザーが所属するグループのみ（AIPO getMyGroups 相当）
// クライアントから userId を受け取らず requireAuth() から取得することで任意ユーザー情報取得を防ぐ
export async function getMyGroupsAction(): Promise<ScheduleGroup[]> {
  const { userId } = await requireAuth()
  return getMyGroups(userId)
}

// ユーザーピッカー用グループ一覧（システムグループ除外）
export async function getGroupListAction(): Promise<ScheduleGroup[]> {
  await requireAuth()
  return getGroupList()
}

// グループメンバー一覧（ピッカーのグループ展開時に取得）
export async function getGroupMembersAction(groupId: number): Promise<ScheduleUser[]> {
  await requireAuth()
  return getGroupMembers(groupId)
}

// 編集フォーム初期値用: スケジュールの現在の参加者 ID リストを取得する
export async function getScheduleParticipantIdsAction(scheduleId: number): Promise<number[]> {
  await requireAuth()
  return getScheduleParticipantIds(scheduleId)
}

// ウィジェット設定の読み書き（AIPO の PSML portlet_config 相当）。
// Schedule の選択ユーザー等、ウィジェットインスタンスごとの設定を永続化する。

export async function getWidgetSettingsAction(widgetId: number): Promise<Record<string, unknown> | null> {
  await requireAuth()
  return getWidgetSettings(widgetId)
}

export async function saveWidgetSettingsAction(
  widgetId: number,
  settings: Record<string, unknown>
): Promise<void> {
  await requireAuth()
  await saveWidgetSettings(widgetId, settings)
}

// ===========================================================
// Phase D: 日/月/一覧ビュー・設備予約
// ===========================================================

// 日ビュー: 指定日の予定を取得する。getWeekSchedulesMulti を1日範囲で呼び出す。
export async function getDaySchedulesAction(
  date: string,
  userIds: number[]
): Promise<MultiUserScheduleEntry[]> {
  const { userId } = await requireAuth()
  const from = makeDateJst(date)
  const to = addDays(from, 1)
  return getWeekSchedulesMulti(userId, userIds, from, to)
}

// 月ビュー: 指定月の全予定を取得する。getWeekSchedulesMulti を月範囲で呼び出す。
// month: "YYYY-MM"（JST）
export async function getMonthSchedulesAction(
  month: string,
  userIds: number[]
): Promise<MultiUserScheduleEntry[]> {
  const { userId } = await requireAuth()
  const [y, m] = month.split('-').map(Number)
  // 月の1日00:00 JST から翌月1日00:00 JST まで
  const from = makeDateJst(`${month}-01`)
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  const to = makeDateJst(`${nextMonth}-01`)
  return getWeekSchedulesMulti(userId, userIds, from, to)
}

// 一覧ビュー: 指定日以降の予定を開始日時昇順で取得する。
// from: "YYYY-MM-DD"（JST）、offset: ページオフセット（30件単位）
export async function getListSchedulesAction(
  from: string,
  userIds: number[],
  limit: number,
  offset: number,
  keyword?: string,
): Promise<MultiUserScheduleEntry[]> {
  const { userId } = await requireAuth()
  const fromDate = makeDateJst(from)
  return getListSchedules(userId, userIds, fromDate, limit, offset, keyword)
}

// 設備一覧取得（設備ピッカー用）
export async function getFacilitiesAction(): Promise<FacilityWithGroup[]> {
  await requireAuth()
  return getFacilities()
}

// 設備空き確認: 指定日時に予約済みの設備 ID セットを返す
// startDate / endDate: "YYYY-MM-DDTHH:MM:SS+09:00" 形式（JST ISO 文字列）
export async function getFacilityAvailabilityAction(
  startDate: string,
  endDate: string,
  excludeScheduleId?: number,
): Promise<number[]> {
  await requireAuth()
  return getBookedFacilityIds(new Date(startDate), new Date(endDate), excludeScheduleId)
}

// 編集フォーム初期値用: スケジュールの現在の予約設備 ID リストを取得する
export async function getScheduleFacilityIdsAction(scheduleId: number): Promise<number[]> {
  await requireAuth()
  return getScheduleFacilityIds(scheduleId)
}

// モバイル表示用ウィジェット設定の読み書き。
// oripo_mobile_widget_settings テーブルに user_id + widget_type をキーとして保存する。
export async function getMobileWidgetSettingsAction(
  widgetType: string
): Promise<Record<string, unknown> | null> {
  const { userId } = await requireAuth()
  return getMobileWidgetSettings(userId, widgetType)
}

export async function saveMobileWidgetSettingsAction(
  widgetType: string,
  settings: Record<string, unknown>
): Promise<void> {
  const { userId } = await requireAuth()
  await saveMobileWidgetSettings(userId, widgetType, settings)
}
