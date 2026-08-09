import { useEffect, useState } from 'react'
import { koraOrgsApi, koraHomesApi } from '@/lib/kora'
import type { KoraOrganisation, KoraHome } from '@sixbyfive/kora-client'
import { Building2, Home, Database } from 'lucide-react'
import { formatDate } from '@/lib/utils'

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string
  value: string
  icon: React.ElementType
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-foreground">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className="rounded-lg bg-primary/10 p-2.5">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  )
}

export function KoraDashboardPage(): JSX.Element {
  const [orgs, setOrgs] = useState<KoraOrganisation[]>([])
  const [homes, setHomes] = useState<KoraHome[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([koraOrgsApi.list(), koraHomesApi.list()])
      .then(([o, h]) => { setOrgs(o); setHomes(h) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const provisioned = homes.filter(h => h.tenantDatabase?.provisioningStatus === 'READY').length
  const recentHomes = [...homes]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load: {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Kora Dashboard</h1>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard
              label="Organisations"
              value={orgs.length.toLocaleString()}
              icon={Building2}
            />
            <StatCard
              label="Care Homes"
              value={homes.length.toLocaleString()}
              icon={Home}
              sub={`${provisioned} provisioned`}
            />
            <StatCard
              label="DB Provisioned"
              value={provisioned.toLocaleString()}
              icon={Database}
              sub={`${homes.length - provisioned} pending`}
            />
          </div>

          {recentHomes.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-foreground">Recent Care Homes</h2>
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-card">
                    <tr>
                      {['Home', 'Organisation', 'DB Status', 'Created'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentHomes.map(home => {
                      const status = home.tenantDatabase?.provisioningStatus ?? 'PENDING'
                      return (
                        <tr key={home.id} className="border-b border-border/40 hover:bg-accent/30">
                          <td className="px-4 py-3 font-medium text-foreground">{home.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {home.organisation?.name ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <DbStatusBadge status={status} />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(home.createdAt)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DbStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    READY:        'bg-green-500/10 text-green-400',
    PROVISIONING: 'bg-amber-500/10 text-amber-400',
    FAILED:       'bg-destructive/10 text-destructive',
    PENDING:      'bg-accent text-muted-foreground',
  }
  const cls = map[status] ?? 'bg-accent text-muted-foreground'
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}
