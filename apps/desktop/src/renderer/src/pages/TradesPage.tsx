import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { AdminTrade } from '@tcg-admin/types'

const STATUS_OPTIONS = ['', 'INITIATED', 'NEGOTIATING', 'AGREED', 'PROOF_PENDING', 'LOCKED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED', 'DISPUTED']

function statusColor(s: string) {
  if (s === 'CANCELLED') return 'text-destructive bg-destructive/10'
  if (s === 'DISPUTED') return 'text-orange-400 bg-orange-400/10'
  if (s === 'COMPLETED') return 'text-green-400 bg-green-400/10'
  if (s === 'LOCKED' || s === 'IN_TRANSIT') return 'text-blue-400 bg-blue-400/10'
  return 'text-primary bg-primary/10'
}

export function TradesPage(): JSX.Element {
  const [trades, setTrades] = useState<AdminTrade[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<AdminTrade | null>(null)
  const [resolution, setResolution] = useState('')
  const [resolvedFor, setResolvedFor] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    adminApi.getTrades({ page, status: status || undefined })
      .then(({ trades, total }) => { setTrades(trades); setTotal(total) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [page, status])

  useEffect(() => { load() }, [load])

  async function handleResolveDispute() {
    if (!selected || !resolution.trim() || !resolvedFor) return
    setActionLoading(true); setActionError('')
    try {
      await adminApi.resolveTradeDispute(selected.id, resolution, resolvedFor)
      setSelected(s => s ? { ...s, status: 'COMPLETED' } : s)
      setResolution(''); setResolvedFor('')
      load()
    } catch (e) { setActionError((e as Error).message) }
    finally { setActionLoading(false) }
  }

  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex h-full gap-5">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Trades</h1>
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

        <div className="flex-1 overflow-y-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-card">
              <tr>
                {['Trade ID', 'Party A', 'Party B', 'Status', 'Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : trades.map(t => (
                <tr
                  key={t.id}
                  onClick={() => { setSelected(t); setActionError('') }}
                  className={`cursor-pointer border-b border-border/40 transition-colors hover:bg-accent/40 ${selected?.id === t.id ? 'bg-accent/60' : ''}`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-foreground">{t.partyA?.username ?? t.partyAId}</td>
                  <td className="px-4 py-3 text-foreground">{t.partyB?.username ?? t.partyBId}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(t.status)}`}>{t.status}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(t.createdAt)}</td>
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

      {selected && selected.status === 'DISPUTED' && (
        <div className="w-72 shrink-0 rounded-xl border border-orange-400/30 bg-card p-5">
          <h2 className="mb-1 text-base font-bold text-foreground">Resolve Dispute</h2>
          <p className="mb-4 text-xs text-muted-foreground">Trade {selected.id.slice(0, 8)}</p>

          {actionError && <p className="mb-3 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{actionError}</p>}

          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Resolved in favour of</label>
              <select
                value={resolvedFor}
                onChange={e => setResolvedFor(e.target.value)}
                className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none"
              >
                <option value="">Select party…</option>
                <option value={selected.partyAId}>{selected.partyA?.username ?? 'Party A'}</option>
                <option value={selected.partyBId}>{selected.partyB?.username ?? 'Party B'}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Resolution notes</label>
              <textarea
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                rows={3}
                placeholder="Explain the resolution…"
                className="w-full resize-none rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none"
              />
            </div>
            <button
              onClick={handleResolveDispute}
              disabled={actionLoading || !resolution.trim() || !resolvedFor}
              className="rounded-md bg-orange-400/20 px-3 py-2 text-sm font-medium text-orange-400 hover:bg-orange-400/30 disabled:opacity-50"
            >
              {actionLoading ? 'Resolving…' : 'Resolve dispute'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
