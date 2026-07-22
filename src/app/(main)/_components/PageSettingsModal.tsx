'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { LAYOUT_LABELS, WIDGET_LABELS, type PageLayout, type PageWidget, type WidgetType } from '@/lib/pages.types'
import { useModalDrag } from './useModalDrag'

// AIPO の「追加アプリの設定」モーダルに相当。
// レイアウト選択とウィジェット追加を1つのモーダルにまとめることで AIPO の操作感を再現する。
// 歯車アイコン（PageTab）→ このモーダル、という導線。

const ALL_WIDGET_TYPES: WidgetType[] = ['Schedule', 'Whatsnew', 'UserList']

const WIDGET_DESCRIPTIONS: Record<WidgetType, string> = {
  Schedule: 'スケジュールを一覧・追加できます',
  Whatsnew: 'ほかのメンバーの更新情報を確認できます',
  UserList: '社内ユーザーを検索・一覧できます',
}

const LAYOUT_ICONS: Record<PageLayout, React.ReactNode> = {
  OneColumn: (
    <svg width="40" height="28" viewBox="0 0 40 28" fill="none">
      <rect x="2" y="2" width="36" height="24" rx="2" fill="currentColor" />
    </svg>
  ),
  TwoColumns: (
    <svg width="40" height="28" viewBox="0 0 40 28" fill="none">
      <rect x="2" y="2" width="16" height="24" rx="2" fill="currentColor" />
      <rect x="22" y="2" width="16" height="24" rx="2" fill="currentColor" />
    </svg>
  ),
  TwoColumnsRight: (
    <svg width="40" height="28" viewBox="0 0 40 28" fill="none">
      <rect x="2" y="2" width="10" height="24" rx="2" fill="currentColor" />
      <rect x="16" y="2" width="22" height="24" rx="2" fill="currentColor" />
    </svg>
  ),
  TwoColumnsLeft: (
    <svg width="40" height="28" viewBox="0 0 40 28" fill="none">
      <rect x="2" y="2" width="22" height="24" rx="2" fill="currentColor" />
      <rect x="28" y="2" width="10" height="24" rx="2" fill="currentColor" />
    </svg>
  ),
  ThreeColumns: (
    <svg width="40" height="28" viewBox="0 0 40 28" fill="none">
      <rect x="2" y="2" width="10" height="24" rx="2" fill="currentColor" />
      <rect x="16" y="2" width="8" height="24" rx="2" fill="currentColor" />
      <rect x="28" y="2" width="10" height="24" rx="2" fill="currentColor" />
    </svg>
  ),
}

type Props = {
  currentLayout: PageLayout
  existingWidgets: PageWidget[]
  onClose: () => void
  onConfirm: (layout: PageLayout, addWidgetTypes: WidgetType[]) => void
}

export default function PageSettingsModal({ currentLayout, existingWidgets, onClose, onConfirm }: Props) {
  const [selectedLayout, setSelectedLayout] = useState<PageLayout>(currentLayout)
  // 追加するウィジェット種別のチェックボックス状態（デフォルトは未選択）
  const [checkedTypes, setCheckedTypes] = useState<Set<WidgetType>>(new Set())
  const { style, onMouseDown } = useModalDrag()

  // 現ページの各ウィジェット種別の個数（「現在数」列に表示）
  const currentCounts: Record<WidgetType, number> = {
    Schedule: 0,
    Whatsnew: 0,
    UserList: 0,
  }
  for (const w of existingWidgets) {
    if (w.widgetType in currentCounts) {
      currentCounts[w.widgetType as WidgetType]++
    }
  }

  function toggleType(type: WidgetType) {
    setCheckedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div style={style} className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        {/* ヘッダー */}
        <div
          onMouseDown={onMouseDown}
          className="flex items-center justify-between px-5 py-4 border-b border-gray-100 cursor-grab active:cursor-grabbing select-none"
        >
          <span className="font-semibold text-gray-800">ページ設定</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded p-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* レイアウト選択（AIPO の「配置の選択」に相当） */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">配置の選択</h3>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(LAYOUT_ICONS) as PageLayout[]).map((layout) => (
                <button
                  key={layout}
                  onClick={() => setSelectedLayout(layout)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-colors ${
                    selectedLayout === layout
                      ? 'border-brand text-brand bg-orange-50'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500'
                  }`}
                  title={LAYOUT_LABELS[layout]}
                >
                  {LAYOUT_ICONS[layout]}
                  <span className="text-xs font-medium whitespace-nowrap">{LAYOUT_LABELS[layout]}</span>
                </button>
              ))}
            </div>
          </section>

          {/* ウィジェット追加（AIPO の「追加アプリの選択」に相当） */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">追加アプリの選択</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-1.5 pr-3 text-gray-500 font-medium w-10">追加</th>
                  <th className="text-left py-1.5 pr-3 text-gray-500 font-medium w-12">現在数</th>
                  <th className="text-left py-1.5 pr-3 text-gray-500 font-medium">タイトル</th>
                  <th className="text-left py-1.5 text-gray-500 font-medium">説明</th>
                </tr>
              </thead>
              <tbody>
                {ALL_WIDGET_TYPES.map((type) => (
                  <tr key={type} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 pr-3">
                      <input
                        type="checkbox"
                        id={`widget-${type}`}
                        name={`widget-${type}`}
                        checked={checkedTypes.has(type)}
                        onChange={() => toggleType(type)}
                        className="w-4 h-4 accent-brand"
                      />
                    </td>
                    <td className="py-2.5 pr-3 text-center text-gray-500">{currentCounts[type]}</td>
                    <td className="py-2.5 pr-3 font-medium text-gray-700">
                      <label htmlFor={`widget-${type}`} className="cursor-pointer">
                        {WIDGET_LABELS[type]}
                      </label>
                    </td>
                    <td className="py-2.5 text-gray-500 text-xs">{WIDGET_DESCRIPTIONS[type]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        {/* フッター */}
        <div className="flex justify-between items-center px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            閉じる
          </button>
          <button
            onClick={() => onConfirm(selectedLayout, Array.from(checkedTypes))}
            className="px-4 py-2 text-sm text-white bg-brand rounded-lg hover:bg-brand-dark"
          >
            更新する
          </button>
        </div>
      </div>
    </div>
  )
}
