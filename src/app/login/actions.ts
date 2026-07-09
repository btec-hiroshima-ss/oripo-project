'use server'

import { redirect } from 'next/navigation'
import {
  getSession,
  isLockedOut,
  recordLoginFailure,
  resetLoginFailures,
} from '@/lib/auth'
import { getUserByLoginName, hashPassword, updateLastLogin } from '@/lib/user'

type LoginResult =
  | { ok: true }
  | { ok: false; error: 'invalid_credentials' | 'account_disabled' | 'locked_out' }

export async function login(loginName: string, password: string): Promise<LoginResult> {
  if (isLockedOut(loginName)) {
    return { ok: false, error: 'locked_out' }
  }

  const user = await getUserByLoginName(loginName)

  if (!user || user.password_value !== hashPassword(password)) {
    recordLoginFailure(loginName)
    return { ok: false, error: 'invalid_credentials' }
  }

  if (user.disabled === 'T') {
    return { ok: false, error: 'account_disabled' }
  }

  const session = await getSession()
  session.userId = user.user_id
  session.loginName = user.login_name
  await session.save()

  await updateLastLogin(user.user_id)
  resetLoginFailures(loginName)

  return { ok: true }
}

export async function logout(): Promise<void> {
  const session = await getSession()
  session.destroy()
  redirect('/login')
}
