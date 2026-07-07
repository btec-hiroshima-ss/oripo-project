import { createHash } from 'crypto'
import { db } from './db'

export function hashPassword(password: string): string {
  return createHash('sha1').update(password).digest('base64')
}

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
