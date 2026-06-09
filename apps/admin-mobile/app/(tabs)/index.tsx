import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useAlerts } from '../../src/context/AlertsContext'
import { adminApi } from '../../src/lib/api'
import type { AdminRevenueSummary } from '@tcg-admin/types'

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View className="flex-1 rounded-xl border border-border bg-surface p-4">
      <Text className="mb-1 text-xs text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>
        {label}
      </Text>
      <Text className="text-2xl font-bold" style={{ color, fontFamily: 'Inter_700Bold' }}>
        {value}
      </Text>
    </View>
  )
}

function RevenueCard({ label, value, currency }: { label: string; value: number; currency: string }) {
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : ''
  return (
    <View className="flex-1 rounded-xl border border-border bg-surface p-4">
      <Text className="mb-1 text-xs text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>
        {label}
      </Text>
      <Text className="text-xl font-bold text-text" style={{ fontFamily: 'Inter_700Bold' }}>
        {symbol}{(value ?? 0).toFixed(2)}
      </Text>
    </View>
  )
}

export default function DashboardScreen() {
  const counts = useAlerts()
  const [revenue, setRevenue] = useState<AdminRevenueSummary | null>(null)

  useEffect(() => {
    adminApi.getRevenueSummary().then(setRevenue).catch(() => {})
  }, [])

  const totalPending =
    counts.proofQueue + counts.reports + counts.reviews + counts.withdrawals + counts.disputes

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 pt-4 pb-8">

      {/* Attention banner */}
      {totalPending > 0 && (
        <View className="mb-6 rounded-xl border border-warning/30 bg-warning/10 p-4">
          <Text className="text-sm font-semibold text-warning" style={{ fontFamily: 'Inter_600SemiBold' }}>
            {totalPending} item{totalPending !== 1 ? 's' : ''} need attention
          </Text>
        </View>
      )}

      {/* Pending counts */}
      <Text
        className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted"
        style={{ fontFamily: 'Inter_600SemiBold' }}
      >
        Pending
      </Text>
      <View className="mb-2 flex-row gap-3">
        <StatCard
          label="Proof Queue"
          value={counts.proofQueue}
          color={counts.proofQueue > 0 ? '#ef4444' : '#f7f8fa'}
        />
        <StatCard
          label="Reports"
          value={counts.reports}
          color={counts.reports > 0 ? '#ef4444' : '#f7f8fa'}
        />
      </View>
      <View className="mb-2 flex-row gap-3">
        <StatCard
          label="Reviews"
          value={counts.reviews}
          color={counts.reviews > 0 ? '#f59e0b' : '#f7f8fa'}
        />
        <StatCard
          label="Withdrawals"
          value={counts.withdrawals}
          color={counts.withdrawals > 0 ? '#ef4444' : '#f7f8fa'}
        />
      </View>
      <View className="mb-8 flex-row gap-3">
        <StatCard
          label="Disputes"
          value={counts.disputes}
          color={counts.disputes > 0 ? '#f59e0b' : '#f7f8fa'}
        />
        <View className="flex-1" />
      </View>

      {/* Revenue — only rendered when the endpoint is live */}
      {revenue && (
        <>
          <Text
            className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Revenue
          </Text>
          <View className="mb-2 flex-row gap-3">
            <RevenueCard label="Last 7 days"  value={revenue.revenue7d}   currency={revenue.currency} />
            <RevenueCard label="Last 30 days" value={revenue.revenue30d}  currency={revenue.currency} />
          </View>
          <View className="flex-row gap-3">
            <RevenueCard label="Subscriptions" value={revenue.subRevenue} currency={revenue.currency} />
            <RevenueCard label="Refunds"        value={revenue.refunds}   currency={revenue.currency} />
          </View>
        </>
      )}
    </ScrollView>
  )
}
