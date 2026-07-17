import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'

export type SessionData = {
  userId: number
  loginName: string
}

export const ironOptions = {
  cookieName: 'oripo_session',
  // SESSION_SECRET が未設定だと起動時にクラッシュする（意図的: 設定漏れを早期検知）
  password: process.env.SESSION_SECRET!,
  ttl: 8 * 60 * 60, // 8時間
  cookieOptions: {
    httpOnly: true,
    // ローカル開発は HTTP のため secure: false。本番（HTTPS）でのみ true にする
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
  },
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), ironOptions)
}

// 認証必須の Server Action で使う共通ヘルパー。
// 未認証の場合は例外を投げるため、呼び出し元は認証チェックを個別に書かなくてよい。
export async function requireAuth(): Promise<SessionData> {
  const session = await getSession()
  if (!session.userId) throw new Error('Unauthorized')
  return session
}

// ロックアウト管理（メモリ内）
// 制約: サーバー再起動でリセットされる。複数インスタンス構成には非対応（Oripo は単一サーバーのため許容）
// ルール: 10分以内に5回失敗 → 10分ロック
const FAILURE_LIMIT = 5
const WINDOW_MS = 10 * 60 * 1000 // 10分
const LOCKOUT_MS = 10 * 60 * 1000 // 10分

type LoginAttempt = {
  failures: number
  windowStart: number
  lockedUntil: number
}

const loginAttempts = new Map<string, LoginAttempt>()

export function isLockedOut(loginName: string): boolean {
  const attempt = loginAttempts.get(loginName)
  if (!attempt) return false
  if (attempt.lockedUntil > Date.now()) return true
  // ロック期間経過 → リセット
  loginAttempts.delete(loginName)
  return false
}

export function recordLoginFailure(loginName: string): void {
  const now = Date.now()
  const attempt = loginAttempts.get(loginName) ?? {
    failures: 0,
    windowStart: now,
    lockedUntil: 0,
  }

  // ウィンドウ期間を過ぎていたらリセット
  if (now - attempt.windowStart > WINDOW_MS) {
    attempt.failures = 0
    attempt.windowStart = now
  }

  attempt.failures += 1

  if (attempt.failures >= FAILURE_LIMIT) {
    attempt.lockedUntil = now + LOCKOUT_MS
    attempt.failures = 0
    attempt.windowStart = now
    logger.warn(
      { event: 'auth.lockout', loginName, lockedUntil: new Date(attempt.lockedUntil).toISOString() },
      'ロックアウト発動'
    )
  }

  loginAttempts.set(loginName, attempt)
}

export function resetLoginFailures(loginName: string): void {
  loginAttempts.delete(loginName)
}
