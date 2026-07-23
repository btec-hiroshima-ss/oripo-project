import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { UserProfileInput } from '@/lib/user.types'

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/user', () => ({
  updateUserProfile: vi.fn(),
  // バリデーション本体は user.utils.test.ts で検証済みのため、ここでは通過/失敗を切り替えるだけ
  validateProfileInput: vi.fn(() => null),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { updateUserProfileAction } from './actions'
import * as authLib from '@/lib/auth'
import * as userLib from '@/lib/user'

const input: UserProfileInput = {
  lastName: '田中',
  firstName: '美咲',
  lastNameKana: 'タナカ',
  firstNameKana: 'ミサキ',
  cellularPhone: '09012345678',
  password: 'pass1234',
  passwordConfirm: 'pass1234',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(authLib.requireAuth).mockResolvedValue({ userId: 42, loginName: 'm.tanaka' })
  vi.mocked(userLib.validateProfileInput).mockReturnValue(null)
})

describe('updateUserProfileAction', () => {
  it('正しい入力でプロフィールを更新する', async () => {
    const result = await updateUserProfileAction(input)

    expect(result).toEqual({ ok: true })
    expect(userLib.updateUserProfile).toHaveBeenCalledWith(42, input)
  })

  // 他人のプロフィールを書き換えられないよう、更新対象はセッションのユーザーに固定される
  it('更新対象のユーザーIDはセッションから取得する', async () => {
    vi.mocked(authLib.requireAuth).mockResolvedValue({ userId: 7, loginName: 'other' })

    await updateUserProfileAction(input)

    expect(userLib.updateUserProfile).toHaveBeenCalledWith(7, input)
  })

  it('未認証の場合は例外を投げ更新しない', async () => {
    vi.mocked(authLib.requireAuth).mockRejectedValue(new Error('Unauthorized'))

    await expect(updateUserProfileAction(input)).rejects.toThrow('Unauthorized')
    expect(userLib.updateUserProfile).not.toHaveBeenCalled()
  })

  it('バリデーションエラーの場合は更新せずエラーを返す', async () => {
    vi.mocked(userLib.validateProfileInput).mockReturnValue('パスワードが一致しません')

    const result = await updateUserProfileAction(input)

    expect(result).toEqual({ ok: false, error: 'パスワードが一致しません' })
    expect(userLib.updateUserProfile).not.toHaveBeenCalled()
  })
})
