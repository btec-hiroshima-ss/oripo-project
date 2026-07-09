import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { ironOptions, type SessionData } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const PUBLIC_PATHS = ['/login']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  const response = NextResponse.next()
  const session = await getIronSession<SessionData>(request, response, ironOptions)
  const isAuthenticated = !!session.userId

  if (!isAuthenticated && !isPublic) {
    logger.info({ event: 'auth.unauthorized', pathname }, '未認証アクセス → ログインへリダイレクト')
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthenticated && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.searchParams.delete('redirect')
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
