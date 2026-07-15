// クライアントコンポーネントから安全にインポートできる純粋関数のみ置く（DB依存なし）
import type { UserListUser } from './user-list.types'

// 8色パレット: userId を剰余でマッピングし、同一ユーザーは常に同じ色になる
const ICON_COLORS = [
  'bg-red-400',
  'bg-orange-400',
  'bg-amber-400',
  'bg-green-500',
  'bg-teal-500',
  'bg-blue-500',
  'bg-indigo-400',
  'bg-purple-400',
] as const

export type IconColor = (typeof ICON_COLORS)[number]

export function getIconColor(userId: number): IconColor {
  return ICON_COLORS[userId % ICON_COLORS.length]
}

// キーワードで氏名を絞り込む（全角スペース対応）
export function filterUsers(users: UserListUser[], keyword: string): UserListUser[] {
  const trimmed = keyword.trim()
  if (!trimmed) return users
  // 全角スペースも区切り文字として扱い、スペースを除去して氏名に含まれるか判定
  const normalized = trimmed.replace(/\s+/g, '')
  return users.filter((u) => u.fullName.replace(/\s+/g, '').includes(normalized))
}
