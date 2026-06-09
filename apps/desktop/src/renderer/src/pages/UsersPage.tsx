import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import type { AdminUser } from '@tcg-admin/types'
import { Search } from 'lucide-react'

export function UsersPage(): JSX.Element {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [banReason, setBanReason] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    adminApi.getUsers({ page })
      .then(({ users, total }) => { setUsers(users); setTotal(total) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { load() }, [load])

  async function handleBan() {
    if (!selected) return
    setActionLoading(true); setActionError('')
    try {
      await adminApi.suspendUser(selected.id)
      setSelected(s => s ? { ...s, isBanned: true } : s)
      setBanReason('')
      load()
    } catch (e) { setActionError((e as Error).message) }
    finally { setActionLoading(false) }
  }

  async function handleUnban() {
    if (!selected) return
    setActionLoading(true); setActionError('')
    try {
      await adminApi.unsuspendUser(selected.id)
      setSelected(s => s ? { ...s, isBanned: false } : s)
      load()
    } catch (e) { setActionError((e as Error).message) }
    finally { setActionLoading(false) }
  }

  async function handleClearBrute() {
    if (!selected) return
    setActionLoading(true); setActionError('')
    try {
      await adminApi.clearLoginBrute(selected.email)
    } catch (e) { setActionError((e as Error).message) }
    finally { setActionLoading(false) }
  }

  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex h-full gap-5">
      {/* List */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <span className="text-sm text-muted-foreground">{total.toLocaleString()}+ loaded</span>
        </div>

        {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

        <div className="flex-1 overflow-y-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-card">
              <tr>
                {['Username', 'Email', 'Verified', 'Role', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : users.map(u => (
                <tr
                  key={u.id}
                  onClick={() => { setSelected(u); setActionError('') }}
                  className={`cursor-pointer border-b border-border/40 transition-colors hover:bg-accent/40 ${selected?.id === u.id ? 'bg-accent/60' : ''}`}
                >
                  <td className="px-4 py-3 font-medium text-foreground">{u.username}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.emailVerified ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                      {u.emailVerified ? 'Verified' : 'Unverified'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.isAdmin ? 'bg-primary/10 text-primary' : 'bg-accent text-muted-foreground'}`}>
                      {u.isAdmin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.isBanned ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-400'}`}>
                      {u.isBanned ? 'Banned' : 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded px-2 py-1 hover:bg-accent disabled:opacity-40">← Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded px-2 py-1 hover:bg-accent disabled:opacity-40">Next →</button>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-72 shrink-0 overflow-y-auto rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-base font-bold text-foreground">{selected.username}</h2>

          <div className="mb-4 flex flex-col gap-1.5 text-sm">
            <Row label="Email" value={selected.email} />
            <Row label="Role" value={selected.isAdmin ? 'Admin' : 'User'} />
            <Row label="Verified" value={selected.emailVerified ? 'Yes' : 'No'} />
            <Row label="Status" value={selected.isBanned ? 'Banned' : 'Active'} />
          </div>

          {actionError && <p className="mb-3 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{actionError}</p>}

          {/* Ban / unban */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account status</p>
            {selected.isBanned ? (
              <button
                onClick={handleUnban}
                disabled={actionLoading}
                className="w-full rounded-md bg-green-500/20 px-3 py-2 text-xs font-medium text-green-400 hover:bg-green-500/30 disabled:opacity-50"
              >
                Unban account
              </button>
            ) : (
              <button
                onClick={handleBan}
                disabled={actionLoading}
                className="w-full rounded-md bg-destructive/20 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/30 disabled:opacity-50"
              >
                Ban account
              </button>
            )}
          </div>

          {/* Login rate-limit */}
          <div className="mt-3 rounded-lg border border-border p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Login rate-limit</p>
            <p className="mb-2 text-xs text-muted-foreground">Clear if user is locked out with 429 Too Many Requests.</p>
            <button
              onClick={handleClearBrute}
              disabled={actionLoading}
              className="w-full rounded-md bg-amber-500/20 px-3 py-2 text-xs font-medium text-amber-400 hover:bg-amber-500/30 disabled:opacity-50"
            >
              Unlock login
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
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}
