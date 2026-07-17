import { sql } from 'kysely'
import { db } from './db'
import type { ActivityEntry } from './activity.types'
import { ACTIVITY_PAGE_SIZE } from './activity.utils'

// 【AIPO調査結果】
// AIPO はスケジュール保存時に ALActivityService.create() を呼び出し、
// `activity` テーブル + `activity_map` テーブルに書き込む（ScheduleUtils.java 参照）。
// `eip_t_whatsnew` はスケジュールでは使用されていない（全検索で呼び出し元なし、本番DBも空）。
//
// activity.priority の意味:
//   0 = 全員向け公開（activity_map.login_name = '-1'）
//   1 = 共有先限定（activity_map.login_name = 特定ユーザー）
//
// 表示対象: priority=0（全員向け）+ priority=1 かつ自分が共有相手のアクティビティ
export async function getActivityList(
  loginName: string,
  page = 1
): Promise<{ entries: ActivityEntry[]; totalCount: number }> {
  const offset = (page - 1) * ACTIVITY_PAGE_SIZE

  const baseQuery = db
    .selectFrom('activity as a')
    .innerJoin('activity_map as am', 'am.activity_id', 'a.id')
    .innerJoin('turbine_user as tu', 'tu.login_name', 'a.login_name')
    .where('a.app_id', '=', 'Schedule')
    .where((eb) =>
      eb.or([
        eb('am.login_name', '=', '-1'),
        eb('am.login_name', '=', loginName),
      ])
    )

  // 総件数を取得（ページング表示「1〜10/550」のため）
  // DISTINCT が必要なのは同一 activity.id が条件に複数マッチする可能性があるため
  const countRow = await baseQuery
    .select(sql<string>`COUNT(DISTINCT a.id)`.as('count'))
    .executeTakeFirstOrThrow()
  const totalCount = parseInt(countRow.count, 10)

  const rows = await baseQuery
    .select([
      'a.id as activity_id',
      'a.title',
      'a.external_id',
      'a.update_date',
      'tu.user_id as updater_user_id',
      sql<string>`tu.last_name || ' ' || tu.first_name`.as('updater_name'),
      sql<string>`LEFT(tu.last_name, 1)`.as('updater_initial'),
    ])
    .distinct()
    .orderBy('a.update_date', 'desc')
    .limit(ACTIVITY_PAGE_SIZE)
    .offset(offset)
    .execute()

  const entries = rows.map((row) => {
    const updateDate = row.update_date ? new Date(row.update_date) : new Date()

    // title 例: "予定「休み」を追加しました。" / "予定「週次定例」を編集しました。"
    const nameMatch = row.title.match(/「(.+?)」/)
    const scheduleName = nameMatch ? nameMatch[1] : null
    const isNew = row.title.includes('追加')

    return {
      activityId: row.activity_id,
      entityId: row.external_id ? parseInt(row.external_id, 10) : 0,
      scheduleName,
      updaterName: row.updater_name,
      updaterInitial: row.updater_initial ?? '?',
      updaterUserId: row.updater_user_id,
      updateDate,
      isNew,
    }
  })

  return { entries, totalCount }
}
