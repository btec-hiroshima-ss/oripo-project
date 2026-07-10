'use client'

import { useState } from 'react'
import { X, Check } from 'lucide-react'
import { LAYOUT_LABELS, type PageLayout } from '@/lib/pages.types'
import { useModalDrag } from './useModalDrag'

const LAYOUTS: { value: PageLayout; label: string; icon: React.ReactNode }[] = [
  {
    value: 'OneColumn',
    label: '1列',
    icon: (
      <svg width="44" height="32" viewBox="0 0 44 32" fill="none">
        <rect x="2" y="2" width="40" height="28" rx="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    value: 'TwoColumns',
    label: '2列（等幅）',
    icon: (
      <svg width="44" height="32" viewBox="0 0 44 32" fill="none">
        <rect x="2" y="2" width="18" height="28" rx="2" fill="currentColor" />
        <rect x="24" y="2" width="18" height="28" rx="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    value: 'TwoColumnsRight',
    label: '2列（右広）',
    icon: (
      <svg width="44" height="32" viewBox="0 0 44 32" fill="none">
        <rect x="2" y="2" width="11" height="28" rx="2" fill="currentColor" />
        <rect x="17" y="2" width="25" height="28" rx="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    value: 'TwoColumnsLeft',
    label: '2列（左広）',
    icon: (
      <svg width="44" height="32" viewBox="0 0 44 32" fill="none">
        <rect x="2" y="2" width="25" height="28" rx="2" fill="currentColor" />
        <rect x="31" y="2" width="11" height="28" rx="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    value: 'ThreeColumns',
    label: '3列',
    icon: (
      <svg width="44" height="32" viewBox="0 0 44 32" fill="none">
        <rect x="2" y="2" width="11" height="28" rx="2" fill="currentColor" />
        <rect x="17" y="2" width="10" height="28" rx="2" fill="currentColor" />
        <rect x="31" y="2" width="11" height="28" rx="2" fill="currentColor" />
      </svg>
    ),
  },
]

type Props = {
  currentLayout: PageLayout
  onClose: () => void
  onConfirm: (layout: PageLayout) => void
}

export default function LayoutModal({ currentLayout, onClose, onConfirm }: Props) {
  const [selected, setSelected] = useState<PageLayout>(currentLayout)
  const { style, onMouseDown } = useModalDrag()

  return (
    <div className="fixed inset-0 bg-black/40 z-50">
      <div style={style} className="absolute top-1/2 left-1/2 w-full max-w-md px-4">
        <div className="bg-white rounded-xl shadow-xl">
        {/* ヘッダー: ここ全体をドラッグハンドルにする */}
        <div
          onMouseDown={onMouseDown}
          className="flex items-center justify-between px-5 py-4 border-b border-gray-100 cursor-move select-none"
        >
          <span className="font-semibold text-gray-800">レイアウト設定</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded p-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* レイアウト選択 */}
        <div className="px-5 py-4">
          <p className="text-sm text-gray-500 mb-3">列のレイアウトを選択してください</p>
          <div className="flex gap-2 flex-wrap">
            {LAYOUTS.map(({ value, label, icon }) => {
              const isActive = selected === value
              return (
                <button
                  key={value}
                  onClick={() => setSelected(value)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-colors ${
                    isActive
                      ? 'border-brand text-brand bg-orange-50'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500'
                  }`}
                >
                  {icon}
                  <span className="text-xs font-medium whitespace-nowrap">{label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* フッター */}
        <div className="flex justify-between items-center px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            戻る
          </button>
          <button
            onClick={() => onConfirm(selected)}
            className="px-4 py-2 text-sm text-white bg-brand rounded-lg hover:bg-brand-dark flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5" />
            確認する
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}
