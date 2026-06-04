import { useEffect, useState } from 'react'
import { adminApi } from '@/lib/api'
import { formatPence } from '@/lib/utils'
import { TrendingUp, CreditCard, Users, AlertTriangle } from 'lucide-react'

interface Stats {
  totalRevenuePence: number
  revenueThisMonthPence: number
  totalUsers: number
  activeSubscriptions: number
  openOrders: number
  openTrades: number
  openDisputes: number
}

function MetricCard({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: React.ElementType }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
          {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
        </div>
        <div className="rounded-xl bg-primary/10 p-3">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </div>
  )
}

export function FinancialsPage(): JSX.Element {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    adminApi.getStats()
      .then(setStats)
      .catch(e => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load financials: {error}
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Financials</h1>

      {!stats ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total Revenue"
              value={formatPence(stats.totalRevenuePence)}
              icon={TrendingUp}
            />
            <MetricCard
              label="This Month"
              value={formatPence(stats.revenueThisMonthPence)}
              sub="Gross revenue"
              icon={TrendingUp}
            />
            <MetricCard
              label="Active Subscriptions"
              value={stats.activeSubscriptions.toLocaleString()}
              sub={`of ${stats.totalUsers.toLocaleString()} users`}
              icon={CreditCard}
            />
            <MetricCard
              label="Open Disputes"
              value={stats.openDisputes.toLocaleString()}
              sub={stats.openDisputes > 0 ? 'Needs attention' : 'All resolved'}
              icon={AlertTriangle}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Platform Activity</h2>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-foreground">{stats.totalUsers.toLocaleString()}</p>
                <p className="mt-1 text-sm text-muted-foreground">Total Users</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-foreground">{stats.openOrders.toLocaleString()}</p>
                <p className="mt-1 text-sm text-muted-foreground">Open Orders</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-foreground">{stats.openTrades.toLocaleString()}</p>
                <p className="mt-1 text-sm text-muted-foreground">Active Trades</p>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Revenue charts and per-user wallet breakdowns can be added once the gateway exposes time-series endpoints.
          </p>
        </>
      )}
    </div>
  )
}
