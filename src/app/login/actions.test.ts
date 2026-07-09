import { describe, it, expect, vi, beforeEach } from 'vitest'
import { login } from './actions'

vi.mock('@/lib/user', () => ({
  getUserByLoginName: vi.fn(),
  hashPassword: vi.fn((p: string) => `hashed:${p}`),
  updateLastLogin: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
  isLockedOut: vi.fn(() => false),
  recordLoginFailure: vi.fn(),
  resetLoginFailures: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

import * as userLib from '@/lib/user'
import * as authLib from '@/lib/auth'

const mockSession = { userId: 0, loginName: '', save: vi.fn(), destroy: vi.fn() }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(authLib.getSession).mockResolvedValue(mockSession as never)
})

describe('login', () => {
  it('正しい認証情報でログイン成功する', async () => {
    vi.mocked(userLib.getUserByLoginName).mockResolvedValue({
      user_id: 1,
      login_name: 'tanaka',
      password_value: 'hashed:pass123',
      disabled: null,
    } as never)

    const result = await login('tanaka', 'pass123')

    expect(result).toEqual({ ok: true })
    expect(mockSession.save).toHaveBeenCalled()
    expect(userLib.updateLastLogin).toHaveBeenCalledWith(1)
    expect(authLib.resetLoginFailures).toHaveBeenCalledWith('tanaka')
  })

  it('存在しないユーザーは認証失敗する', async () => {
    vi.mocked(userLib.getUserByLoginName).mockResolvedValue(undefined)

    const result = await login('unknown', 'pass')

    expect(result).toEqual({ ok: false, error: 'invalid_credentials' })
    expect(authLib.recordLoginFailure).toHaveBeenCalledWith('unknown')
  })

  it('パスワード不一致は認証失敗する', async () => {
    vi.mocked(userLib.getUserByLoginName).mockResolvedValue({
      user_id: 1,
      login_name: 'tanaka',
      password_value: 'hashed:correct',
      disabled: null,
    } as never)

    const result = await login('tanaka', 'wrong')

    expect(result).toEqual({ ok: false, error: 'invalid_credentials' })
    expect(authLib.recordLoginFailure).toHaveBeenCalledWith('tanaka')
  })

  it('無効アカウントは account_disabled を返す', async () => {
    vi.mocked(userLib.getUserByLoginName).mockResolvedValue({
      user_id: 2,
      login_name: 'disabled_user',
      password_value: 'hashed:pass',
      disabled: 'T',
    } as never)

    const result = await login('disabled_user', 'pass')

    expect(result).toEqual({ ok: false, error: 'account_disabled' })
    expect(mockSession.save).not.toHaveBeenCalled()
  })

  it('ロックアウト中は locked_out を返す', async () => {
    vi.mocked(authLib.isLockedOut).mockReturnValue(true)

    const result = await login('tanaka', 'pass')

    expect(result).toEqual({ ok: false, error: 'locked_out' })
    expect(userLib.getUserByLoginName).not.toHaveBeenCalled()
  })
})
