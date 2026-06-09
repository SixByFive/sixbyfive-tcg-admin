import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { AdminListing } from '@tcg-admin/types'

export function MarketplacePage(): JSX.Element {
  const [listings, setListings] = useState<AdminListing[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    adminApi.getListings({ page })
      .then(({ listings, total }) => { setListings(listings); setTotal(total) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { load() }, [load])

  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
        <span className="text-sm text-muted-foreground">{total.toLocaleString()}+ listings</span>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <button onClick={load} className="rounded-md bg-accent px-3 py-2 text-sm text-foreground hover:bg-accent/80">Refresh</button>
      </div>

      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-card">
            <tr>
              {['Title', 'Seller ID', 'Price', 'Status', 'Listed'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : listings.map(l => (
              <tr key={l.id} className="border-b border-border/40 hover:bg-accent/30">
                <td className="px-4 py-3 font-medium text-foreground">{l.title}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{l.sellerId.slice(0, 8)}…</td>
                <td className="px-4 py-3 text-foreground">£{(l.price ?? 0).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    l.status === 'active' ? 'text-green-400 bg-green-400/10' :
                    l.status === 'sold'   ? 'text-primary bg-primary/10' :
                                           'text-muted-foreground bg-accent'
                  }`}>
                    {l.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(l.createdAt)}</td>
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
