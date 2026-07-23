'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { UserProfile, UserProfileInput } from '@/lib/user.types'
import { updateUserProfileAction } from '../actions'

type Props = {
  profile: UserProfile
  onClose: () => void
}

// 入力欄のフォントは text-base（16px）以上にする。14px 未満だと iOS Safari が入力時に自動ズームするため
const INPUT_CLASS =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand disabled:bg-gray-50'

// 個人設定のユーザー情報編集モーダル。
// ヘッダーのアバタークリックとユーザー情報パネルの編集ボタンの両方から開く共通コンポーネント。
// 部署・権限は表示のみ（変更は管理者のユーザー管理画面で行う。specs/user-info.md の仕様確認事項1参照）。
export default function UserEditModal({ profile, onClose }: Props) {
  // パスワードは既存ハッシュをクライアントに渡さないため常に空欄で開始する
  const [form, setForm] = useState<UserProfileInput>({
    lastName: profile.lastName,
    firstName: profile.firstName,
    lastNameKana: profile.lastNameKana,
    firstNameKana: profile.firstNameKana,
    cellularPhone: profile.cellularPhone ?? '',
    password: '',
    passwordConfirm: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function update(key: keyof UserProfileInput, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const result = await updateUserProfileAction(form)

    if (result.ok) {
      onClose()
      return
    }
    // 失敗時はモーダルを閉じず、エラーを表示して再入力できるようにする
    setError(result.error)
    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <span className="font-semibold text-gray-800">ユーザー情報編集</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded p-0.5"
            aria-label="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 項目数が多くモバイルでは画面に収まらないため、フォーム部分だけ縦スクロールさせる */}
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
          <div className="px-5 py-4 space-y-4 overflow-y-auto">
            {error && (
              <p className="bg-error-bg border border-error-border text-error-text rounded-lg px-3 py-2 text-sm">
                {error}
              </p>
            )}

            {/* ログイン名は変更不可（システム ID） */}
            <div>
              <span className="block text-xs font-medium text-gray-600 mb-1.5">ログイン名</span>
              <p className="text-sm text-gray-800">{profile.loginName}</p>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-600 mb-1.5">
                パスワード <span className="text-brand">必須</span>
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                maxLength={50}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                className={INPUT_CLASS}
              />
              <p className="mt-1 text-xs text-gray-400">8文字以上50文字以内の半角英数</p>
            </div>

            <div>
              <label htmlFor="passwordConfirm" className="block text-xs font-medium text-gray-600 mb-1.5">
                パスワード（確認用） <span className="text-brand">必須</span>
              </label>
              <input
                id="passwordConfirm"
                type="password"
                autoComplete="new-password"
                maxLength={50}
                value={form.passwordConfirm}
                onChange={(e) => update('passwordConfirm', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-gray-600 mb-1.5">
                名前 <span className="text-brand">必須</span>
              </span>
              <div className="flex gap-2">
                <input
                  aria-label="姓"
                  value={form.lastName}
                  onChange={(e) => update('lastName', e.target.value)}
                  className={INPUT_CLASS}
                />
                <input
                  aria-label="名"
                  value={form.firstName}
                  onChange={(e) => update('firstName', e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-gray-600 mb-1.5">
                名前（フリガナ） <span className="text-brand">必須</span>
              </span>
              <div className="flex gap-2">
                <input
                  aria-label="姓（フリガナ）"
                  value={form.lastNameKana}
                  onChange={(e) => update('lastNameKana', e.target.value)}
                  className={INPUT_CLASS}
                />
                <input
                  aria-label="名（フリガナ）"
                  value={form.firstNameKana}
                  onChange={(e) => update('firstNameKana', e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div>
              <label htmlFor="cellularPhone" className="block text-xs font-medium text-gray-600 mb-1.5">
                携帯電話番号（社内）
              </label>
              <input
                id="cellularPhone"
                type="tel"
                value={form.cellularPhone}
                onChange={(e) => update('cellularPhone', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            {/* 部署・権限は表示のみ */}
            <div>
              <span className="block text-xs font-medium text-gray-600 mb-1.5">部署</span>
              <p className="text-sm text-gray-800">{profile.departments.join(' / ')}</p>
            </div>

            <div>
              <span className="block text-xs font-medium text-gray-600 mb-1.5">権限</span>
              <p className="text-sm text-gray-800">{profile.isAdmin ? '管理者' : '一般利用者'}</p>
            </div>
          </div>

          <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              閉じる
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm text-white bg-brand hover:bg-brand-dark rounded-lg transition-colors disabled:opacity-60"
            >
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
