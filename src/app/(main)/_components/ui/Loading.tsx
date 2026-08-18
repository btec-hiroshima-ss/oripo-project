'use client'

import { Loader2 } from 'lucide-react'

type LoadingProps = {
  /** 表示テキスト。省略時は「読み込み中...」 */
  label?: string
  /**
   * レイアウト種別
   * - block: 中央揃えブロック（デフォルト）
   * - inline: インラインスパン（テキストのみ、スピナーなし）
   * - list-item: リスト内のローディング行（li要素、スピナーあり）
   */
  variant?: 'block' | 'inline' | 'list-item'
}

/** ローディング中表示。isLoading フラグが true のときだけ表示する想定で使用する。 */
export default function Loading({ label = '読み込み中...', variant = 'block' }: LoadingProps) {
  if (variant === 'inline') {
    return <span className="text-xs text-gray-400">{label}</span>
  }
  if (variant === 'list-item') {
    return (
      <li className="flex items-center justify-center py-4 gap-1 text-xs text-gray-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        {label}
      </li>
    )
  }
  return (
    <div className="flex items-center justify-center gap-1 px-3 py-4 text-xs text-gray-400">
      <Loader2 className="w-3 h-3 animate-spin" />
      {label}
    </div>
  )
}
