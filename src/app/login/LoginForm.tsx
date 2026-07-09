'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { XCircle, User, Lock, Eye, EyeOff, LogIn } from 'lucide-react'
import { login } from './actions'

const ERROR_MESSAGES = {
  invalid_credentials:
    'ユーザー名とパスワードを正しく入力してください。大文字と小文字は区別されます。',
  account_disabled: 'このアカウントは無効です。管理者に連絡してください。',
  locked_out: 'ログイン試行が上限を超えました。しばらく待ってから再度お試しください。',
} as const

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const loginName = (form.elements.namedItem('loginName') as HTMLInputElement).value
    const password = (form.elements.namedItem('password') as HTMLInputElement).value

    startTransition(async () => {
      const result = await login(loginName, password)
      if (result.ok) {
        const redirectTo = searchParams.get('redirect') ?? '/'
        router.push(redirectTo)
      } else {
        setError(ERROR_MESSAGES[result.error])
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Error message */}
      {error && (
        <div role="alert" className="flex items-start gap-2 bg-error-bg border border-error-border rounded-lg px-3 py-2.5">
          <XCircle className="w-4 h-4 text-brand mt-0.5 shrink-0" />
          <p className="text-xs text-error-text leading-relaxed">{error}</p>
        </div>
      )}

      {/* Username */}
      <div>
        <label htmlFor="loginName" className="block text-xs font-medium text-gray-600 mb-1.5">
          ユーザー名
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input
            id="loginName"
            name="loginName"
            type="text"
            autoComplete="username"
            inputMode="email"
            maxLength={50}
            required
            disabled={isPending}
            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="block text-xs font-medium text-gray-600 mb-1.5">
          パスワード
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            maxLength={50}
            required
            disabled={isPending}
            className="w-full border border-gray-200 rounded-lg pl-9 pr-10 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Login button */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-brand hover:bg-brand-dark disabled:bg-brand/50 text-white font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2 mt-2 transition-colors"
      >
        <LogIn className="w-4 h-4" />
        {isPending ? 'ログイン中...' : 'ログイン'}
      </button>
    </form>
  )
}
