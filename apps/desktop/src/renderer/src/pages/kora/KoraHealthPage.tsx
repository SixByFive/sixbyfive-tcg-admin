import { useEffect, useState, useCallback } from 'react'
import { koraHealthApi, koraHomesApi } from '@/lib/kora'
import type { KoraHealthResult, KoraDbHealthStatus, KoraHome } from '@sixbyfive/kora-client'

function statusColor(status: string): string {
  if (status === 'ok')      return 'bg-green-500/10 text-green-400 border-green-500/20'
  if (status === 'error')   return 'bg-destructive/10 text-destructive border-destructive/20'
  if (status === 'skipped') return 'bg-accent text-muted-foreground border-border'
  return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
}

function statusDot(status: string): string {
  if (status === 'ok')    return 'bg-green-400'
  if (status === 'error') return 'bg-destructive'
  return 'bg-muted-foreground'
}

export function KoraHealthPage(): JSX.Element {
  const [health, setHealth] = useState<KoraHealthResult | null>(null)
  const [homes, setHomes] = useState<KoraHome[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [h, hms] = await Promise.all([koraHealthApi.check(), koraHomesApi.list()])
      setHealth(h)
      setHomes(hms)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load health status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const homeById = Object.fromEntries(homes.map(h => [h.id, h]))

  function tenantLabel(t: KoraDbHealthStatus): string {
    if (t.homeId && homeById[t.homeId]) return homeById[t.homeId].name
    return t.databaseName ?? t.homeId ?? 'Unknown'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">API Health</h1>
          <p className="text-sm text-muted-foreground">Platform database and tenant database connectivity.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-md bg-accent px-3 py-2 text-sm text-foreground hover:bg-accent/80 disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm font-semibold text-destructive">Failed to check health</p>
          <p className="mt-1 text-xs text-destructive/80">{error}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Ensure <code className="rounded bg-muted px-1 py-0.5 text-[11px]">VITE_KORA_ADMIN_KEY</code> is set in <code className="rounded bg-muted px-1 py-0.5 text-[11px]">.env</code>.
          </p>
        </div>
      )}

      {health && (
        <>
          {/* Overall status banner */}
          <div className={`flex items-center gap-3 rounded-xl border p-4 ${
            health.status === 'ok'
              ? 'border-green-500/30 bg-green-500/10'
              : 'border-amber-500/30 bg-amber-500/10'
          }`}>
            <span className={`h-3 w-3 rounded-full ${health.status === 'ok' ? 'bg-green-400' : 'bg-amber-400 animate-pulse'}`} />
            <div>
              <p className={`text-sm font-semibold ${health.status === 'ok' ? 'text-green-400' : 'text-amber-400'}`}>
                {health.status === 'ok' ? 'All systems operational' : 'Degraded — some databases unreachable'}
              </p>
              <p className="text-xs text-muted-foreground">
                Last checked: {new Date(health.checkedAt).toLocaleTimeString()}
              </p>
            </div>
          </div>

          {/* Platform DB */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Platform Database</h2>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-border/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${statusDot(health.platform.status)}`} />
                        <span className="font-medium text-foreground">Platform DB</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor(health.platform.status)}`}>
                        {health.platform.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {health.platform.message ?? ''}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Tenant DBs */}
          {health.tenants.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                Tenant Databases <span className="font-normal text-muted-foreground">({health.tenants.length})</span>
              </h2>
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-card">
                    <tr>
                      {['Home', 'DB Name', 'Provisioning', 'Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {health.tenants.map((t, i) => (
                      <tr key={i} className="border-b border-border/40 hover:bg-accent/30">
                        <td className="px-4 py-3 font-medium text-foreground">{tenantLabel(t)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.databaseName ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{t.provisioningStatus ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${statusDot(t.status)}`} />
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor(t.status)}`}>
                              {t.status}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!health && !loading && !error && (
        <p className="text-sm text-muted-foreground">No data yet.</p>
      )}
    </div>
  )
}
