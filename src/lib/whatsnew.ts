import { sql } from 'kysely'
import { db } from './db'
import type { WhatsnewEntry } from './whatsnew.types'

// AIPO の portlet_type=6 がスケジュール（WhatsNewUtils.WHATS_NEW_TYPE_SCHEDULE）
const PORTLET_TYPE_SCHEDULE = 6

// ウィジェットの表示件数上限（要件定義書 2.3: 最新 N 件）
const WHATSNEW_LIMIT = 20

// eip_t_whatsnew.parent_id の意味（AIPO 仕様）:
//   0  = 全員向け公開エントリ（更新情報として表示するもの）
//  -1  = 個人宛新着（自分だけへの通知）
//  >0  = 既読フラグ（そのユーザーIDが既読したことを示すレコード）
// ウィジェットでは全員向け(0)のみ表示する
const PARENT_ID_PUBLIC = 0

export async function getWhatsnewList(): Promise<WhatsnewEntry[]> {
  const rows = await db
    .selectFrom('eip_t_whatsnew')
    // スケジュールが削除されていても whatsnew レコードは残るため LEFT JOIN
    .leftJoin('eip_t_schedule', (join) =>
      join.onRef('eip_t_schedule.schedule_id', '=', 'eip_t_whatsnew.entity_id')
    )
    // user_id が null のレコードは INNER JOIN で除外（データ不整合対策）
    .innerJoin('turbine_user', (join) =>
      join.onRef('turbine_user.user_id', '=', 'eip_t_whatsnew.user_id')
    )
    .select([
      'eip_t_whatsnew.whatsnew_id',
      'eip_t_whatsnew.portlet_type',
      'eip_t_whatsnew.entity_id',
      'eip_t_whatsnew.create_date',
      'eip_t_whatsnew.update_date',
      'eip_t_whatsnew.user_id as updater_user_id',
      // スケジュール削除済みの場合は null になる
      'eip_t_schedule.name as schedule_name',
      sql<string>`turbine_user.last_name || ' ' || turbine_user.first_name`.as('updater_name'),
      // アイコン表示用に苗字の先頭1文字を取得
      sql<string>`LEFT(turbine_user.last_name, 1)`.as('updater_initial'),
    ])
    .where('eip_t_whatsnew.parent_id', '=', PARENT_ID_PUBLIC)
    .where('eip_t_whatsnew.portlet_type', '=', PORTLET_TYPE_SCHEDULE)
    .orderBy('eip_t_whatsnew.update_date', 'desc')
    .limit(WHATSNEW_LIMIT)
    .execute()

  return rows.map((row) => {
    const updateDate = row.update_date ? new Date(row.update_date) : new Date()
    const createDate = row.create_date ? new Date(row.create_date) : null

    // create_date と update_date の差が 5 秒未満なら「追加」と判定する。
    // AIPO は create 時に create_date=update_date=now で書き込み、
    // 以降の更新では update_date のみを更新する仕様（WhatsNewUtils.java 参照）。
    const isNew = createDate !== null && Math.abs(updateDate.getTime() - createDate.getTime()) < 5000

    return {
      whatsnewId: row.whatsnew_id,
      portletType: row.portlet_type ?? PORTLET_TYPE_SCHEDULE,
      entityId: row.entity_id ?? 0,
      scheduleName: row.schedule_name ?? null,
      updaterName: row.updater_name,
      updaterInitial: row.updater_initial ?? '?',
      updaterUserId: row.updater_user_id ?? 0,
      updateDate,
      isNew,
    }
  })
}
