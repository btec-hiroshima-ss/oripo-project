import { getSession } from '@/lib/auth'
import { getOrCreateDefaultPages, getPageWidgets } from '@/lib/pages'
import { getUserDepartment } from '@/lib/user-list'
import PageClient from './_components/PageClient'

export default async function MainPage() {
  const session = await getSession()

  const [pages, department] = await Promise.all([
    getOrCreateDefaultPages(session.userId!),
    getUserDepartment(session.userId!),
  ])

  const widgetsByPage: Record<number, Awaited<ReturnType<typeof getPageWidgets>>> = {}
  await Promise.all(
    pages.map(async (page) => {
      widgetsByPage[page.pageId] = await getPageWidgets(page.pageId)
    })
  )

  return (
    <PageClient
      loginName={session.loginName ?? ''}
      userId={session.userId!}
      department={department}
      initialPages={pages}
      initialWidgetsByPage={widgetsByPage}
    />
  )
}
