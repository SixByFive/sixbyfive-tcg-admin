import { useState, type FormEvent } from 'react'
import { Outlet } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import { useKoraAuth } from '@/context/KoraAuthContext'

export function KoraSection(): JSX.Element {
  const { koraUser, isKoraLoading, koraLogin } = useKoraAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isKoraLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Connecting to Kora…</p>
      </div>
    )
  }

  if (!koraUser) {
    async function handleSubmit(e: FormEvent) {
      e.preventDefault()
      setError('')
      setLoading(true)
      try {
        await koraLogin(email, password)
      } catch (err) {
        setError((err as Error).message || 'Login failed.')
      } finally {
        setLoading(false)
      }
    }

    return (
      <div className="flex h-full flex-col items-center justify-center gap-5">
        <div className="rounded-full bg-muted p-4">
          <WifiOff className="h-6 w-6 text-muted-foreground" />
        </div>

        <div className="text-center">
          <p className="font-semibold text-foreground">Kora not connected</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sign in with a Kora platform admin account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {loading ? 'Connecting…' : 'Connect to Kora'}
          </button>
        </form>
      </div>
    )
  }

  return <Outlet />
}
