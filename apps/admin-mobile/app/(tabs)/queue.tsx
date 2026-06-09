import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { adminApi } from '../../src/lib/api'
import type { ProofQueueItem } from '@tcg-admin/types'

function QueueItem({ item, onApprove, onReject, busy }: {
  item: ProofQueueItem
  onApprove: () => void
  onReject: () => void
  busy: boolean
}) {
  return (
    <View className="mb-3 rounded-xl border border-border bg-surface p-4">
      <Text className="mb-0.5 text-sm font-semibold text-text" style={{ fontFamily: 'Inter_600SemiBold' }}>
        {item.title ?? 'Untitled listing'}
      </Text>
      <Text className="mb-3 text-xs text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>
        {item.price != null ? `£${(item.price / 100).toFixed(2)}` : '—'}
        {item.proofCode ? `  ·  Code: ${item.proofCode}` : ''}
      </Text>
      <View className="flex-row gap-2">
        <TouchableOpacity
          className="flex-1 items-center rounded-lg bg-success/20 py-2"
          onPress={onApprove}
          disabled={busy}
          activeOpacity={0.7}
        >
          <Text className="text-xs font-semibold text-success" style={{ fontFamily: 'Inter_600SemiBold' }}>Approve</Text>
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

export default function QueueScreen() {
  const [items, setItems]     = useState<ProofQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState<string | null>(null)
  const [error, setError]     = useState('')

  const load = useCallback(async () => {
    try {
      setError('')
      const all = await adminApi.getProofQueue()
      setItems(all.filter(p => !p.status || p.status === 'pending'))
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const approve = async (id: string) => {
    setBusy(id)
    try { await adminApi.approveProof(id); setItems(p => p.filter(i => i.id !== id)) }
    catch { /* ignore */ }
    finally { setBusy(null) }
  }

  const reject = async (id: string) => {
    setBusy(id)
    try { await adminApi.rejectProof(id); setItems(p => p.filter(i => i.id !== id)) }
    catch { /* ignore */ }
    finally { setBusy(null) }
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 pt-4 pb-8"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#2963FF" />}
    >
      {error ? (
        <Text className="text-center text-sm text-destructive" style={{ fontFamily: 'Inter_400Regular' }}>{error}</Text>
      ) : loading ? (
        <ActivityIndicator color="#2963FF" />
      ) : items.length === 0 ? (
        <View className="items-center py-12">
          <Text className="text-sm text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>All clear — no pending proofs</Text>
        </View>
      ) : (
        items.map(item => (
          <QueueItem
            key={item.id}
            item={item}
            onApprove={() => approve(item.id)}
            onReject={() => reject(item.id)}
            busy={busy === item.id}
          />
        ))
      )}
    </ScrollView>
  )
}
