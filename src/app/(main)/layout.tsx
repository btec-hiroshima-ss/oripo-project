import { getSession } from '@/lib/auth'
import Header from '@/components/Header'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header loginName={session.loginName ?? ''} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
