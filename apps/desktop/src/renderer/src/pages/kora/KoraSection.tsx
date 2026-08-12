import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import { useKoraAuth } from '@/context/KoraAuthContext'

export function KoraSection(): JSX.Element {
  const { koraUser, isKoraLoading, koraError, retryKoraAuth } = useKoraAuth()
  const [retrying, setRetrying] = useState(false)

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

    const isApiDown = koraError?.toLowerCase().includes('fetch') ||
                      koraError?.toLowerCase().includes('network') ||
                      koraError?.toLowerCase().includes('connect')

    return (
      <div className="flex h-full flex-col items-center justify-center gap-5">
        <div className="rounded-full bg-muted p-4">
          <WifiOff className="h-6 w-6 text-muted-foreground" />
        </div>

        <div className="text-center">
          <p className="font-semibold text-foreground">Kora not connected</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            {isApiDown
              ? 'The Kora API is unreachable. Check your connection or try again.'
              : (koraError ?? 'Sign in to reconnect Kora.')}
          </p>
        </div>

        {koraError && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive max-w-xs text-center">
            {koraError}
          </p>
        )}

        <button
          onClick={handleRetry}
          disabled={retrying}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {retrying ? 'Retrying…' : 'Retry connection'}
        </button>

        {!isApiDown && (
          <p className="text-xs text-muted-foreground">
            If the problem persists, sign out and back in.
          </p>
        )}
      </div>
    )
  }

  return <Outlet />
}
