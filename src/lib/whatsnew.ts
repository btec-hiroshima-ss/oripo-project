import { sql } from 'kysely'
import { db } from './db'
import type { WhatsnewEntry } from './whatsnew.types'

// ウィジェットの表示件数上限（要件定義書 2.3: 最新 N 件）
const WHATSNEW_LIMIT = 20

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
export async function getWhatsnewList(loginName: string): Promise<WhatsnewEntry[]> {
  const rows = await db
    .selectFrom('activity as a')
    .innerJoin('activity_map as am', 'am.activity_id', 'a.id')
    .innerJoin('turbine_user as tu', 'tu.login_name', 'a.login_name')
    .select([
      'a.id as activity_id',
      'a.title',
      'a.external_id',
      'a.update_date',
      'tu.user_id as updater_user_id',
      sql<string>`tu.last_name || ' ' || tu.first_name`.as('updater_name'),
      sql<string>`LEFT(tu.last_name, 1)`.as('updater_initial'),
    ])
    .where('a.app_id', '=', 'Schedule')
    .where((eb) =>
      eb.or([
        eb('am.login_name', '=', '-1'),
        eb('am.login_name', '=', loginName),
      ])
    )
    // 同一 activity.id が activity_map に複数行あってもここでは重複しないが念のため DISTINCT
    .distinct()
    .orderBy('a.update_date', 'desc')
    .limit(WHATSNEW_LIMIT)
    .execute()

  return rows.map((row) => {
    const updateDate = row.update_date ? new Date(row.update_date) : new Date()

    // title 例: "予定「休み」を追加しました。" / "予定「週次定例」を編集しました。"
    const nameMatch = row.title.match(/「(.+?)」/)
    const scheduleName = nameMatch ? nameMatch[1] : null
    const isNew = row.title.includes('追加')

    return {
      whatsnewId: row.activity_id,
      portletType: 6,
      entityId: row.external_id ? parseInt(row.external_id, 10) : 0,
      scheduleName,
      updaterName: row.updater_name,
      updaterInitial: row.updater_initial ?? '?',
      updaterUserId: row.updater_user_id,
      updateDate,
      isNew,
    }
  })
}
