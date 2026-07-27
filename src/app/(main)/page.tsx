import { getSession } from '@/lib/auth'
import { getOrCreateDefaultPages, getPageWidgets } from '@/lib/pages'
import { getUserProfile } from '@/lib/user'
import PageClient from './_components/PageClient'

export default async function MainPage() {
  const session = await getSession()

  // getUserProfile はヘッダー表示（氏名・部署）と個人設定のユーザー情報パネルの
  // 両方をまかなうため、getUserDetail と併用せず1本にまとめている
  const [pages, profile] = await Promise.all([
    getOrCreateDefaultPages(session.userId!),
    getUserProfile(session.userId!),
  ])

  const widgetsByPage: Record<number, Awaited<ReturnType<typeof getPageWidgets>>> = {}
  await Promise.all(
    pages.map(async (page) => {
      widgetsByPage[page.pageId] = await getPageWidgets(page.pageId)
    })
  )

  // middleware で認証済みのため通常は null にならないが、型上は null になりうるため防御する
  if (!profile) return null

  return (
    <PageClient
      profile={profile}
      initialPages={pages}
      initialWidgetsByPage={widgetsByPage}
    />
  )
}
