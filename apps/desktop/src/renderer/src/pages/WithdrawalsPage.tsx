import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import type { AdminWithdrawal } from '@tcg-admin/types'

type ActionState = 'idle' | 'loading' | 'ok' | 'error'

export function WithdrawalsPage(): JSX.Element {
  const [statusFilter, setStatusFilter] = useState('pending')
  const [offset, setOffset] = useState(0)
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [selected, setSelected] = useState<AdminWithdrawal | null>(null)
  const [actionState, setActionState] = useState<ActionState>('idle')
  const [actionError, setActionError] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  const LIMIT = 50

  const load = useCallback(() => {
    setLoading(true); setError('')
    adminApi.getWithdrawals({ status: statusFilter, limit: LIMIT, offset })
      .then(data => { setWithdrawals(data.withdrawals ?? []); setTotal(data.total ?? 0) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [statusFilter, offset])

  useEffect(() => { load() }, [load])
  useAutoRefresh(load)

  const doAction = async (fn: () => Promise<void>) => {
    setActionState('loading'); setActionError('')
    try {
      await fn()
      setActionState('ok')
      setSelected(null)
      load()
    } catch (e) {
      setActionState('error')
      setActionError((e as Error).message)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))
  const currentPage = Math.floor(offset / LIMIT) + 1

  const inputCls = 'rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary'
  const btnCls = 'rounded-md bg-accent px-3 py-2 text-sm text-foreground hover:bg-accent/80 disabled:opacity-50'

  const statusBadge = (s: string) => {
    if (s === 'pending') return 'bg-amber-500/10 text-amber-400'
    if (s === 'completed') return 'bg-green-500/10 text-green-400'
    if (s === 'rejected') return 'bg-destructive/10 text-destructive'
    return 'bg-accent text-muted-foreground'
  }

  return (
    <div className="flex h-full gap-5">
      {/* List */}
      <div className="flex flex-1 flex-col overflow-hidden space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Withdrawals</h1>
          <span className="text-sm text-muted-foreground">{total} total</span>
        </div>

        <div className="flex items-center gap-3">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setOffset(0) }} className={inputCls}>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
          <button onClick={load} disabled={loading} className={btnCls}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex-1 overflow-y-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-card">
              <tr>
                {['User ID', 'Amount', 'Account name', 'Status', 'Created'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : withdrawals.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No withdrawals found.</td></tr>
              ) : withdrawals.map(w => (
                <tr
                  key={w.id}
                  onClick={() => { setSelected(w); setActionState('idle'); setActionError(''); setRejectReason('') }}
                  className={`cursor-pointer border-b border-border/40 hover:bg-accent/40 ${selected?.id === w.id ? 'bg-accent/60' : ''}`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{w.userId?.slice(0, 10)}</td>
                  <td className="px-4 py-3 font-medium text-foreground">£{w.amount?.toFixed(2) ?? (w.amountPence / 100).toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{w.accountName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(w.status)}`}>{w.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(w.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {currentPage} of {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setOffset(o => Math.max(0, o - LIMIT))} disabled={offset === 0} className="rounded px-2 py-1 hover:bg-accent disabled:opacity-40">← Prev</button>
            <button onClick={() => setOffset(o => o + LIMIT)} disabled={offset + LIMIT >= total} className="rounded px-2 py-1 hover:bg-accent disabled:opacity-40">Next →</button>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-72 shrink-0 overflow-y-auto rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-bold text-foreground">Withdrawal</h2>

          <div className="text-xs space-y-1.5">
            <Row label="ID" value={selected.id.slice(0, 12) + '…'} />
            <Row label="User ID" value={selected.userId?.slice(0, 12) + '…'} />
            <Row label="Amount" value={`£${selected.amount?.toFixed(2) ?? (selected.amountPence / 100).toFixed(2)}`} />
            <Row label="Status" value={selected.status} />
            <Row label="Created" value={formatDate(selected.createdAt)} />
          </div>

          {selected.sortCode && (
            <div className="rounded-lg border border-border bg-background p-3 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Bank details</p>
              <p className="text-xs text-foreground font-medium">{selected.accountName}</p>
              <p className="text-xs text-muted-foreground font-mono">Sort: {selected.sortCode}</p>
              <p className="text-xs text-muted-foreground font-mono">Acc: {selected.accountNumber}</p>
            </div>
          )}

          {actionState === 'ok' && <p className="text-xs text-green-400">Action completed.</p>}
          {actionError && <p className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{actionError}</p>}

          {selected.status === 'pending' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</p>
              <button
                disabled={actionState === 'loading'}
                onClick={() => doAction(() => adminApi.completeWithdrawal(selected.id))}
                className="w-full rounded-md bg-green-500/20 px-3 py-2 text-xs font-medium text-green-400 hover:bg-green-500/30 disabled:opacity-50"
              >
                Mark as completed
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
                  onClick={() => doAction(() => adminApi.rejectWithdrawal(selected.id, rejectReason || undefined))}
                  className="w-full rounded-md bg-destructive/20 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/30 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          )}
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
