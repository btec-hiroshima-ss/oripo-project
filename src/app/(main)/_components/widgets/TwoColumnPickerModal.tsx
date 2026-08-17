'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'

export type PickerItem = {
  id: number
  label: string
  /** 「使用中」等のバッジテキスト */
  badge?: string
  /** disabled=true のとき追加不可（immediate モードの追加ボタンを無効化） */
  disabled?: boolean
  /** locked=true のとき削除不可・ハイライット不可（自分自身など） */
  locked?: boolean
}

// 設備（シングルクリック即追加）とユーザー（ハイライット→まとめて追加）で操作パターンが異なるため
// selectionMode でモード分岐する。ハイライット状態はこのコンポーネント内で管理する。
type SelectionMode =
  | 'immediate' // 右パネルの各行に「追加」リンク、左パネルの各行に「削除」リンク
  | 'highlight' // 右パネルをクリックでハイライット→「追加」ボタン、左パネルも同様で「削除」ボタン

type Props = {
  title: string
  /** 左パネルのラベル */
  leftLabel: string
  /** 左パネルに表示する選択済みアイテム */
  selectedItems: PickerItem[]
  /** 右パネルに表示する候補アイテム */
  availableItems: PickerItem[]
  selectionMode: SelectionMode
  /** 追加コールバック: immediate は [id] の単要素配列、highlight はハイライット中の全 id 配列 */
  onAdd: (ids: number[]) => void
  /** 削除コールバック: immediate は [id] の単要素配列、highlight は左ハイライット中の全 id 配列 */
  onRemove: (ids: number[]) => void
  /** 左パネルヘッダー右端の追加コンテンツ（「N 人選択中」等） */
  leftHeaderExtra?: React.ReactNode
  /** 右パネル上部の検索インプット（指定時のみ表示） */
  searchValue?: string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string
  /** 右パネルのグループ絞り込みドロップダウン（指定時のみ表示） */
  filterOptions?: Array<{ value: string; label: string }>
  filterValue?: string
  onFilterChange?: (v: string) => void
  /** true のとき右パネルをローディング表示に切り替える */
  isLoading?: boolean
  onConfirm: () => void
  onClose: () => void
}

export default function TwoColumnPickerModal({
  title,
  leftLabel,
  selectedItems,
  availableItems,
  selectionMode,
  onAdd,
  onRemove,
  leftHeaderExtra,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filterOptions,
  filterValue,
  onFilterChange,
  isLoading,
  onConfirm,
  onClose,
}: Props) {
  const [leftHighlighted, setLeftHighlighted] = useState<Set<number>>(new Set())
  const [rightHighlighted, setRightHighlighted] = useState<Set<number>>(new Set())

  function toggleLeftHighlight(id: number, locked?: boolean) {
    if (locked) return
    setLeftHighlighted((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleRightHighlight(id: number) {
    setRightHighlighted((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleAddHighlighted() {
    onAdd(Array.from(rightHighlighted))
    setRightHighlighted(new Set())
  }

  function handleRemoveHighlighted() {
    onRemove(Array.from(leftHighlighted))
    setLeftHighlighted(new Set())
  }

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
          {/* 左パネル: 選択済み */}
          <div className="flex flex-col sm:flex-1 min-h-0 border-b sm:border-b-0 border-gray-200">
            <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 shrink-0 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">{leftLabel}</span>
              {leftHeaderExtra}
            </div>
            {/* max-h-[140px] sm:max-h-none: モバイル縦積みで画面を圧迫しないよう高さ制限 */}
            <ul className="flex-1 overflow-y-auto min-h-[80px] max-h-[140px] sm:max-h-none">
              {selectedItems.length === 0 ? (
                <li className="text-center py-4 text-xs text-gray-400">未選択</li>
              ) : (
                selectedItems.map((item) => {
                  const isHighlighted = leftHighlighted.has(item.id)
                  return (
                    <li key={item.id}>
                      {selectionMode === 'immediate' ? (
                        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-50">
                          <span className="text-xs text-gray-800 truncate">{item.label}</span>
                          <button
                            type="button"
                            onClick={() => onRemove([item.id])}
                            className="text-xs text-red-500 hover:text-red-700 ml-2 shrink-0"
                          >
                            削除
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleLeftHighlight(item.id, item.locked)}
                          disabled={item.locked}
                          className={[
                            'w-full text-left px-3 py-2 text-xs border-b border-gray-50 flex items-center justify-between gap-1',
                            isHighlighted ? 'bg-brand text-white' : 'text-gray-800 hover:bg-gray-50',
                            item.locked ? 'cursor-default' : 'cursor-pointer',
                          ].join(' ')}
                        >
                          <span className="truncate">{item.label}</span>
                          {item.locked && <span className="text-xs shrink-0 opacity-70">（自分）</span>}
                        </button>
                      )}
                    </li>
                  )
                })
              )}
            </ul>
            {selectionMode === 'highlight' && (
              <div className="px-3 py-2 border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  onClick={handleRemoveHighlighted}
                  disabled={leftHighlighted.size === 0}
                  className="w-full py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  削除
                </button>
              </div>
            )}
          </div>

          {/* 右パネル: 候補 */}
          <div className="flex flex-col sm:flex-1 min-h-0">
            {onSearchChange && (
              /* text-base 以上: iOS Safari 入力時自動ズーム防止 */
              <input
                type="text"
                value={searchValue ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder ?? '検索...'}
                className="w-full shrink-0 mb-1 px-3 py-1.5 text-base sm:text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
              />
            )}
            {filterOptions && (
              <div className="shrink-0 mb-1">
                <select
                  value={filterValue ?? ''}
                  onChange={(e) => onFilterChange?.(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand bg-white"
                >
                  {filterOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
            <ul className="flex-1 overflow-y-auto min-h-[80px] max-h-[140px] sm:max-h-none mt-1">
              {isLoading ? (
                <li className="flex items-center justify-center py-4 gap-1 text-xs text-gray-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  読み込み中...
                </li>
              ) : availableItems.length === 0 ? (
                <li className="text-center py-4 text-xs text-gray-400">候補がありません</li>
              ) : (
                availableItems.map((item) => {
                  const isHighlighted = rightHighlighted.has(item.id)
                  return (
                    <li key={item.id}>
                      {selectionMode === 'immediate' ? (
                        <div className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-xs truncate ${item.disabled ? 'text-gray-400' : 'text-gray-800'}`}>
                              {item.label}
                            </span>
                            {item.badge && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded shrink-0">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => onAdd([item.id])}
                            disabled={item.disabled}
                            className="text-xs text-brand hover:text-brand-dark ml-2 shrink-0 disabled:text-gray-300 disabled:cursor-not-allowed"
                          >
                            追加
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleRightHighlight(item.id)}
                          className={[
                            'w-full text-left px-3 py-2 text-xs border-b border-gray-50 truncate',
                            isHighlighted ? 'bg-brand text-white' : 'text-gray-800 hover:bg-gray-50',
                          ].join(' ')}
                        >
                          {item.label}
                        </button>
                      )}
                    </li>
                  )
                })
              )}
            </ul>
            {selectionMode === 'highlight' && (
              <div className="px-0 py-2 border-t border-gray-100 shrink-0 mt-1">
                <button
                  type="button"
                  onClick={handleAddHighlighted}
                  disabled={rightHighlighted.size === 0}
                  className="w-full py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  追加
                </button>
              </div>
            )}
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
