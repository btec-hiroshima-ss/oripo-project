import { getSession } from '@/lib/auth'
import Header from '@/components/Header'

// /settings など、ホーム以外のページで使う共通レイアウト。
// ホームは HomeHeader でページタブを含む専用ヘッダーを持つため、このグループには含めない。
export default async function WithHeaderLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  return (
    <>
      <Header loginName={session.loginName ?? ''} />
      {children}
    </>
  )
}
