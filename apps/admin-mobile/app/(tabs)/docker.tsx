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
import type { DockerService } from '@tcg-admin/types'

const STATUS_COLOR: Record<string, string> = {
  running:    '#22c55e',
  exited:     '#ef4444',
  paused:     '#f59e0b',
  restarting: '#f59e0b',
}

// ── Service row with expandable log panel ─────────────────────────────────

function ServiceRow({
  service,
  onAction,
  busy,
  expanded,
  onToggleLogs,
  logsText,
  logsLoading,
}: {
  service: DockerService
  onAction: (action: 'start' | 'stop' | 'restart') => void
  busy: boolean
  expanded: boolean
  onToggleLogs: () => void
  logsText?: string
  logsLoading: boolean
}) {
  const color = STATUS_COLOR[service.status ?? ''] ?? '#8f98bc'
  const isUp  = service.status === 'running'

  return (
    <View className="mb-2 overflow-hidden rounded-xl border border-border bg-surface">
      {/* Main row */}
      <View className="flex-row items-center px-4 py-3">
        <View className="mr-3 h-2 w-2 rounded-full" style={{ backgroundColor: color }} />

        {/* Name + status — tap to toggle logs */}
        <TouchableOpacity className="flex-1" onPress={onToggleLogs} activeOpacity={0.6}>
          <Text
            className="text-sm font-semibold text-text"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            {service.name}
          </Text>
          <Text
            className="text-xs capitalize text-text-muted"
            style={{ fontFamily: 'Inter_400Regular' }}
          >
            {service.status ?? 'unknown'}
            {service.health ? ` · ${service.health}` : ''}
            {'  '}
            <Text style={{ color: expanded ? '#2963FF' : '#5f6570', fontSize: 10 }}>
              {expanded ? '▲ logs' : '▼ logs'}
            </Text>
          </Text>
        </TouchableOpacity>

        {/* Action buttons */}
        {busy ? (
          <ActivityIndicator size="small" color="#2963FF" />
        ) : (
          <View className="flex-row gap-1.5">
            {!isUp && (
              <TouchableOpacity
                className="rounded-lg bg-success/20 px-3 py-1.5"
                onPress={() => onAction('start')}
                activeOpacity={0.7}
              >
                <Text
                  className="text-xs font-semibold text-success"
                  style={{ fontFamily: 'Inter_600SemiBold' }}
                >
                  Start
                </Text>
              </TouchableOpacity>
            )}
            {isUp && (
              <TouchableOpacity
                className="rounded-lg bg-warning/20 px-3 py-1.5"
                onPress={() => onAction('restart')}
                activeOpacity={0.7}
              >
                <Text
                  className="text-xs font-semibold text-warning"
                  style={{ fontFamily: 'Inter_600SemiBold' }}
                >
                  Restart
                </Text>
              </TouchableOpacity>
            )}
            {isUp && (
              <TouchableOpacity
                className="rounded-lg bg-destructive/20 px-3 py-1.5"
                onPress={() => onAction('stop')}
                activeOpacity={0.7}
              >
                <Text
                  className="text-xs font-semibold text-destructive"
                  style={{ fontFamily: 'Inter_600SemiBold' }}
                >
                  Stop
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Expandable log panel */}
      {expanded && (
        <View className="border-t border-border bg-background px-4 py-3">
          {logsLoading ? (
            <ActivityIndicator size="small" color="#2963FF" />
          ) : (
            <Text
              className="text-text-dim"
              style={{ fontFamily: 'monospace', fontSize: 9, lineHeight: 14 }}
              selectable
            >
              {logsText?.trim() || '(no output)'}
            </Text>
          )}
        </View>
      )}
    </View>
  )
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function DockerScreen() {
  const [services, setServices]   = useState<DockerService[]>([])
  const [loading, setLoading]     = useState(true)
  const [busy, setBusy]           = useState<string | null>(null)
  const [restartingAll, setRestartingAll] = useState(false)
  const [error, setError]         = useState('')

  // Logs state: name → last-50-line text
  const [expandedName, setExpandedName] = useState<string | null>(null)
  const [logCache, setLogCache]   = useState<Record<string, string>>({})
  const [logLoading, setLogLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await adminApi.getDockerServices()
      setServices(data)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load services')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const action = async (name: string, act: 'start' | 'stop' | 'restart') => {
    setBusy(name)
    try {
      await adminApi.dockerAction(name, act)
      // Clear cached logs so next expand fetches fresh output
      setLogCache(prev => { const c = { ...prev }; delete c[name]; return c })
      await load()
    } catch { /* ignore */ }
    finally { setBusy(null) }
  }

  const restartAll = async () => {
    setRestartingAll(true)
    try {
      await adminApi.dockerRestartAll()
      setLogCache({})
      await load()
    } catch { /* ignore */ }
    finally { setRestartingAll(false) }
  }

  const toggleLogs = async (name: string) => {
    if (expandedName === name) {
      setExpandedName(null)
      return
    }
    setExpandedName(name)
    if (logCache[name] !== undefined) return // already loaded

    setLogLoading(name)
    try {
      const res = await adminApi.getDockerLogs(name, 50)
      // Show last 40 lines to keep the panel manageable
      const trimmed = res.logs.split('\n').slice(-40).join('\n')
      setLogCache(prev => ({ ...prev, [name]: trimmed }))
    } catch (e: any) {
      setLogCache(prev => ({ ...prev, [name]: `Error: ${e?.message ?? 'failed to load logs'}` }))
    } finally {
      setLogLoading(null)
    }
  }

  const running = services.filter(s => s.status === 'running').length
  const total   = services.length

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 pt-4 pb-8"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#2963FF" />}
    >
      {/* Sub-header: service count + restart all */}
      {(total > 0 || restartingAll) && (
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-sm text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>
            {running}/{total} running
          </Text>

          {total > 0 && (
          <TouchableOpacity
            className="rounded-lg border border-border px-3 py-1.5"
            onPress={restartAll}
            disabled={restartingAll}
            activeOpacity={0.7}
          >
            {restartingAll ? (
              <ActivityIndicator size="small" color="#f59e0b" />
            ) : (
              <Text
                className="text-xs font-semibold text-warning"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                Restart All
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
      )}

      {error ? (
        <Text
          className="text-center text-sm text-destructive"
          style={{ fontFamily: 'Inter_400Regular' }}
        >
          {error}
        </Text>
      ) : loading ? (
        <ActivityIndicator color="#2963FF" />
      ) : (
        services.map(s => (
          <ServiceRow
            key={s.name}
            service={s}
            onAction={act => action(s.name, act)}
            busy={busy === s.name}
            expanded={expandedName === s.name}
            onToggleLogs={() => toggleLogs(s.name)}
            logsText={logCache[s.name]}
            logsLoading={logLoading === s.name}
          />
        ))
      )}
    </ScrollView>
  )
}
