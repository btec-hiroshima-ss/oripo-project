'use client'

type ConfirmDialogProps = {
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** confirmLabel のボタン色。デフォルトは red（削除用途想定） */
  variant?: 'red' | 'brand'
  onConfirm: () => void
  onCancel: () => void
}

/** 汎用確認ダイアログ。削除・上書きなど破壊的操作の前に使用する。 */
export default function ConfirmDialog({
  message,
  confirmLabel = '実行する',
  cancelLabel = 'キャンセル',
  variant = 'red',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmColor =
    variant === 'red'
      ? 'bg-red-500 hover:bg-red-600'
      : 'bg-brand hover:bg-brand-dark'

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-xs p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-gray-800 mb-4">{message}</p>
        <div className="flex gap-2">
          <button
            className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium text-white rounded-lg ${confirmColor}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
