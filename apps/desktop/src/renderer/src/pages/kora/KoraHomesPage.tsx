import { useEffect, useState } from 'react'
import { koraHomesApi } from '@/lib/kora'
import type { KoraHome } from '@sixbyfive/kora-client'
import { formatDate } from '@/lib/utils'

export function KoraHomesPage(): JSX.Element {
  const [homes, setHomes] = useState<KoraHome[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    koraHomesApi.list()
      .then(setHomes)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">Care Homes</h1>
        {!loading && (
          <span className="text-sm text-muted-foreground">{homes.length} total</span>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-card">
            <tr>
              {['Name', 'Organisation', 'Slug', 'DB Status', 'Created'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td>
              </tr>
            ) : homes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No homes found.</td>
              </tr>
            ) : homes.map(home => {
              const dbStatus = home.tenantDatabase?.provisioningStatus ?? 'PENDING'
              return (
                <tr key={home.id} className="border-b border-border/40 hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium text-foreground">{home.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {home.organisation?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{home.slug}</td>
                  <td className="px-4 py-3">
                    <ProvisioningBadge status={dbStatus} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(home.createdAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ProvisioningBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    READY:        'bg-green-500/10 text-green-400',
    PROVISIONING: 'bg-amber-500/10 text-amber-400 animate-pulse',
    FAILED:       'bg-destructive/10 text-destructive',
    PENDING:      'bg-accent text-muted-foreground',
  }
  const cls = map[status] ?? 'bg-accent text-muted-foreground'
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>
  )
}
