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

  return (
    <HomeClient
      loginName={session.loginName ?? ''}
      initialPages={pages}
      initialWidgetsByPage={widgetsByPage}
    />
  )
}
