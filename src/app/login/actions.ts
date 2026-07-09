'use server'

import { redirect } from 'next/navigation'
import {
  getSession,
  isLockedOut,
  recordLoginFailure,
  resetLoginFailures,
} from '@/lib/auth'
import { getUserByLoginName, hashPassword, updateLastLogin } from '@/lib/user'
import { logger } from '@/lib/logger'

type LoginResult =
  | { ok: true }
  | { ok: false; error: 'invalid_credentials' | 'account_disabled' | 'locked_out' }

export async function login(loginName: string, password: string): Promise<LoginResult> {
  if (isLockedOut(loginName)) {
    logger.warn({ event: 'auth.login.locked_out', loginName }, 'ログイン失敗: ロックアウト中')
    return { ok: false, error: 'locked_out' }
  }

  const user = await getUserByLoginName(loginName)

  if (!user || user.password_value !== hashPassword(password)) {
    recordLoginFailure(loginName)
    logger.warn({ event: 'auth.login.failure', loginName }, 'ログイン失敗: 認証情報不一致')
    return { ok: false, error: 'invalid_credentials' }
  }

  if (user.disabled === 'T') {
    logger.warn({ event: 'auth.login.disabled', loginName }, 'ログイン失敗: 無効アカウント')
    return { ok: false, error: 'account_disabled' }
  }

  const session = await getSession()
  session.userId = user.user_id
  session.loginName = user.login_name
  await session.save()

  await updateLastLogin(user.user_id)
  resetLoginFailures(loginName)

  logger.info({ event: 'auth.login.success', loginName, userId: user.user_id }, 'ログイン成功')
  return { ok: true }
}

export async function logout(): Promise<void> {
  const session = await getSession()
  const { loginName, userId } = session
  session.destroy()
  logger.info({ event: 'auth.logout', loginName, userId }, 'ログアウト')
  redirect('/login')
}
