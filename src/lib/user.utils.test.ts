import { describe, it, expect } from 'vitest'
import { validateProfileInput } from './user.utils'
import type { UserProfileInput } from './user.types'

// 全項目が正しく埋まった入力。各テストで一部だけ上書きして使う
function makeInput(overrides: Partial<UserProfileInput> = {}): UserProfileInput {
  return {
    lastName: '田中',
    firstName: '美咲',
    lastNameKana: 'タナカ',
    firstNameKana: 'ミサキ',
    cellularPhone: '09012345678',
    password: 'pass1234',
    passwordConfirm: 'pass1234',
    ...overrides,
  }
}

describe('validateProfileInput', () => {
  it('正しい入力はエラーにならない', () => {
    expect(validateProfileInput(makeInput())).toBeNull()
  })

  it('携帯電話番号は未入力でもエラーにならない', () => {
    expect(validateProfileInput(makeInput({ cellularPhone: '' }))).toBeNull()
  })

  describe('必須項目', () => {
    const cases: { key: keyof UserProfileInput; label: string }[] = [
      { key: 'lastName', label: '姓' },
      { key: 'firstName', label: '名' },
      { key: 'lastNameKana', label: '姓（フリガナ）' },
      { key: 'firstNameKana', label: '名（フリガナ）' },
      { key: 'password', label: 'パスワード' },
      { key: 'passwordConfirm', label: 'パスワード（確認用）' },
    ]

    for (const { key, label } of cases) {
      it(`${label}が未入力ならエラーになる`, () => {
        expect(validateProfileInput(makeInput({ [key]: '' }))).toBe(`${label}を入力してください`)
      })
    }

    it('空白のみの入力は未入力として扱う', () => {
      expect(validateProfileInput(makeInput({ lastName: '   ' }))).toBe('姓を入力してください')
    })
  })

  describe('パスワード', () => {
    it('8文字未満はエラーになる', () => {
      const input = makeInput({ password: 'pass123', passwordConfirm: 'pass123' })
      expect(validateProfileInput(input)).toBe('パスワードは8文字以上で入力してください')
    })

    it('ちょうど8文字は許可される', () => {
      const input = makeInput({ password: 'pass1234', passwordConfirm: 'pass1234' })
      expect(validateProfileInput(input)).toBeNull()
    })

    it('50文字を超えるとエラーになる', () => {
      const long = 'a'.repeat(51)
      const input = makeInput({ password: long, passwordConfirm: long })
      expect(validateProfileInput(input)).toBe('パスワードは50文字以内で入力してください')
    })

    it('ちょうど50文字は許可される', () => {
      const long = 'a'.repeat(50)
      const input = makeInput({ password: long, passwordConfirm: long })
      expect(validateProfileInput(input)).toBeNull()
    })

    // ログイン画面が半角英数のみを受け付けるため、ここで弾かないとログインできなくなる
    it('半角英数以外を含むとエラーになる', () => {
      const input = makeInput({ password: 'pass_1234', passwordConfirm: 'pass_1234' })
      expect(validateProfileInput(input)).toBe('パスワードは半角英数で入力してください')
    })

    it('全角文字を含むとエラーになる', () => {
      const input = makeInput({ password: 'パスワード1234', passwordConfirm: 'パスワード1234' })
      expect(validateProfileInput(input)).toBe('パスワードは半角英数で入力してください')
    })

    it('確認用と一致しないとエラーになる', () => {
      const input = makeInput({ password: 'pass1234', passwordConfirm: 'pass5678' })
      expect(validateProfileInput(input)).toBe('パスワードが一致しません')
    })
  })
})
