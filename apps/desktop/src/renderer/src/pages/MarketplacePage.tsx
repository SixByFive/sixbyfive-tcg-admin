import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { AdminListing } from '@tcg-admin/types'
import { Search } from 'lucide-react'

export function MarketplacePage(): JSX.Element {
  const [listings, setListings] = useState<AdminListing[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showSuspended, setShowSuspended] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suspendId, setSuspendId] = useState<string | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true); setError('')
    adminApi.getListings({ page, search: search || undefined, suspended: showSuspended ? true : undefined })
      .then(({ listings, total }) => { setListings(listings); setTotal(total) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [page, search, showSuspended])

  useEffect(() => { load() }, [load])

  async function handleSuspend(id: string) {
    if (!suspendReason.trim()) return
    setActionLoading(true)
    try {
      await adminApi.suspendListing(id, suspendReason)
      setSuspendId(null); setSuspendReason('')
      load()
    } catch (e) { setError((e as Error).message) }
    finally { setActionLoading(false) }
  }

  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
        <span className="text-sm text-muted-foreground">{total.toLocaleString()} listings</span>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1) } }}
            placeholder="Search card name…"
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <button onClick={() => { setSearch(searchInput); setPage(1) }} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Search</button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showSuspended} onChange={e => { setShowSuspended(e.target.checked); setPage(1) }} />
          Suspended only
        </label>
      </div>

      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-card">
            <tr>
              {['Card', 'Seller', 'Price', 'Status', 'Listed', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : listings.map(l => (
              <tr key={l.id} className="border-b border-border/40 hover:bg-accent/30">
                <td className="px-4 py-3 font-medium text-foreground">{l.cardName}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.seller?.username ?? l.sellerId}</td>
                <td className="px-4 py-3 text-foreground">£{l.price.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${l.isSuspended ? 'text-destructive bg-destructive/10' : 'text-green-400 bg-green-400/10'}`}>
                    {l.isSuspended ? 'Suspended' : l.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(l.createdAt)}</td>
                <td className="px-4 py-3">
                  {!l.isSuspended && (
                    suspendId === l.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          value={suspendReason}
                          onChange={e => setSuspendReason(e.target.value)}
                          placeholder="Reason…"
                          className="rounded border border-input bg-background px-2 py-1 text-xs text-foreground outline-none w-32"
                        />
                        <button
                          onClick={() => handleSuspend(l.id)}
                          disabled={actionLoading || !suspendReason.trim()}
                          className="rounded bg-destructive/20 px-2 py-1 text-xs text-destructive disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button onClick={() => { setSuspendId(null); setSuspendReason('') }} className="rounded bg-accent px-2 py-1 text-xs text-muted-foreground">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSuspendId(l.id)}
                        className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive hover:bg-destructive/20"
                      >
                        Suspend
                      </button>
                    )
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
