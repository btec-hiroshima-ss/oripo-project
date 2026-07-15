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
  // 単純な剰余だと user_id が飛び番（例: 66, 86, 166...）のとき特定の色に偏る。
  // Knuth の乗算ハッシュで分布を均一にする（>>> 0 で符号なし32bit整数に変換）。
  const hash = Math.imul(userId, 2654435761) >>> 0
  return ICON_COLORS[hash % ICON_COLORS.length]
}

// キーワードで氏名・氏名カナを絞り込む（全角スペース・ひらがな→カタカナ変換対応）
// AIPO 準拠: 漢字・カナ・ひらがなで検索できること
export function filterUsers(users: UserListUser[], keyword: string): UserListUser[] {
  const trimmed = keyword.trim()
  if (!trimmed) return users
  // 全角スペースを除去してスペースなし文字列として比較
  const normalized = trimmed.replace(/\s+/g, '')
  // ひらがな → カタカナ変換（AIPOはひらがな入力でもカナ氏名にヒットさせる）
  const katakana = normalized.replace(/[ぁ-ゖ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) + 0x60)
  )
  return users.filter((u) => {
    const name = (u.fullName ?? '').replace(/\s+/g, '')
    // fullNameKana は DB の kana カラムが null のユーザーがいるため null ガードを入れる
    const kana = (u.fullNameKana ?? '').replace(/\s+/g, '')
    return name.includes(normalized) || kana.includes(normalized) || kana.includes(katakana)
  })
}
