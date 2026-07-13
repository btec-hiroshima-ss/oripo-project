import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { LayoutGrid } from 'lucide-react'
import { getSession } from '@/lib/auth'
import LoginForm from './LoginForm'

export const metadata = { title: 'Oripo' }

// Server Component: セッションチェックをサーバー側で行い、ログイン済みならリダイレクト
export default async function LoginPage() {
  const session = await getSession()
  // すでにログイン済みの場合はホームへ
  if (session.userId) redirect('/')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'radial-gradient(ellipse 70% 55% at 65% 15%, #fdeee8 0%, #fdf5f3 60%)' }}>
      <div className="w-full max-w-[340px]">
        {/* カード */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* ブランドカラーのヘッダー */}
          <div className="bg-brand flex items-center justify-center gap-2.5 py-5">
            {/* Oripoロゴアイコン（lucide-react の LayoutGrid） */}
            <LayoutGrid className="w-6 h-6 text-white" />
            <span className="text-white text-2xl font-bold tracking-wide">Oripo</span>
          </div>

          {/* フォームエリア: LoginForm は useSearchParams を使うため Suspense が必要 */}
          <div className="px-8 pt-6 pb-8">
            <h2 className="text-center text-[15px] font-semibold text-gray-700 mb-1">サインイン</h2>
            <p className="text-center text-xs text-gray-400 mb-5">
              ユーザー名とパスワードを入力してください
            </p>
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>

        <footer className="text-center text-xs text-gray-400 mt-5">
          Oripo · © 2026 BREXA Technology
        </footer>
      </div>
    </div>
  )
}
