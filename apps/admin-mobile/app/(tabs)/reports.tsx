import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { adminApi } from '../../src/lib/api'
import type { AdminReportedUser, OrderDispute, ReviewQueueItem } from '@tcg-admin/types'

type Tab = 'reports' | 'reviews' | 'disputes'

// ── Cards ──────────────────────────────────────────────────────────────────

function ReportCard({
  item,
  onClear,
  busy,
}: {
  item: AdminReportedUser
  onClear: () => void
  busy: boolean
}) {
  return (
    <View className="mb-3 rounded-xl border border-border bg-surface p-4">
      <Text
        className="mb-0.5 text-sm font-semibold text-text"
        style={{ fontFamily: 'Inter_600SemiBold' }}
      >
        {item.user?.username ?? item.userId}
      </Text>
      <Text className="mb-0.5 text-xs text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>
        Reported by {item.reporter?.username ?? item.reporterId}
      </Text>
      <Text
        className="mb-3 text-xs text-text-dim"
        style={{ fontFamily: 'Inter_400Regular' }}
        numberOfLines={2}
      >
        {item.reason}
        {item.details ? ` — ${item.details}` : ''}
      </Text>
      <TouchableOpacity
        className="items-center rounded-lg bg-success/20 py-2"
        onPress={onClear}
        disabled={busy}
        activeOpacity={0.7}
      >
        <Text className="text-xs font-semibold text-success" style={{ fontFamily: 'Inter_600SemiBold' }}>
          Clear Report
        </Text>
      </TouchableOpacity>
    </View>
  )
}

