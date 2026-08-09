import { Outlet } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import { useKoraAuth } from '@/context/KoraAuthContext'

export function KoraSection(): JSX.Element {
  const { koraUser, isKoraLoading } = useKoraAuth()

  if (isKoraLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Connecting to Kora…</p>
      </div>
    )
  }

  if (!koraUser) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="rounded-full bg-muted p-4">
          <WifiOff className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-foreground">Kora not connected</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Sign out and sign back in with a Kora platform admin account to access this section.
          </p>
        </div>
      </div>
    )
  }

  return <Outlet />
}
