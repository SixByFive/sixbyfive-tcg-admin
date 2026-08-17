import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import { useKoraAuth } from '@/context/KoraAuthContext'

export function KoraSection(): JSX.Element {
  const { koraUser, isKoraLoading, koraError, koraLogin, retryKoraAuth } = useKoraAuth()
  const [retrying, setRetrying] = useState(false)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn]   = useState(false)

  if (isKoraLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Connecting to Kora…</p>
      </div>
    )
  }

  if (!koraUser) {
    async function handleRetry() {
      setRetrying(true)
      try { await retryKoraAuth() } finally { setRetrying(false) }
    }

    async function handleLogin(e: React.FormEvent) {
      e.preventDefault()
      setLoginError('')
      setLoggingIn(true)
      try { await koraLogin(email, password) }
      catch (err) { setLoginError((err as Error).message) }
      finally { setLoggingIn(false) }
    }

    const inputCls = 'rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary w-full'

    return (
      <div className="flex h-full flex-col items-center justify-center gap-5">
        <div className="rounded-full bg-muted p-4">
          <WifiOff className="h-6 w-6 text-muted-foreground" />
        </div>

        <div className="text-center">
          <p className="font-semibold text-foreground">Kora not connected</p>
          <p className="mt-1 text-xs text-muted-foreground">Sign in with your Kora platform admin account.</p>
        </div>

        <form onSubmit={handleLogin} className="flex w-72 flex-col gap-3">
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            autoComplete="email"
            required
            className={inputCls}
          />
          <input
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            required
            className={inputCls}
          />
          {(loginError || koraError) && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive text-center">
              {loginError || koraError}
            </p>
          )}
          <button
            type="submit"
            disabled={loggingIn}
            className="rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {loggingIn ? 'Signing in…' : 'Sign in to Kora'}
          </button>
        </form>

        <button
          onClick={handleRetry}
          disabled={retrying}
          className="text-xs text-muted-foreground underline disabled:opacity-50"
        >
          {retrying ? 'Retrying…' : 'Retry saved session'}
        </button>
      </div>
    )
  }

  return <Outlet />
}
