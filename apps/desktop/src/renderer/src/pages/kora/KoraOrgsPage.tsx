import { useEffect, useState, useCallback } from 'react'
import { koraOrgsApi } from '@/lib/kora'
import type { KoraOrganisation, KoraOrgMember } from '@sixbyfive/kora-client'
import { formatDate } from '@/lib/utils'

export function KoraOrgsPage(): JSX.Element {
  const [orgs, setOrgs] = useState<KoraOrganisation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<KoraOrganisation | null>(null)
  const [detail, setDetail] = useState<KoraOrganisation | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    koraOrgsApi.list()
      .then(setOrgs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const select = useCallback(async (org: KoraOrganisation) => {
    setSelected(org)
    setDetail(null)
    setDetailLoading(true)
    try {
      const full = await koraOrgsApi.get(org.id)
      setDetail(full)
    } catch { /* detail is best-effort */ }
    finally { setDetailLoading(false) }
  }, [])

  return (
    <div className="flex h-full gap-5">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Organisations</h1>
          {!loading && (
            <span className="text-sm text-muted-foreground">{orgs.length} total</span>
          )}
        </div>

        {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

        <div className="flex-1 overflow-y-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-card">
              <tr>
                {['Name', 'Created'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">Loading…</td>
                </tr>
              ) : orgs.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">No organisations found.</td>
                </tr>
              ) : orgs.map(org => (
                <tr
                  key={org.id}
                  onClick={() => select(org)}
                  className={`cursor-pointer border-b border-border/40 transition-colors hover:bg-accent/40 ${selected?.id === org.id ? 'bg-accent/60' : ''}`}
                >
                  <td className="px-4 py-3 font-medium text-foreground">{org.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(org.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="w-72 shrink-0 overflow-y-auto rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-base font-bold text-foreground">{selected.name}</h2>

          {detailLoading ? (
            <p className="text-xs text-muted-foreground">Loading details…</p>
          ) : detail ? (
            <div className="space-y-5">
              <Section title="Homes">
                {(detail.homes ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No homes.</p>
                ) : (
                  <ul className="space-y-1">
                    {(detail.homes ?? []).map(h => (
                      <li key={h.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-foreground">{h.name}</span>
                        <DbStatus status={h.tenantDatabase?.provisioningStatus ?? 'PENDING'} />
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Members">
                {(detail.userAccess ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No members.</p>
                ) : (
                  <ul className="space-y-2">
                    {(detail.userAccess ?? []).map((m: KoraOrgMember) => (
                      <li key={m.id} className="text-xs">
                        <p className="font-medium text-foreground">
                          {m.user ? `${m.user.firstName} ${m.user.lastName}` : m.userId}
                        </p>
                        <p className="text-muted-foreground">{m.user?.email}</p>
                        <RoleBadge role={m.role} />
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

function DbStatus({ status }: { status: string }) {
  const map: Record<string, string> = {
    READY:        'bg-green-500/10 text-green-400',
    PROVISIONING: 'bg-amber-500/10 text-amber-400',
    FAILED:       'bg-destructive/10 text-destructive',
  }
  const cls = map[status] ?? 'bg-accent text-muted-foreground'
  return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{status}</span>
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="mt-0.5 inline-block rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
      {role.replace(/_/g, ' ')}
    </span>
  )
}
