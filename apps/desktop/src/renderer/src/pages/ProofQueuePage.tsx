import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import type { ProofQueueItem } from '@tcg-admin/types'

type ActionState = 'idle' | 'loading' | 'ok' | 'error'

export function ProofQueuePage(): JSX.Element {
  const [items, setItems] = useState<ProofQueueItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [selected, setSelected] = useState<ProofQueueItem | null>(null)
  const [actionState, setActionState] = useState<ActionState>('idle')
  const [actionError, setActionError] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    adminApi.getProofQueue()
      .then(setItems)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])
  useAutoRefresh(load)

  const doAction = async (fn: () => Promise<void>) => {
    setActionState('loading'); setActionError('')
    try {
      await fn()
      setActionState('ok')
      // Remove from list optimistically
      setItems(prev => prev.filter(i => i.id !== selected?.id))
      setSelected(null)
    } catch (e) {
      setActionState('error')
      setActionError((e as Error).message)
    }
  }

  const btnCls = 'rounded-md bg-accent px-3 py-2 text-sm text-foreground hover:bg-accent/80 disabled:opacity-50'

  return (
    <div className="flex h-full gap-5">
      {/* List */}
      <div className="flex flex-1 flex-col overflow-hidden space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Proof Queue</h1>
            <p className="text-sm text-muted-foreground">Review submitted card proof images.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{items.length} pending</span>
            <button onClick={load} disabled={loading} className={btnCls}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {actionState === 'ok' && (
          <p className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">Action completed.</p>
        )}

        {items.length === 0 && !loading && !error && (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-border">
            <p className="text-muted-foreground text-sm">Queue is empty — no listings awaiting proof review.</p>
          </div>
        )}

        {items.length > 0 && (
          <div className="flex-1 overflow-y-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-card">
                <tr>
                  {['Title', 'Card ID', 'Seller ID', 'Price', 'Submitted'].map(h => (
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
                    onClick={() => { setSelected(item); setActionState('idle'); setActionError(''); setRejectReason('') }}
                    className={`cursor-pointer border-b border-border/40 hover:bg-accent/40 ${selected?.id === item.id ? 'bg-accent/60' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium text-foreground max-w-[180px] truncate">{item.title ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.cardId?.slice(0, 12) ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.sellerId?.slice(0, 10) ?? '—'}</td>
                    <td className="px-4 py-3 text-foreground">{item.price != null ? `£${item.price.toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.createdAt ? formatDate(item.createdAt) : '—'}</td>
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
          <h2 className="text-sm font-bold text-foreground">Proof review</h2>

          <div className="text-xs space-y-1.5">
            <Row label="ID" value={selected.id.slice(0, 12) + '…'} />
            <Row label="Title" value={selected.title ?? '—'} />
            <Row label="Card ID" value={selected.cardId?.slice(0, 12) + '…' ?? '—'} />
            <Row label="Seller ID" value={selected.sellerId?.slice(0, 12) + '…' ?? '—'} />
            <Row label="Price" value={selected.price != null ? `£${selected.price.toFixed(2)}` : '—'} />
            <Row label="Proof code" value={selected.proofCode ?? '—'} />
          </div>

          {/* Proof image */}
          {selected.proofImagePath ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <img
                src={`/marketplace-proof/${selected.id}`}
                alt="Proof"
                className="w-full object-contain max-h-48"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-accent/20 p-4 text-center">
              <p className="text-xs text-muted-foreground">No proof image uploaded yet</p>
            </div>
          )}

          {actionState === 'ok' && <p className="text-xs text-green-400">Done.</p>}
          {actionError && <p className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{actionError}</p>}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision</p>
            <button
              disabled={actionState === 'loading'}
              onClick={() => doAction(() => adminApi.approveProof(selected.id))}
              className="w-full rounded-md bg-green-500/20 px-3 py-2 text-xs font-medium text-green-400 hover:bg-green-500/30 disabled:opacity-50"
            >
              ✓ Approve proof
            </button>
            <div className="space-y-1.5">
              <input
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Rejection reason (optional)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none"
              />
              <button
                disabled={actionState === 'loading'}
                onClick={() => doAction(() => adminApi.rejectProof(selected.id, rejectReason || undefined))}
                className="w-full rounded-md bg-destructive/20 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/30 disabled:opacity-50"
              >
                ✗ Reject proof
              </button>
            </div>
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
