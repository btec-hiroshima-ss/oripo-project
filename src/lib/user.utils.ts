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

// テキスト項目の最大長。turbine_user の各カラムの桁数に合わせている。
// ここで弾かないと Postgres 側で "value too long" 例外になり保存に失敗する。
export const NAME_MAX_LENGTH = 99 // last_name / first_name / *_kana は varchar(99)
export const CELLULAR_PHONE_MAX_LENGTH = 15 // cellular_phone は varchar(15)

const LENGTH_LIMITED_FIELDS: { key: keyof UserProfileInput; label: string; max: number }[] = [
  { key: 'lastName', label: '姓', max: NAME_MAX_LENGTH },
  { key: 'firstName', label: '名', max: NAME_MAX_LENGTH },
  { key: 'lastNameKana', label: '姓（フリガナ）', max: NAME_MAX_LENGTH },
  { key: 'firstNameKana', label: '名（フリガナ）', max: NAME_MAX_LENGTH },
  { key: 'cellularPhone', label: '携帯電話番号', max: CELLULAR_PHONE_MAX_LENGTH },
]

// 編集モーダルの入力値を検証し、最初に見つかったエラーメッセージを返す（問題なければ null）。
// DB に依存しない純粋関数にしているのは、Server Action から呼びつつ
// Client Component 側に DB モジュールを引き込まないため（user-list.utils.ts と同じ方針）。
export function validateProfileInput(input: UserProfileInput): string | null {
  for (const { key, label } of REQUIRED_FIELDS) {
    if (!input[key].trim()) return `${label}を入力してください`
  }

  for (const { key, label, max } of LENGTH_LIMITED_FIELDS) {
    if (input[key].trim().length > max) return `${label}は${max}文字以内で入力してください`
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
