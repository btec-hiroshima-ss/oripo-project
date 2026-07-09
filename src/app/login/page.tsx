import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import LoginForm from './LoginForm'

export const metadata = { title: 'Oripo' }

export default async function LoginPage() {
  const session = await getSession()
  if (session.userId) redirect('/')

  return (
    <div className="min-h-screen bg-[#fdf5f3] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[340px]">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Red header */}
          <div className="bg-[#e84b28] flex items-center justify-center gap-2.5 py-5">
            {/* Grid/calendar icon */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="3" width="7" height="7" rx="1.5" fill="white" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" fill="white" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" fill="white" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" fill="white" />
            </svg>
            <span className="text-white text-2xl font-bold tracking-wide">Oripo</span>
          </div>

          {/* Form area */}
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
