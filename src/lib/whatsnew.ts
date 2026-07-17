import { sql } from 'kysely'
import { db } from './db'
import type { WhatsnewEntry } from './whatsnew.types'

// ウィジェットの表示件数上限（要件定義書 2.3: 最新 N 件）
const WHATSNEW_LIMIT = 20

// eip_t_whatsnew は Oripo 側のスケジュール書き込み実装（#81）が完了するまで空のため、
// 暫定として eip_t_schedule を直接参照して最新更新を表示する。
// update_user_id / create_user_id は migration で「不使用」コメントが付いているが
// カラム自体は残っており、AIPO が書き込んだ値が入っているため読み取りに使用できる。
export async function getWhatsnewList(): Promise<WhatsnewEntry[]> {
  const rows = await db
    .selectFrom('eip_t_schedule')
    // update_user_id が null の場合は owner_id にフォールバック
    .innerJoin('turbine_user', (join) =>
      join.on(
        sql<boolean>`turbine_user.user_id = COALESCE(eip_t_schedule.update_user_id, eip_t_schedule.owner_id)`
      )
    )
    .select([
      'eip_t_schedule.schedule_id',
      'eip_t_schedule.name as schedule_name',
      'eip_t_schedule.create_date',
      'eip_t_schedule.update_date',
      'turbine_user.user_id as updater_user_id',
      sql<string>`turbine_user.last_name || ' ' || turbine_user.first_name`.as('updater_name'),
      sql<string>`LEFT(turbine_user.last_name, 1)`.as('updater_initial'),
    ])
    .orderBy('eip_t_schedule.update_date', 'desc')
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
      whatsnewId: row.schedule_id,
      portletType: 6,
      entityId: row.schedule_id,
      scheduleName: row.schedule_name ?? null,
      updaterName: row.updater_name,
      updaterInitial: row.updater_initial ?? '?',
      updaterUserId: row.updater_user_id,
      updateDate,
      isNew,
    }
  })
}
