import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import type { AdminReportedUser } from '@tcg-admin/types'

const STATUS_OPTS = [
  { value: 'open',     label: 'Open' },
  { value: 'cleared',  label: 'Cleared' },
  { value: 'all',      label: 'All' },
]

export function ReportedUsersPage(): JSX.Element {
  const [filter, setFilter]   = useState<'open' | 'cleared' | 'all'>('open')
  const [reports, setReports] = useState<AdminReportedUser[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [busy, setBusy]       = useState<string | null>(null)
  const [actionErr, setActionErr] = useState('')

  const isCleared = filter === 'all' ? undefined : filter === 'cleared'

  const load = useCallback(() => {
    setLoading(true); setError('')
    adminApi.getReportedUsers({ page, isCleared })
      .then(({ reports, total }) => { setReports(reports); setTotal(total) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [page, isCleared])

  useEffect(() => { load() }, [load])
  useAutoRefresh(load)

  async function handleAction(fn: () => Promise<void>, id: string) {
    setBusy(id); setActionErr('')
    try { await fn(); load() }
    catch (e) { setActionErr((e as Error).message) }
    finally { setBusy(null) }
  }

  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">Reported Users</h1>
        <span className="text-sm text-muted-foreground">{total}+ reports</span>
      </div>

      <div className="mb-3 flex items-center gap-2">
        {STATUS_OPTS.map(opt => (
          <button
            key={opt.value}
            onClick={() => { setFilter(opt.value as any); setPage(1) }}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              filter === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-accent text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <button onClick={load} className="ml-auto rounded-md bg-accent px-3 py-2 text-sm text-foreground hover:bg-accent/80">Refresh</button>
      </div>

      {error     && <p className="mb-2 text-sm text-destructive">{error}</p>}
      {actionErr && <p className="mb-2 text-sm text-destructive">{actionErr}</p>}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-card">
            <tr>
              {['Reported User', 'Reporter', 'Reason', 'Details', 'Date', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : reports.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No reports found.</td></tr>
            ) : reports.map(r => (
              <tr key={r.id} className="border-b border-border/40 hover:bg-accent/30">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{r.user?.username ?? '—'}</p>
                  <p className="font-mono text-xs text-muted-foreground">{r.userId.slice(0,8)}…</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-foreground">{r.reporter?.username ?? '—'}</p>
                  <p className="font-mono text-xs text-muted-foreground">{r.reporterId.slice(0,8)}…</p>
                </td>
                <td className="px-4 py-3 text-foreground">{r.reason}</td>
                <td className="px-4 py-3 max-w-[200px] truncate text-muted-foreground text-xs">{r.details || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(r.createdAt)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.isCleared ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                  }`}>
                    {r.isCleared ? 'Cleared' : 'Open'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {!r.isCleared && (
                      <button
                        disabled={busy === r.id}
                        onClick={() => handleAction(() => adminApi.clearUserReport(r.userId), r.id)}
                        className="rounded px-2 py-1 text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      disabled={busy === r.id}
                      onClick={() => handleAction(() => adminApi.banUserFromChat(r.userId), r.id)}
                      className="rounded px-2 py-1 text-xs border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      Ban chat
                    </button>
                    <button
                      disabled={busy === r.id}
                      onClick={() => handleAction(() => adminApi.unbanUserFromChat(r.userId), r.id)}
                      className="rounded px-2 py-1 text-xs border border-border text-muted-foreground hover:bg-accent disabled:opacity-50"
                    >
                      Unban chat
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded px-2 py-1 hover:bg-accent disabled:opacity-40">← Prev</button>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded px-2 py-1 hover:bg-accent disabled:opacity-40">Next →</button>
        </div>
      </div>
    </div>
  )
}