function ReviewCard({
  item,
  onResolve,
  busy,
}: {
  item: ReviewQueueItem
  onResolve: (action: 'approve' | 'void') => void
  busy: boolean
}) {
  return (
    <View className="mb-3 rounded-xl border border-border bg-surface p-4">
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-text" style={{ fontFamily: 'Inter_600SemiBold' }}>
          {'⭐'.repeat(Math.min(item.rating, 5))}
        </Text>
        {item.disputeReason && (
          <View className="rounded bg-warning/20 px-2 py-0.5">
            <Text className="text-[10px] text-warning" style={{ fontFamily: 'Inter_600SemiBold' }}>
              Disputed
            </Text>
          </View>
        )}
      </View>
      {item.review && (
        <Text
          className="mb-3 text-xs text-text-muted"
          style={{ fontFamily: 'Inter_400Regular' }}
          numberOfLines={3}
        >
          {item.review}
        </Text>
      )}
      <View className="flex-row gap-2">
        <TouchableOpacity
          className="flex-1 items-center rounded-lg bg-success/20 py-2"
          onPress={() => onResolve('approve')}
          disabled={busy}
          activeOpacity={0.7}
        >
          <Text className="text-xs font-semibold text-success" style={{ fontFamily: 'Inter_600SemiBold' }}>
            Approve
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 items-center rounded-lg bg-destructive/20 py-2"
          onPress={() => onResolve('void')}
          disabled={busy}
          activeOpacity={0.7}
        >
          <Text
            className="text-xs font-semibold text-destructive"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Void
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function DisputeCard({
  item,
  onResolve,
  busy,
}: {
  item: OrderDispute
  onResolve: (favours: 'buyer' | 'seller') => void
  busy: boolean
}) {
  const shortId = (item.orderId ?? item.id).slice(-8)
  return (
    <View className="mb-3 rounded-xl border border-border bg-surface p-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-text" style={{ fontFamily: 'Inter_600SemiBold' }}>
          Order #{shortId}
        </Text>
        <View className="rounded bg-warning/20 px-2 py-0.5">
          <Text className="text-[10px] font-semibold text-warning" style={{ fontFamily: 'Inter_600SemiBold' }}>
            Open
          </Text>
        </View>
      </View>
      {item.raisedBy ? (
        <Text className="mb-1 text-xs text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>
          Raised by: {item.raisedBy}
        </Text>
      ) : null}
      {item.reason ? (
        <Text
          className="mb-3 text-xs text-text-dim"
          style={{ fontFamily: 'Inter_400Regular' }}
          numberOfLines={3}
        >
          {item.reason}
        </Text>
      ) : (
        <View className="mb-3" />
      )}
      {busy ? (
        <ActivityIndicator color="#2963FF" />
      ) : (
        <View className="flex-row gap-2">
          <TouchableOpacity
            className="flex-1 items-center rounded-lg bg-accent/20 py-2"
            onPress={() => onResolve('buyer')}
            activeOpacity={0.7}
          >
            <Text className="text-xs font-semibold text-accent" style={{ fontFamily: 'Inter_600SemiBold' }}>
              Favour Buyer
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 items-center rounded-lg bg-surface-alt py-2"
            onPress={() => onResolve('seller')}
            activeOpacity={0.7}
          >
            <Text className="text-xs font-semibold text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>
              Favour Seller
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

function EmptyState({ message = 'Nothing to review' }: { message?: string }) {
  return (
    <View className="items-center py-12">
      <Text className="text-sm text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>
        {message}
      </Text>
    </View>
  )
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const [tab, setTab]         = useState<Tab>('reports')
  const [reports, setReports] = useState<AdminReportedUser[]>([])
  const [reviews, setReviews] = useState<ReviewQueueItem[]>([])
  const [disputes, setDisputes] = useState<OrderDispute[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [rRes, rvRes, dRes] = await Promise.allSettled([
      adminApi.getReportedUsers({ isCleared: false }),
      adminApi.getReviewQueue({ status: 'pending' }),
      adminApi.getOrderDisputes('open'),
    ])
    if (rRes.status  === 'fulfilled') setReports(rRes.value.reports)
    if (rvRes.status === 'fulfilled')
      setReviews((rvRes.value as ReviewQueueItem[]).filter(r => r.reviewStatus === 'pending'))
    if (dRes.status  === 'fulfilled')
      setDisputes((dRes.value as OrderDispute[]).filter(d => d.status === 'open'))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const clearReport = async (userId: string) => {
    setBusy(userId)
    try {
      await adminApi.clearUserReport(userId)
      setReports(p => p.filter(r => r.userId !== userId))
    } catch { /* ignore */ }
    finally { setBusy(null) }
  }

  const resolveReview = async (id: string, action: 'approve' | 'void') => {
    setBusy(id)
    try {
      await adminApi.resolveReview(id, action)
      setReviews(p => p.filter(r => r.id !== id))
    } catch { /* ignore */ }
    finally { setBusy(null) }
  }

  const resolveDispute = async (id: string, favours: 'buyer' | 'seller') => {
    setBusy(id)
    try {
      await adminApi.resolveDispute(id, favours === 'buyer' ? 'refunded' : 'released', favours)
      setDisputes(p => p.filter(d => d.id !== id))
    } catch { /* ignore */ }
    finally { setBusy(null) }
  }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'reports',  label: 'Reports',  count: reports.length  },
    { key: 'reviews',  label: 'Reviews',  count: reviews.length  },
    { key: 'disputes', label: 'Disputes', count: disputes.length },
  ]

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 pt-4 pb-8"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#2963FF" />}
    >
      {/* Tab picker */}
      <View className="mb-6 flex-row rounded-xl border border-border bg-surface p-1">
        {TABS.map(({ key, label, count }) => (
          <TouchableOpacity
            key={key}
            className={`flex-1 items-center rounded-lg py-2 ${tab === key ? 'bg-accent' : ''}`}
            onPress={() => setTab(key)}
            activeOpacity={0.8}
          >
            <Text
              className="text-xs font-semibold"
              style={{
                color: tab === key ? '#fff' : '#8f98bc',
                fontFamily: 'Inter_600SemiBold',
              }}
            >
              {label} ({count})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator color="#2963FF" />
      ) : tab === 'reports' ? (
        reports.length === 0 ? (
          <EmptyState message="No pending reports" />
        ) : (
          reports.map(r => (
            <ReportCard
              key={r.id}
              item={r}
              onClear={() => clearReport(r.userId)}
              busy={busy === r.userId}
            />
          ))
        )
      ) : tab === 'reviews' ? (
        reviews.length === 0 ? (
          <EmptyState message="No pending reviews" />
        ) : (
          reviews.map(r => (
            <ReviewCard
              key={r.id}
              item={r}
              onResolve={action => resolveReview(r.id, action)}
              busy={busy === r.id}
            />
          ))
        )
      ) : disputes.length === 0 ? (
        <EmptyState message="No open disputes" />
      ) : (
        disputes.map(d => (
          <DisputeCard
            key={d.id}
            item={d}
            onResolve={favours => resolveDispute(d.id, favours)}
            busy={busy === d.id}
          />
        ))
      )}
    </ScrollView>
  )
}
