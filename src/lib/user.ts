import { createHash } from 'crypto'
import { db } from './db'
import type { UserProfile, UserProfileInput } from './user.types'

export type { UserProfile, UserProfileInput }
// 純粋関数は user.utils.ts に分離している（Client Component から DB を引き込まないため）
export { validateProfileInput } from './user.utils'

// AIPO の管理者ロール名。turbine_user_group_role 経由で付与される
const ADMIN_ROLE_NAME = 'admin'

// AIPO 互換のパスワードハッシュ（SHA-1 + Base64）
// 注意: SHA-1 は現代のセキュリティ基準では推奨されないが、
// AIPO の既存ユーザーがそのままログインできるようにするため意図的に使用している。
// 将来的にパスワードリセット機能を実装する際は bcrypt への移行を検討すること。
export function hashPassword(password: string): string {
  return createHash('sha1').update(password).digest('base64')
}

// turbine_user は AIPO のユーザーテーブル（Oripo 独自ではない）
// 認証に必要な最小限のカラムだけ SELECT する
export async function getUserByLoginName(loginName: string) {
  return db
    .selectFrom('turbine_user')
    .select(['user_id', 'login_name', 'password_value', 'disabled'])
    .where('login_name', '=', loginName)
    .executeTakeFirst()
}

export async function updateLastLogin(userId: number): Promise<void> {
  await db
    .updateTable('turbine_user')
    .set({ last_login: new Date() })
    .where('user_id', '=', userId)
    .execute()
}

// 個人設定のユーザー情報パネル用。ログインユーザー自身のプロフィールを取得する。
// user-list.ts の getUserDetail は氏名を SQL 側で連結しており姓・名を分離できず、
// ログイン名・権限・役職も持たないため、個人設定では本関数を使う。
export async function getUserProfile(userId: number): Promise<UserProfile | null> {
  const userRow = await db
    .selectFrom('turbine_user')
    // 役職は turbine_user.position_id → eip_m_position の参照だが、
    // 現行データは全ユーザー position_id=0 でマスタに該当せず常に null になる
    // （specs/user-info.md の仕様確認事項2を参照）
    .leftJoin('eip_m_position', 'eip_m_position.position_id', 'turbine_user.position_id')
    .select([
      'turbine_user.user_id',
      'turbine_user.login_name',
      'turbine_user.last_name',
      'turbine_user.first_name',
      'turbine_user.last_name_kana',
      'turbine_user.first_name_kana',
      'turbine_user.cellular_phone',
      'eip_m_position.position_name',
    ])
    .where('turbine_user.user_id', '=', userId)
    .executeTakeFirst()

  if (!userRow) return null

  const [deptRows, adminRow] = await Promise.all([
    // 部署は複数所属があるため別クエリで取得する（JOIN すると行が増えるため）。
    // 同一グループに複数ロールが紐付くと部署名が重複するため distinct する
    db
      .selectFrom('turbine_user_group_role')
      .innerJoin('turbine_group', 'turbine_group.group_id', 'turbine_user_group_role.group_id')
      .innerJoin('eip_m_post', 'eip_m_post.group_name', 'turbine_group.group_name')
      .select(['eip_m_post.post_name', 'eip_m_post.post_id'])
      .distinct()
      .where('turbine_user_group_role.user_id', '=', userId)
      .orderBy('eip_m_post.post_id', 'asc')
      .execute(),

    // 管理者判定: admin ロールが1件でも紐付いていれば管理者
    db
      .selectFrom('turbine_user_group_role')
      .innerJoin('turbine_role', 'turbine_role.role_id', 'turbine_user_group_role.role_id')
      .select('turbine_role.role_id')
      .where('turbine_user_group_role.user_id', '=', userId)
      .where('turbine_role.role_name', '=', ADMIN_ROLE_NAME)
      .limit(1)
      .executeTakeFirst(),
  ])

  return {
    userId: userRow.user_id,
    loginName: userRow.login_name,
    lastName: userRow.last_name,
    firstName: userRow.first_name,
    lastNameKana: userRow.last_name_kana ?? '',
    firstNameKana: userRow.first_name_kana ?? '',
    cellularPhone: userRow.cellular_phone ?? null,
    departments: deptRows.map((r) => r.post_name),
    position: userRow.position_name ?? null,
    isAdmin: Boolean(adminRow),
  }
}

// 個人設定の編集モーダルからプロフィールを更新する。
// 部署・権限は対象外（管理者のユーザー管理画面で変更する。specs/user-info.md の仕様確認事項1参照）。
export async function updateUserProfile(userId: number, input: UserProfileInput): Promise<void> {
  const now = new Date()
  await db
    .updateTable('turbine_user')
    .set({
      last_name: input.lastName.trim(),
      first_name: input.firstName.trim(),
      last_name_kana: input.lastNameKana.trim(),
      first_name_kana: input.firstNameKana.trim(),
      // 未入力は null にする（空文字を入れると AIPO 側で「登録済み」と誤認されるため）
      cellular_phone: input.cellularPhone.trim() || null,
      password_value: hashPassword(input.password),
      password_changed: now,
      // AIPO 互換のため更新日時・更新者も記録する
      modified: now,
      updated_user_id: userId,
    })
    .where('user_id', '=', userId)
    .execute()
}
