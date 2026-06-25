import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { AdminBinder } from '@tcg-admin/types'

export function BindersPage(): JSX.Element {
  const [binders, setBinders] = useState<AdminBinder[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search, setSearch]   = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    adminApi.getBinders({ page })
      .then(({ binders, total }) => { setBinders(binders); setTotal(total) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { load() }, [load])

  const handleDelete = async (b: AdminBinder) => {
    if (!confirm(`Delete binder "${b.name}" (${b.id})? This cannot be undone.`)) return
    setDeleting(b.id)
    try { await adminApi.deleteBinder(b.id); load() }
    catch (e) { setError((e as Error).message) }
    finally { setDeleting(null) }
  }

  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const filtered = search.trim()
    ? binders.filter(b =>
        b.name?.toLowerCase().includes(search.toLowerCase()) ||
        b.username?.toLowerCase().includes(search.toLowerCase()) ||
        b.userId?.toLowerCase().includes(search.toLowerCase())
      )
    : binders

  const visibilityColor = (v: string) => {
    if (v === 'public')  return 'bg-green-500/10 text-green-400'
    if (v === 'friends') return 'bg-blue-500/10 text-blue-400'
    return 'bg-accent text-muted-foreground'
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">Binders</h1>
        <span className="text-sm text-muted-foreground">{total}+ binders</span>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter by name or owner…"
          className="w-56 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button onClick={load} disabled={loading || !!deleting} className="rounded-md bg-accent px-3 py-2 text-sm text-foreground hover:bg-accent/80 disabled:opacity-50">Refresh</button>
      </div>

      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-card">
            <tr>
              {['Name', 'Owner', 'Visibility', 'Created', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No binders found.</td></tr>
            ) : filtered.map(b => (
              <tr key={b.id} className="border-b border-border/40 hover:bg-accent/30">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{b.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{b.id.slice(0,8)}…</p>
                </td>
                <td className="px-4 py-3 max-w-[160px] truncate">
                  {b.username
                    ? <span className="text-foreground">{b.username}</span>
                    : <span className="font-mono text-xs text-muted-foreground">{b.userId ?? '—'}</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${visibilityColor(b.visibility)}`}>
                    {b.visibility}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{b.createdAt ? formatDate(b.createdAt) : '—'}</td>
                <td className="px-4 py-3">
                  {b.isDeleted && (
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive">Deleted</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {!b.isDeleted && (
                    <button
                      disabled={deleting === b.id}
                      onClick={() => handleDelete(b)}
                      className="rounded px-2 py-1 text-xs border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      {deleting === b.id ? '…' : 'Delete'}
                    </button>
                  )}
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
