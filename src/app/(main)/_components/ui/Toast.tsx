'use client'

type ToastProps = {
  message: string | null
}

/** 画面下部に表示するスナックバー型トースト。message が null のとき非表示。 */
export default function Toast({ message }: ToastProps) {
  if (!message) return null
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-gray-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg pointer-events-none">
      {message}
    </div>
  )
}
