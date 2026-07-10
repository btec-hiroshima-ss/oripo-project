import { describe, it, expect } from 'vitest'
import { hashPassword } from './user'

// AIPO との互換性テスト
// hashPassword の実装を変えると既存ユーザーがログインできなくなるため、期待値は絶対に変えないこと
describe('hashPassword', () => {
  it('SHA-1+Base64でハッシュ化する', () => {
    // echo -n "password" | openssl sha1 -binary | base64 → W6ph5Mm5Pz8GgiULbPgzG37mj9g=
    expect(hashPassword('password')).toBe('W6ph5Mm5Pz8GgiULbPgzG37mj9g=')
  })

  it('大文字小文字を区別する', () => {
    expect(hashPassword('Password')).not.toBe(hashPassword('password'))
  })

  it('空文字列もハッシュ化できる', () => {
    expect(hashPassword('')).toBe('2jmj7l5rSw0yVb/vlWAYkK/YBwk=')
  })
})
