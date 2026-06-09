import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { adminApi } from '../../src/lib/api'
import type { AdminUser } from '@tcg-admin/types'

// ── Row ────────────────────────────────────────────────────────────────────

function UserRow({
  user,
  onBan,
  onUnban,
  busy,
}: {
  user: AdminUser
  onBan: () => void
  onUnban: () => void
  busy: boolean
}) {
  return (
    <View className="mb-2 flex-row items-center rounded-xl border border-border bg-surface px-4 py-3">
      <View className="mr-3 flex-1">
        <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
          <Text
            className="text-sm font-semibold text-text"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            {user.username}
          </Text>
          {user.isAdmin && (
            <View className="rounded bg-accent/20 px-1.5 py-0.5">
              <Text
                className="text-[9px] font-bold text-accent"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                ADMIN
              </Text>
            </View>
          )}
          {user.isBanned && (
            <View className="rounded bg-destructive/20 px-1.5 py-0.5">
              <Text
                className="text-[9px] font-bold text-destructive"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                BANNED
              </Text>
            </View>
          )}
        </View>
        <Text
          className="mt-0.5 text-xs text-text-muted"
          style={{ fontFamily: 'Inter_400Regular' }}
          numberOfLines={1}
        >
          {user.email}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator size="small" color="#2963FF" />
      ) : user.isBanned ? (
        <TouchableOpacity
          className="rounded-lg bg-success/20 px-3 py-1.5"
          onPress={onUnban}
          activeOpacity={0.7}
        >
          <Text
            className="text-xs font-semibold text-success"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Unban
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          className="rounded-lg bg-destructive/20 px-3 py-1.5"
          onPress={onBan}
          disabled={user.isAdmin}
          activeOpacity={0.7}
        >
          <Text
            className="text-xs font-semibold text-destructive"
            style={{
              fontFamily: 'Inter_600SemiBold',
              opacity: user.isAdmin ? 0.4 : 1,
            }}
          >
            Ban
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function UsersScreen() {
  const [users, setUsers]     = useState<AdminUser[]>([])
  const [page, setPage]       = useState(1)
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [busy, setBusy]       = useState<string | null>(null)
  const [search, setSearch]   = useState('')
  const [query, setQuery]     = useState('')

  const load = useCallback(async (p: number, q: string, append = false) => {
    if (!append) setLoading(true)
    else setLoadingMore(true)
    try {
      const res = await adminApi.getUsers({ page: p, search: q || undefined })
      setUsers(prev => (append ? [...prev, ...res.users] : res.users))
      setTotal(res.total)
      setPage(p)
    } catch { /* ignore */ }
    finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // Reload whenever the committed query changes
  useEffect(() => { load(1, query) }, [load, query])

  const submitSearch = () => setQuery(search)
  const clearSearch  = () => { setSearch(''); setQuery('') }

  const ban = async (id: string) => {
    setBusy(id)
    try {
      await adminApi.suspendUser(id)
      setUsers(prev => prev.map(u => (u.id === id ? { ...u, isBanned: true } : u)))
    } catch { /* ignore */ }
    finally { setBusy(null) }
  }

  const unban = async (id: string) => {
    setBusy(id)
    try {
      await adminApi.unsuspendUser(id)
      setUsers(prev => prev.map(u => (u.id === id ? { ...u, isBanned: false } : u)))
    } catch { /* ignore */ }
    finally { setBusy(null) }
  }

  const hasMore = users.length < total

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 pt-4 pb-8"
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => load(1, query)}
          tintColor="#2963FF"
        />
      }
    >
      {/* Search bar */}
      <View className="mb-4 flex-row items-center rounded-xl border border-border bg-surface px-4">
        <TextInput
          className="flex-1 py-3 text-sm text-text"
          style={{ fontFamily: 'Inter_400Regular' }}
          placeholder="Search username or email…"
          placeholderTextColor="#8f98bc"
          autoCapitalize="none"
          autoCorrect={false}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={submitSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ color: '#8f98bc', fontSize: 18, lineHeight: 22 }}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator color="#2963FF" />
      ) : users.length === 0 ? (
        <View className="items-center py-12">
          <Text className="text-sm text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>
            {query ? 'No users match your search' : 'No users found'}
          </Text>
        </View>
      ) : (
        <>
          {users.map(user => (
            <UserRow
              key={user.id}
              user={user}
              onBan={() => ban(user.id)}
              onUnban={() => unban(user.id)}
              busy={busy === user.id}
            />
          ))}

          {hasMore && (
            <TouchableOpacity
              className="mt-4 items-center rounded-xl border border-border py-3"
              onPress={() => load(page + 1, query, true)}
              disabled={loadingMore}
              activeOpacity={0.7}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color="#2963FF" />
              ) : (
                <Text className="text-sm text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>
                  Load more
                </Text>
              )}
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>
  )
}
