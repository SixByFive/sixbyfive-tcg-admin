import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { TrendingUp, CreditCard, Package, AlertTriangle, ShoppingCart, Wallet } from 'lucide-react'
import type { AdminRevenueSummary, AdminMarketplaceRevenue } from '@tcg-admin/types'

function fmt(n: number | undefined, currency = 'GBP') {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(n)
}

function MetricCard({
  label, value, sub, icon: Icon, accent,
}: { label: string; value: string; sub?: string; icon: React.ElementType; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={`rounded-xl p-3 ${accent ?? 'bg-primary/10'}`}>
          <Icon className={`h-5 w-5 ${accent ? 'text-current' : 'text-primary'}`} />
        </div>
      </div>
    </div>
  )
}

export function FinancialsPage(): JSX.Element {
  const [sub, setSub] = useState<AdminRevenueSummary | null>(null)
  const [mkt, setMkt] = useState<AdminMarketplaceRevenue | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    Promise.all([adminApi.getRevenueSummary(), adminApi.getMarketplaceRevenue()])
      .then(([s, m]) => { setSub(s); setMkt(m) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const currency = sub?.currency ?? mkt?.currency ?? 'GBP'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Financials</h1>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-md bg-accent px-3 py-2 text-sm text-foreground hover:bg-accent/80 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load financials: {error}
        </div>
      )}

      {loading && !sub && !mkt && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {/* ── Subscription revenue ── */}
      {sub && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subscription revenue</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard label="All-time" value={fmt(sub.totalRevenue, currency)} icon={TrendingUp} />
            <MetricCard label="Last 30 days" value={fmt(sub.revenue30d, currency)} sub="Subscription" icon={TrendingUp} />
            <MetricCard label="Last 7 days" value={fmt(sub.revenue7d, currency)} icon={TrendingUp} />
            <MetricCard label="Refunds" value={fmt(sub.refunds, currency)} icon={AlertTriangle} accent="bg-destructive/10 text-destructive" />
          </div>
        </div>
      )}

      {/* ── Marketplace revenue ── */}
      {mkt && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Marketplace revenue</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard label="GMV all-time" value={fmt(mkt.gmv, currency)} icon={ShoppingCart} />
            <MetricCard label="GMV 30d" value={fmt(mkt.gmv30d, currency)} icon={ShoppingCart} />
            <MetricCard label="Platform fees" value={fmt(mkt.platformFees, currency)} sub="All-time" icon={CreditCard} />
            <MetricCard label="Platform fees 30d" value={fmt(mkt.platformFees30d, currency)} icon={CreditCard} />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard label="Shipping collected" value={fmt(mkt.shippingCollected, currency)} icon={Package} />
            <MetricCard label="Wallet used" value={fmt(mkt.walletUsed, currency)} icon={Wallet} />
            <MetricCard label="Refunded total" value={fmt(mkt.refundedTotal, currency)} icon={AlertTriangle} accent="bg-destructive/10 text-destructive" />
            <MetricCard label="Stripe fee est." value={fmt(mkt.stripeFeeEstimate, currency)} sub="Approximate" icon={CreditCard} />
          </div>
        </div>
      )}

      {/* ── Order / dispute summary ── */}
      {mkt && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order activity</h2>
          <div className="grid grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-foreground">{mkt.totalOrders.toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">Total orders</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{mkt.completedOrders.toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">Completed</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${mkt.openDisputes > 0 ? 'text-amber-400' : 'text-foreground'}`}>{mkt.openDisputes}</p>
              <p className="mt-1 text-xs text-muted-foreground">Open disputes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{mkt.resolvedDisputes}</p>
              <p className="mt-1 text-xs text-muted-foreground">Resolved disputes</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Monthly breakdown ── */}
      {mkt && mkt.monthly && mkt.monthly.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monthly breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Month', 'GMV', 'Platform fees', 'Orders'].map(h => (
                    <th key={h} className="pb-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...mkt.monthly].reverse().map(row => (
                  <tr key={row.month} className="border-b border-border/40">
                    <td className="py-2.5 font-medium text-foreground">{row.month}</td>
                    <td className="py-2.5 text-muted-foreground">{fmt(row.gmv, currency)}</td>
                    <td className="py-2.5 text-muted-foreground">{fmt(row.fees, currency)}</td>
                    <td className="py-2.5 text-muted-foreground">{row.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
