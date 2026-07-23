import type { UserProfileInput } from './user.types'

// パスワードの制約。最小8文字は要件定義書 3.2 のパスワードポリシー、
// 最大50文字・半角英数のみは specs/login.md のログイン時バリデーション（AIPO 準拠）と揃えている。
// 揃えないとログインできないパスワードを設定できてしまう。
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 50
const PASSWORD_PATTERN = /^[A-Za-z0-9]+$/

// 必須項目の定義。エラーメッセージに使うラベルもここで持つ
const REQUIRED_FIELDS: { key: keyof UserProfileInput; label: string }[] = [
  { key: 'lastName', label: '姓' },
  { key: 'firstName', label: '名' },
  { key: 'lastNameKana', label: '姓（フリガナ）' },
  { key: 'firstNameKana', label: '名（フリガナ）' },
  { key: 'password', label: 'パスワード' },
  { key: 'passwordConfirm', label: 'パスワード（確認用）' },
]

// 編集モーダルの入力値を検証し、最初に見つかったエラーメッセージを返す（問題なければ null）。
// Server Action とクライアント側の両方から呼べるよう、DB に依存しない純粋関数にしている。
export function validateProfileInput(input: UserProfileInput): string | null {
  for (const { key, label } of REQUIRED_FIELDS) {
    if (!input[key].trim()) return `${label}を入力してください`
  }

  if (input.password.length < PASSWORD_MIN_LENGTH) {
    return `パスワードは${PASSWORD_MIN_LENGTH}文字以上で入力してください`
  }
  if (input.password.length > PASSWORD_MAX_LENGTH) {
    return `パスワードは${PASSWORD_MAX_LENGTH}文字以内で入力してください`
  }
  if (!PASSWORD_PATTERN.test(input.password)) {
    return 'パスワードは半角英数で入力してください'
  }
  if (input.password !== input.passwordConfirm) {
    return 'パスワードが一致しません'
  }

  return null
}
