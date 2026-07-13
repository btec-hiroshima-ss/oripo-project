import { createHash } from 'crypto'
import { db } from './db'

export type UserProfile = {
  loginName: string
  fullName: string
  fullNameKana: string | null
  postNames: string[]  // 所属部署リスト（複数所属あり）
  isAdmin: boolean
}

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

// 個人設定のユーザー情報表示に必要なプロフィールを取得する。
// 部署は turbine_user_group_role → turbine_group → eip_m_post の3テーブルJOIN。
// ロールは turbine_user_group_role → turbine_role で取得し、Admin を含む名前を管理者と判定する。
export async function getUserProfile(userId: number): Promise<UserProfile | null> {
  const user = await db
    .selectFrom('turbine_user')
    .select(['login_name', 'last_name', 'first_name', 'last_name_kana', 'first_name_kana'])
    .where('user_id', '=', userId)
    .executeTakeFirst()

  if (!user) return null

  const [posts, roles] = await Promise.all([
    db
      .selectFrom('turbine_user_group_role')
      .innerJoin('turbine_group', 'turbine_group.group_id', 'turbine_user_group_role.group_id')
      // eip_m_post.group_name は nullable だが、turbine_group.group_name との文字列一致でJOINする
      .innerJoin('eip_m_post', 'eip_m_post.group_name' as any, 'turbine_group.group_name')
      .select('eip_m_post.post_name')
      .where('turbine_user_group_role.user_id', '=', userId)
      .execute(),
    db
      .selectFrom('turbine_user_group_role')
      .innerJoin('turbine_role', 'turbine_role.role_id', 'turbine_user_group_role.role_id')
      .select('turbine_role.role_name')
      .where('turbine_user_group_role.user_id', '=', userId)
      .execute(),
  ])

  const isAdmin = roles.some((r) => r.role_name.toLowerCase().includes('admin'))
  const uniquePostNames = [...new Set(posts.map((p) => p.post_name))]

  return {
    loginName: user.login_name,
    fullName: `${user.last_name} ${user.first_name}`,
    fullNameKana:
      user.last_name_kana && user.first_name_kana
        ? `${user.last_name_kana} ${user.first_name_kana}`
        : null,
    postNames: uniquePostNames,
    isAdmin,
  }
}

export async function updateLastLogin(userId: number): Promise<void> {
  await db
    .updateTable('turbine_user')
    .set({ last_login: new Date() })
    .where('user_id', '=', userId)
    .execute()
}
