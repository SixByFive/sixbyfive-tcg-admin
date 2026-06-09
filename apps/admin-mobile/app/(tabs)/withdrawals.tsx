import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { adminApi } from '../../src/lib/api'
import type { AdminWithdrawal } from '@tcg-admin/types'

function WithdrawalCard({ item, onComplete, onReject, busy }: {
  item: AdminWithdrawal
  onComplete: () => void
  onReject: () => void
  busy: boolean
}) {
  const amount = item.amount ?? (item.amountPence != null ? `£${(item.amountPence / 100).toFixed(2)}` : '—')
  return (
    <View className="mb-3 rounded-xl border border-border bg-surface p-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-base font-bold text-text" style={{ fontFamily: 'Inter_700Bold' }}>{amount}</Text>
        <View className="rounded bg-warning/20 px-2 py-0.5">
          <Text className="text-[10px] font-semibold text-warning" style={{ fontFamily: 'Inter_600SemiBold' }}>Pending</Text>
        </View>
      </View>
      <Text className="mb-0.5 text-xs text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>
        {item.accountName ?? '—'}
      </Text>
      {item.sortCode && (
        <Text className="mb-3 font-mono text-xs text-text-dim">
          {item.sortCode} · {item.accountNumber}
        </Text>
      )}
      {item.description && (
        <Text className="mb-3 text-xs text-text-dim" style={{ fontFamily: 'Inter_400Regular' }} numberOfLines={2}>
          {item.description}
        </Text>
      )}
      <View className="flex-row gap-2">
        <TouchableOpacity
          className="flex-1 items-center rounded-lg bg-success/20 py-2"
          onPress={onComplete}
          disabled={busy}
          activeOpacity={0.7}
        >
          <Text className="text-xs font-semibold text-success" style={{ fontFamily: 'Inter_600SemiBold' }}>Complete</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 items-center rounded-lg bg-destructive/20 py-2"
          onPress={onReject}
          disabled={busy}
          activeOpacity={0.7}
        >
          <Text className="text-xs font-semibold text-destructive" style={{ fontFamily: 'Inter_600SemiBold' }}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function WithdrawalsScreen() {
  const [items, setItems]     = useState<AdminWithdrawal[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.getWithdrawals({ status: 'pending', limit: 50 })
      setItems(res.withdrawals)
      setTotal(res.total)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const complete = async (id: string) => {
    setBusy(id)
    try { await adminApi.completeWithdrawal(id); setItems(p => p.filter(i => i.id !== id)); setTotal(t => t - 1) }
    catch { /* ignore */ }
    finally { setBusy(null) }
  }

  const reject = async (id: string) => {
    setBusy(id)
    try { await adminApi.rejectWithdrawal(id); setItems(p => p.filter(i => i.id !== id)); setTotal(t => t - 1) }
    catch { /* ignore */ }
    finally { setBusy(null) }
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 pt-4 pb-8"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#2963FF" />}
    >
      {total > 0 && (
        <Text className="mb-4 text-sm text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>
          {total} pending
        </Text>
      )}

      {loading ? (
        <ActivityIndicator color="#2963FF" />
      ) : items.length === 0 ? (
        <View className="items-center py-12">
          <Text className="text-sm text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>No pending withdrawals</Text>
        </View>
      ) : (
        items.map(item => (
          <WithdrawalCard
            key={item.id}
            item={item}
            onComplete={() => complete(item.id)}
            onReject={() => reject(item.id)}
            busy={busy === item.id}
          />
        ))
      )}
    </ScrollView>
  )
}
