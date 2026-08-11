import { useEffect, useState } from 'react'
import { adminApi } from '@/lib/api'
import { formatPence } from '@/lib/utils'
import { Users, ShoppingBag, ArrowLeftRight, AlertTriangle, TrendingUp, CreditCard } from 'lucide-react'

interface Stats {
  totalRevenuePence: number
  revenueThisMonthPence: number
  totalUsers: number
  activeSubscriptions: number
  openOrders: number
  openTrades: number
  openDisputes: number
}

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: string; icon: React.ElementType; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-foreground">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className="rounded-lg bg-primary/10 p-2.5">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  )
}

export function DashboardPage(): JSX.Element {
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
        Failed to load stats: {error}
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">TCG Dashboard</h1>

      {!stats ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          <StatCard
            label="Total Revenue"
            value={formatPence(stats.totalRevenuePence)}
            icon={TrendingUp}
            sub={`${formatPence(stats.revenueThisMonthPence)} this month`}
          />
          <StatCard
            label="Total Users"
            value={stats.totalUsers.toLocaleString()}
            icon={Users}
            sub={`${stats.activeSubscriptions} subscribed`}
          />
          <StatCard
            label="Active Subscriptions"
            value={stats.activeSubscriptions.toLocaleString()}
            icon={CreditCard}
          />
          <StatCard
            label="Open Orders"
            value={stats.openOrders.toLocaleString()}
            icon={ShoppingBag}
          />
          <StatCard
            label="Active Trades"
            value={stats.openTrades.toLocaleString()}
            icon={ArrowLeftRight}
          />
          <StatCard
            label="Open Disputes"
            value={stats.openDisputes.toLocaleString()}
            icon={AlertTriangle}
            sub={stats.openDisputes > 0 ? 'Needs attention' : 'All clear'}
          />
        </div>
      )}
    </div>
  )
}
