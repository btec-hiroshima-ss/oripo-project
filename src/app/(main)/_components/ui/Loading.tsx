'use client'

type LoadingProps = {
  /** 表示テキスト。省略時は「読み込み中...」 */
  label?: string
  /** レイアウト種別。block=ブロック全体占有（デフォルト）、inline=インライン */
  variant?: 'block' | 'inline'
}

/** ローディング中テキスト表示。isLoading フラグが true のときだけ表示する想定で使用する。 */
export default function Loading({ label = '読み込み中...', variant = 'block' }: LoadingProps) {
  if (variant === 'inline') {
    return <span className="text-xs text-gray-400">{label}</span>
  }
  return (
    <div className="px-3 py-2 text-xs text-gray-400 text-center border-t border-gray-100">
      {label}
    </div>
  )
}
