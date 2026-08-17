'use client'

import { X } from 'lucide-react'

// 左右パネルの操作パターンは設備/ユーザーで異なるため（設備: 単一クリック即追加、ユーザー: ハイライト→まとめて追加）
// モーダルシェル（ヘッダー・2カラムコンテナ・フッター）のみを共通化し、パネル内容はレンダープロップで提供する。
type Props = {
  title: string
  renderLeftPanel: () => React.ReactNode
  renderRightPanel: () => React.ReactNode
  /** フッターの「決定」ボタン押下コールバック（確定処理は各ピッカーが実装） */
  onConfirm: () => void
  onClose: () => void
}

export default function TwoColumnPickerModal({
  title,
  renderLeftPanel,
  renderRightPanel,
  onConfirm,
  onClose,
}: Props) {
  return (
    <div
      // z-[60]: ScheduleFormModal の z-50 より前面に出るため。FacilityPickerModal が元から z-[60] を使用しており統一した。
      className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <span className="font-semibold text-gray-800">{title}</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded p-0.5"
            aria-label="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2カラムコンテナ（左: 選択済み / 右: 候補） */}
        <div className="flex flex-col sm:flex-row gap-4 px-5 py-4 overflow-hidden flex-1 min-h-0">
          <div className="flex flex-col sm:flex-1 min-h-0">
            {renderLeftPanel()}
          </div>
          <div className="flex flex-col sm:flex-1 min-h-0">
            {renderRightPanel()}
          </div>
        </div>

        {/* フッター */}
        <div className="px-5 pb-5 flex gap-2 justify-end shrink-0 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-dark"
          >
            決定
          </button>
        </div>
      </div>
    </div>
  )
}
