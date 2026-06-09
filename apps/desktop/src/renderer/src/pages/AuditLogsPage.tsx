import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { AdminAuditLog } from '@tcg-admin/types'

export function AuditLogsPage(): JSX.Element {
  const [logs, setLogs]       = useState<AdminAuditLog[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // Filters
  const [userId, setUserId]         = useState('')
  const [action, setAction]         = useState('')
  const [targetType, setTargetType] = useState('')

  const [draftUser, setDraftUser]         = useState('')
  const [draftAction, setDraftAction]     = useState('')
  const [draftTarget, setDraftTarget]     = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    adminApi.getAuditLogs({ page, userId: userId || undefined, action: action || undefined, targetType: targetType || undefined })
      .then(({ logs, total }) => { setLogs(logs); setTotal(total) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [page, userId, action, targetType])

  useEffect(() => { load() }, [load])

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault()
    setUserId(draftUser.trim())
    setAction(draftAction.trim())
    setTargetType(draftTarget.trim())
    setPage(1)
  }

  const clearFilters = () => {
    setDraftUser(''); setDraftAction(''); setDraftTarget('')
    setUserId(''); setAction(''); setTargetType('')
    setPage(1)
  }

  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasFilters = userId || action || targetType

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
        <span className="text-sm text-muted-foreground">{total}+ entries</span>
      </div>

      <form onSubmit={applyFilters} className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={draftUser}
          onChange={e => setDraftUser(e.target.value)}
          placeholder="User ID"
          className="w-48 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <input
          value={draftAction}
          onChange={e => setDraftAction(e.target.value)}
          placeholder="Action (e.g. ban_user)"
          className="w-44 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <input
          value={draftTarget}
          onChange={e => setDraftTarget(e.target.value)}
          placeholder="Target type"
          className="w-36 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button type="submit" className="rounded-md bg-accent px-3 py-2 text-sm text-foreground hover:bg-accent/80">Filter</button>
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent">Clear</button>
        )}
        <button type="button" onClick={load} className="ml-auto rounded-md bg-accent px-3 py-2 text-sm text-foreground hover:bg-accent/80">Refresh</button>
      </form>

      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-card">
            <tr>
              {['Date', 'User ID', 'Action', 'Target type', 'Target ID', 'IP'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No logs found.</td></tr>
            ) : logs.map(l => (
              <tr key={l.id} className="border-b border-border/40 hover:bg-accent/30">
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{l.createdAt ? formatDate(l.createdAt) : '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground max-w-[100px] truncate">{l.userId ?? '—'}</td>
                <td className="px-4 py-3 font-medium text-foreground">{l.action}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.targetType ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground max-w-[100px] truncate">{l.targetId ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{l.ip ?? '—'}</td>
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
