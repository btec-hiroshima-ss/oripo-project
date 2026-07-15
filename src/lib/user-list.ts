import { sql } from 'kysely'
import { db } from './db'
import type { UserListUser, UserListDetail } from './user-list.types'

export type { UserListUser, UserListDetail }
// 純粋関数は user-list.utils.ts に分離している（Client Component から DB を引き込まないため）
export { getIconColor, filterUsers } from './user-list.utils'
export type { IconColor } from './user-list.utils'

// 社内ユーザー数の想定上限（200名）に余裕を持たせた値。
// JOINで行が増えるため、実ユーザー数より大きい値にする。
const MAX_USER_ROWS = 5000

// ユーザー + 部署の取得。
// JOIN パス: turbine_user → turbine_user_group_role → turbine_group → eip_m_post
// 1ユーザーが複数グループに所属するため、JS 側で user_id ごとに最初の行だけ残す（部署ありを優先）。
export async function getUserList(): Promise<UserListUser[]> {
  const rows = await db
    .selectFrom('turbine_user')
    .leftJoin(
      'turbine_user_group_role',
      'turbine_user_group_role.user_id',
      'turbine_user.user_id'
    )
    .leftJoin(
      'turbine_group',
      'turbine_group.group_id',
      'turbine_user_group_role.group_id'
    )
    .leftJoin('eip_m_post', 'eip_m_post.group_name', 'turbine_group.group_name')
    .select([
      'turbine_user.user_id',
      sql<string>`turbine_user.last_name || ' ' || turbine_user.first_name`.as('full_name'),
      sql<string>`COALESCE(turbine_user.last_name_kana, '') || ' ' || COALESCE(turbine_user.first_name_kana, '')`.as(
        'full_name_kana'
      ),
      'eip_m_post.post_name',
      'eip_m_post.post_id',
      'turbine_user.cellular_phone',
    ])
    // AIPO の disabled フラグは 'T'=無効 / 'F'=有効（ログイン処理と同じ判定）
    .where('turbine_user.disabled', '!=', 'T')
    // 部署あり（post_id が小さい = 先頭）を優先するための並び順。
    // この時点では user_id の重複を含む。
    .orderBy('eip_m_post.post_id', 'asc')
    .limit(MAX_USER_ROWS)
    .execute()

  // user_id 単位で重複を除去し、最初に現れた行（= 部署ありを優先）を採用する
  const seen = new Map<number, UserListUser>()
  for (const row of rows) {
    if (!seen.has(row.user_id)) {
      seen.set(row.user_id, {
        userId: row.user_id,
        fullName: row.full_name,
        fullNameKana: row.full_name_kana,
        department: row.post_name ?? null,
        cellularPhone: row.cellular_phone ?? null,
      })
    }
  }

  // カナ昇順でソートして返す
  return Array.from(seen.values()).sort((a, b) =>
    (a.fullNameKana ?? '').localeCompare(b.fullNameKana ?? '', 'ja')
  )
}

// ユーザー詳細を取得する。
// 部署は複数所属対応のため配列で返す。役職は eip_m_user_position → eip_m_position JOIN。
export async function getUserDetail(userId: number): Promise<UserListDetail | null> {
  // 基本情報 + 役職（1行になる想定）
  const userRow = await db
    .selectFrom('turbine_user')
    .leftJoin(
      'eip_m_user_position',
      'eip_m_user_position.user_id',
      'turbine_user.user_id'
    )
    .leftJoin(
      'eip_m_position',
      'eip_m_position.position_id',
      'eip_m_user_position.position'
    )
    .select([
      'turbine_user.user_id',
      sql<string>`turbine_user.last_name || ' ' || turbine_user.first_name`.as('full_name'),
      sql<string>`COALESCE(turbine_user.last_name_kana, '') || ' ' || COALESCE(turbine_user.first_name_kana, '')`.as('full_name_kana'),
      'turbine_user.email',
      'turbine_user.out_telephone',
      'turbine_user.in_telephone',
      'turbine_user.cellular_phone',
      'eip_m_position.position_name',
    ])
    .where('turbine_user.user_id', '=', userId)
    .executeTakeFirst()

  if (!userRow) return null

  // 部署は複数所属があるため別クエリで取得
  const deptRows = await db
    .selectFrom('turbine_user_group_role')
    .innerJoin(
      'turbine_group',
      'turbine_group.group_id',
      'turbine_user_group_role.group_id'
    )
    .innerJoin('eip_m_post', 'eip_m_post.group_name', 'turbine_group.group_name')
    .select('eip_m_post.post_name')
    .where('turbine_user_group_role.user_id', '=', userId)
    .orderBy('eip_m_post.post_id', 'asc')
    .execute()

  return {
    userId: userRow.user_id,
    fullName: userRow.full_name,
    fullNameKana: userRow.full_name_kana,
    departments: deptRows.map((r) => r.post_name),
    position: userRow.position_name ?? null,
    email: userRow.email ?? null,
    outTelephone: userRow.out_telephone ?? null,
    inTelephone: userRow.in_telephone ?? null,
    cellularPhone: userRow.cellular_phone ?? null,
  }
}
