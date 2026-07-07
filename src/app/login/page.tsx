import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import LoginForm from './LoginForm'

export const metadata = { title: 'Oripo' }

export default async function LoginPage() {
  const session = await getSession()
  if (session.userId) redirect('/')

  return (
    <main>
      <h1>Oripo</h1>
      <h2>サインイン</h2>
      <p>ユーザー名とパスワードを入力してください</p>
      <Suspense>
        <LoginForm />
      </Suspense>
      <footer>Oripo · © 2026 BREXA Technology</footer>
    </main>
  )
}
