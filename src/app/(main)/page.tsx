import { getSession } from '@/lib/auth'
import { getOrCreateDefaultPages, getPageWidgets } from '@/lib/pages'
import { getUserDetail } from '@/lib/user-list'
import PageClient from './_components/PageClient'

export default async function MainPage() {
  const session = await getSession()

  // getUserDetail で氏名・部署を一度に取得する（getUserDepartment と2クエリになるのを避けるため）
  const [pages, userDetail] = await Promise.all([
    getOrCreateDefaultPages(session.userId!),
    getUserDetail(session.userId!),
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
      fullName={userDetail?.fullName ?? session.loginName ?? ''}
      department={userDetail?.departments[0] ?? null}
      initialPages={pages}
      initialWidgetsByPage={widgetsByPage}
    />
  )
}
