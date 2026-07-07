'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
    <form onSubmit={handleSubmit}>
      {error && <p role="alert">{error}</p>}

      <label htmlFor="loginName">ユーザー名</label>
      <input
        id="loginName"
        name="loginName"
        type="text"
        autoComplete="username"
        inputMode="email"
        maxLength={50}
        required
        disabled={isPending}
      />

      <label htmlFor="password">パスワード</label>
      <div>
        <input
          id="password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          maxLength={50}
          required
          disabled={isPending}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
        >
          {showPassword ? '🙈' : '👁'}
        </button>
      </div>

      <button type="submit" disabled={isPending}>
        {isPending ? 'ログイン中...' : 'ログイン'}
      </button>
    </form>
  )
}
