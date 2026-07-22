'use client'

import { getIconColor } from '@/lib/user-list.utils'

type Size = 'sm' | 'lg'

// サイズごとの Tailwind クラス。sm はヘッダー・名簿リスト、lg はユーザー詳細モーダル内で使う。
const SIZE_CLASSES: Record<Size, string> = {
  sm: 'w-7 h-7 text-xs',
  lg: 'w-12 h-12 text-xl',
}

type Props = {
  userId: number
  name: string
  size?: Size
  // onClick を渡すと role=button になりキーボードでも操作できる
  onClick?: () => void
}

// ユーザーIDに対応した色でイニシャルを表示する共通アバター。
// ヘッダー・ユーザー名簿ウィジェット・ユーザー詳細モーダルで共用する。
export default function InitialAvatar({ userId, name, size = 'sm', onClick }: Props) {
  const colorClass = getIconColor(userId)
  const initial = name.charAt(0)

  return (
    <span
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `${name}の詳細を表示` : undefined}
      aria-hidden={!onClick ? true : undefined}
      className={`${colorClass} ${SIZE_CLASSES[size]} rounded-full flex items-center justify-center shrink-0 text-white font-bold${onClick ? ' cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick() } : undefined}
    >
      {initial}
    </span>
  )
}
