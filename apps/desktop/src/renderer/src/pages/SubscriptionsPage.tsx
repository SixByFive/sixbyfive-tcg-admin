import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { AdminSubscription, AdminSubscriptionPage, SubscriptionPlan } from '@tcg-admin/types'

type ActionState = 'idle' | 'loading' | 'ok' | 'error'

export function SubscriptionsPage(): JSX.Element {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [result, setResult] = useState<AdminSubscriptionPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [plans, setPlans] = useState<SubscriptionPlan[]>([])

  const [selected, setSelected] = useState<AdminSubscription | null>(null)
  const [actionState, setActionState] = useState<ActionState>('idle')
  const [actionError, setActionError] = useState('')

  // Grant form
  const [grantUserId, setGrantUserId] = useState('')
  const [grantPlanId, setGrantPlanId] = useState('')
  const [grantDays, setGrantDays] = useState('')
  const [grantState, setGrantState] = useState<ActionState>('idle')
  const [grantError, setGrantError] = useState('')

  // Change plan
  const [changePlanId, setChangePlanId] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    adminApi.getSubscriptions({ status: statusFilter || undefined, page, pageSize: 50 })
      .then(setResult)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [page, statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    adminApi.getPlans().then(setPlans).catch(() => {})
  }, [])

  const doAction = async (fn: () => Promise<void>) => {
    setActionState('loading'); setActionError('')
    try { await fn(); setActionState('ok'); load() }
    catch (e) { setActionState('error'); setActionError((e as Error).message) }
  }

  const doGrant = async () => {
    if (!grantUserId.trim() || !grantPlanId) return
    setGrantState('loading'); setGrantError('')
    try {
      await adminApi.grantSubscription(grantUserId.trim(), grantPlanId, grantDays ? parseInt(grantDays) : undefined)
      setGrantState('ok'); setGrantUserId(''); setGrantPlanId(''); setGrantDays(''); load()
    } catch (e) { setGrantState('error'); setGrantError((e as Error).message) }
  }

  const subs = result?.subscriptions ?? []
  const totalPages = result ? Math.max(1, Math.ceil(result.total / (result.pageSize || 50))) : 1

  const inputCls = 'rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary'
  const btnPrimary = 'rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50'
  const btnCls = 'rounded-md bg-accent px-3 py-2 text-sm text-foreground hover:bg-accent/80 disabled:opacity-50'

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-500/10 text-green-400',
      cancelled: 'bg-destructive/10 text-destructive',
      trialing: 'bg-blue-500/10 text-blue-400',
      past_due: 'bg-amber-500/10 text-amber-400',
    }
    return map[s] ?? 'bg-accent text-muted-foreground'
  }

  return (
    <div className="flex h-full gap-5">
      {/* Main list */}
      <div className="flex flex-1 flex-col overflow-hidden space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Subscriptions</h1>
          <span className="text-sm text-muted-foreground">{result?.total ?? 0} total</span>
        </div>

        <div className="flex items-center gap-3">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className={inputCls}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="past_due">Past due</option>
            <option value="cancelled">Cancelled</option>
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
                {['User ID', 'Plan', 'Status', 'Period end', 'Cancel at end'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : subs.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No subscriptions found.</td></tr>
              ) : subs.map(s => (
                <tr
                  key={s.id}
                  onClick={() => { setSelected(s); setActionState('idle'); setActionError(''); setChangePlanId('') }}
                  className={`cursor-pointer border-b border-border/40 hover:bg-accent/40 ${selected?.id === s.id ? 'bg-accent/60' : ''}`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.userId?.slice(0, 10) ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{s.plan?.name ?? s.planId ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(s.status)}`}>{s.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{s.currentPeriodEnd ? formatDate(s.currentPeriodEnd) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{s.cancelAtPeriodEnd ? <span className="text-amber-400">Yes</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded px-2 py-1 hover:bg-accent disabled:opacity-40">← Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded px-2 py-1 hover:bg-accent disabled:opacity-40">Next →</button>
          </div>
        </div>

        {/* Grant subscription */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Grant subscription to user</p>
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-32">
              <label className="block text-xs text-muted-foreground mb-1">User ID</label>
              <input value={grantUserId} onChange={e => setGrantUserId(e.target.value)} placeholder="User UUID" className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Plan</label>
              <select value={grantPlanId} onChange={e => setGrantPlanId(e.target.value)} className={inputCls}>
                <option value="">Select…</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="w-36">
              <label className="block text-xs text-muted-foreground mb-1">Days (optional)</label>
              <input value={grantDays} onChange={e => setGrantDays(e.target.value)} type="number" min="1" placeholder="30" className={inputCls} />
            </div>
            <button
              onClick={doGrant}
              disabled={grantState === 'loading' || !grantUserId.trim() || !grantPlanId}
              className={btnPrimary}
            >
              {grantState === 'loading' ? 'Granting…' : 'Grant'}
            </button>
          </div>
          {grantState === 'ok' && <p className="text-xs text-green-400">Subscription granted successfully.</p>}
          {grantState === 'error' && <p className="text-xs text-destructive">{grantError}</p>}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-72 shrink-0 overflow-y-auto rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-bold text-foreground">Subscription</h2>

          <div className="text-xs space-y-1.5">
            <Row label="ID" value={selected.id.slice(0, 12) + '…'} />
            <Row label="User" value={selected.userId ? selected.userId.slice(0, 12) + '…' : '—'} />
            <Row label="Plan" value={selected.plan?.name ?? selected.planId ?? '—'} />
            <Row label="Status" value={selected.status} />
            <Row label="Period end" value={selected.currentPeriodEnd ? formatDate(selected.currentPeriodEnd) : '—'} />
            <Row label="Cancel at end" value={selected.cancelAtPeriodEnd ? 'Yes' : 'No'} />
          </div>

          {actionState === 'ok' && <p className="text-xs text-green-400">Done.</p>}
          {actionError && <p className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{actionError}</p>}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</p>
            <button
              disabled={actionState === 'loading'}
              onClick={() => doAction(() => adminApi.cancelAdminSubscription(selected.id))}
              className="w-full rounded-md bg-destructive/20 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/30 disabled:opacity-50"
            >
              Cancel at period end
            </button>
            <button
              disabled={actionState === 'loading'}
              onClick={() => doAction(() => adminApi.resumeAdminSubscription(selected.id))}
              className="w-full rounded-md bg-green-500/20 px-3 py-2 text-xs font-medium text-green-400 hover:bg-green-500/30 disabled:opacity-50"
            >
              Resume
            </button>
            <button
              disabled={actionState === 'loading'}
              onClick={() => doAction(() => adminApi.revokeSubscription(selected.id))}
              className="w-full rounded-md bg-amber-500/20 px-3 py-2 text-xs font-medium text-amber-400 hover:bg-amber-500/30 disabled:opacity-50"
            >
              Revoke immediately
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Change plan</p>
            <select value={changePlanId} onChange={e => setChangePlanId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none">
              <option value="">Select plan…</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button
              disabled={actionState === 'loading' || !changePlanId}
              onClick={() => doAction(() => adminApi.changeSubscriptionPlan(selected.id, changePlanId))}
              className="w-full rounded-md border border-primary/40 px-3 py-2 text-xs text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              Apply plan change
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
