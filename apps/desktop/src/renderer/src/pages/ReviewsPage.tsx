import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import type { ReviewQueueItem } from '@tcg-admin/types'

type ActionState = 'idle' | 'loading' | 'ok' | 'error'

const STARS = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n)

export function ReviewsPage(): JSX.Element {
  const [statusFilter, setStatusFilter] = useState('pending')
  const [items, setItems] = useState<ReviewQueueItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [selected, setSelected] = useState<ReviewQueueItem | null>(null)
  const [actionState, setActionState] = useState<ActionState>('idle')
  const [actionError, setActionError] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    adminApi.getReviewQueue({ status: statusFilter || undefined })
      .then(setItems)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load])
  useAutoRefresh(load)

  const doAction = async (action: 'approve' | 'void') => {
    if (!selected) return
    setActionState('loading'); setActionError('')
    try {
      await adminApi.resolveReview(selected.id, action)
      setActionState('ok')
      setItems(prev => prev.filter(i => i.id !== selected.id))
      setSelected(null)
    } catch (e) {
      setActionState('error')
      setActionError((e as Error).message)
    }
  }

  const inputCls = 'rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary'
  const btnCls = 'rounded-md bg-accent px-3 py-2 text-sm text-foreground hover:bg-accent/80 disabled:opacity-50'

  const statusBadge = (s: string) => {
    if (s === 'pending') return 'bg-amber-500/10 text-amber-400'
    if (s === 'disputed') return 'bg-blue-500/10 text-blue-400'
    if (s === 'approved') return 'bg-green-500/10 text-green-400'
    if (s === 'voided') return 'bg-destructive/10 text-destructive'
    return 'bg-accent text-muted-foreground'
  }

  return (
    <div className="flex h-full gap-5">
      {/* List */}
      <div className="flex flex-1 flex-col overflow-hidden space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reviews</h1>
            <p className="text-sm text-muted-foreground">Moderate pending or disputed seller reviews.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{items.length} shown</span>
            <button onClick={load} disabled={loading} className={btnCls}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={inputCls}>
            <option value="pending">Pending</option>
            <option value="disputed">Disputed</option>
            <option value="">All</option>
          </select>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {actionState === 'ok' && (
          <p className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">Action applied.</p>
        )}

        {items.length === 0 && !loading && !error && (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-border">
            <p className="text-muted-foreground text-sm">No reviews in this queue.</p>
          </div>
        )}

        {items.length > 0 && (
          <div className="flex-1 overflow-y-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-card">
                <tr>
                  {['Seller ID', 'Rating', 'Review', 'Status', 'Updated'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                ) : items.map(item => (
                  <tr
                    key={item.id}
                    onClick={() => { setSelected(item); setActionState('idle'); setActionError('') }}
                    className={`cursor-pointer border-b border-border/40 hover:bg-accent/40 ${selected?.id === item.id ? 'bg-accent/60' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.sellerId?.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-amber-400 text-xs tracking-tight">{STARS(item.rating)}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{item.review ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(item.reviewStatus)}`}>{item.reviewStatus}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.updatedAt ? formatDate(item.updatedAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-72 shrink-0 overflow-y-auto rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-bold text-foreground">Review moderation</h2>

          <div className="text-xs space-y-1.5">
            <Row label="Listing ID" value={selected.id.slice(0, 12) + '…'} />
            <Row label="Seller ID" value={selected.sellerId?.slice(0, 12) + '…'} />
            <Row label="Status" value={selected.reviewStatus} />
            <Row label="Rating" value={`${selected.rating}/5`} />
          </div>

          {selected.review && (
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Review text</p>
              <p className="text-sm text-foreground">{selected.review}</p>
            </div>
          )}

          {selected.disputeReason && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-400 mb-1">Dispute reason</p>
              <p className="text-xs text-blue-300">{selected.disputeReason}</p>
            </div>
          )}

          {actionError && (
            <p className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{actionError}</p>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision</p>
            <button
              disabled={actionState === 'loading'}
              onClick={() => doAction('approve')}
              className="w-full rounded-md bg-green-500/20 px-3 py-2 text-xs font-medium text-green-400 hover:bg-green-500/30 disabled:opacity-50"
            >
              ✓ Approve review
            </button>
            <button
              disabled={actionState === 'loading'}
              onClick={() => doAction('void')}
              className="w-full rounded-md bg-destructive/20 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/30 disabled:opacity-50"
            >
              ✗ Void review
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground truncate max-w-36">{value}</span>
    </div>
  )
}
