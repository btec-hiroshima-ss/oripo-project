// 個人設定のユーザー情報パネル・編集モーダルで扱うログインユーザー自身のプロフィール。
// 他ユーザーの名簿用（user-list.types.ts の UserListDetail）とは用途が異なり、
// 姓・名を分離して保持し、ログイン名・権限・役職を持つ。
export type UserProfile = {
  userId: number
  loginName: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  cellularPhone: string | null
  departments: string[]
  // 役職。現行 DB には紐付けデータがないため通常は null（specs/user-info.md の仕様確認事項2参照）
  position: string | null
  isAdmin: boolean
}

// 編集モーダルから送信される入力値。パスワードは変更時のみ値が入る。
export type UserProfileInput = {
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  cellularPhone: string
  password: string
  passwordConfirm: string
}
