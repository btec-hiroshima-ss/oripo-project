import { createHash } from 'crypto'
import { db } from './db'

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
