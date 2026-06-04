import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { formatPence, formatDate } from '@/lib/utils'
import type { AdminOrder } from '@tcg-admin/types'

const STATUS_OPTIONS = ['', 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'DISPUTED']

function statusColor(s: string) {
  if (s === 'CANCELLED') return 'text-destructive bg-destructive/10'
  if (s === 'DISPUTED') return 'text-orange-400 bg-orange-400/10'
  if (s === 'DELIVERED' || s === 'COMPLETED') return 'text-green-400 bg-green-400/10'
  return 'text-primary bg-primary/10'
}

export function OrdersPage(): JSX.Element {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    adminApi.getOrders({ page, status: status || undefined })
      .then(({ orders, total }) => { setOrders(orders); setTotal(total) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [page, status])

  useEffect(() => { load() }, [load])

  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <span className="text-sm text-muted-foreground">{total.toLocaleString()} total</span>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
        >
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>
        <button onClick={load} className="rounded-md bg-accent px-3 py-2 text-sm text-foreground hover:bg-accent/80">Refresh</button>
      </div>

      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-card">
            <tr>
              {['Order ID', 'Buyer', 'Seller', 'Status', 'Payment', 'Total', 'Date'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : orders.map(o => (
              <tr key={o.id} className="border-b border-border/40 hover:bg-accent/30">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{o.id.slice(0, 8)}…</td>
                <td className="px-4 py-3 text-foreground">{o.buyer?.username ?? o.buyerId}</td>
                <td className="px-4 py-3 text-foreground">{o.seller?.username ?? o.sellerId}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(o.status)}`}>{o.status}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(o.paymentStatus)}`}>{o.paymentStatus}</span>
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{formatPence(o.totalPricePence)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(o.createdAt)}</td>
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
