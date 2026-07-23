'use client'

import { User, Pencil } from 'lucide-react'
import type { UserProfile } from '@/lib/user.types'
import InitialAvatar from './InitialAvatar'

type Props = {
  profile: UserProfile
  onEdit: () => void
}

// 個人設定「ユーザー情報」パネル。ログインユーザー自身のプロフィールを表示する。
// 携帯電話番号は表示しない（要件定義書 2.7 の閲覧項目に含まれないため。編集モーダルでのみ扱う）。
export default function UserInfoPanel({ profile, onEdit }: Props) {
  const fullName = `${profile.lastName} ${profile.firstName}`
  const fullNameKana = `${profile.lastNameKana} ${profile.firstNameKana}`.trim()

  // 役職は現行 DB に紐付けデータがないため通常は null。ある場合のみ「部署 ・ 役職」で表示する
  const departmentLabel = profile.departments.join(' / ')
  const subLabel = profile.position ? `${departmentLabel} ・ ${profile.position}` : departmentLabel

  const rows: { label: string; value: string }[] = [
    { label: 'ログイン名', value: profile.loginName },
    { label: '名前', value: fullName },
    { label: '名前（フリガナ）', value: fullNameKana },
    { label: '部署', value: departmentLabel },
    { label: '権限', value: profile.isAdmin ? '管理者' : '一般利用者' },
  ]

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* パネル見出し: アイコン + タイトル + 編集ボタン */}
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-brand" />
          <span className="font-semibold text-gray-800">ユーザー情報</span>
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white rounded-lg px-3 py-2 text-xs font-medium transition-colors shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" />
          ユーザー情報とパスワードを編集する
        </button>
      </div>

      {/* プロフィール見出し: アバター + 氏名 + 部署（・役職） */}
      <div className="flex items-center gap-4 px-5 pb-5">
        <InitialAvatar userId={profile.userId} name={fullName} size="lg" />
        <div>
          <p className="font-bold text-gray-800">{fullName}</p>
          <p className="text-xs text-gray-400">{subLabel}</p>
        </div>
      </div>

      {/* 明細: モバイルは項目名の下に値を縦積み、lg 以上で2カラム */}
      <dl className="border-t border-gray-100">
        {rows.map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col lg:flex-row lg:items-center px-5 py-3 border-b border-gray-100 last:border-b-0"
          >
            <dt className="lg:w-40 shrink-0 text-xs text-gray-500">{label}</dt>
            <dd className="text-sm text-gray-800">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
