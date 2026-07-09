import { headers } from 'next/headers'
import { getSession } from '@/lib/auth'
import { getOrCreateDefaultPages, getPageWidgets } from '@/lib/pages'
import HomeClient from './_components/HomeClient'

export default async function HomePage() {
  const session = await getSession()
  const pages = await getOrCreateDefaultPages(session.userId!)

  const widgetsByPage: Record<number, Awaited<ReturnType<typeof getPageWidgets>>> = {}
  await Promise.all(
    pages.map(async (page) => {
      widgetsByPage[page.pageId] = await getPageWidgets(page.pageId)
    })
  )

  // UA からモバイル判定（lg=1024px 未満をモバイルとみなす）
  const headersList = await headers()
  const ua = headersList.get('user-agent') ?? ''
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua)

  return (
    <HomeClient
      initialPages={pages}
      initialWidgetsByPage={widgetsByPage}
      isMobile={isMobile}
    />
  )
}
