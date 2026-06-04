import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { formatPence, formatDate } from '@/lib/utils'
import type { AdminUser } from '@tcg-admin/types'
import { Search } from 'lucide-react'

export function UsersPage(): JSX.Element {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [suspendReason, setSuspendReason] = useState('')
  const [walletAmount, setWalletAmount] = useState('')
  const [walletNote, setWalletNote] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    adminApi.getUsers({ page, search: search || undefined })
      .then(({ users, total }) => { setUsers(users); setTotal(total) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [page, search])

  useEffect(() => { load() }, [load])

  async function handleSuspend() {
    if (!selected || !suspendReason.trim()) return
    setActionLoading(true); setActionError('')
    try {
      await adminApi.suspendUser(selected.id, suspendReason)
      setSelected(s => s ? { ...s, isSuspended: true } : s)
      setSuspendReason('')
      load()
    } catch (e) { setActionError((e as Error).message) }
    finally { setActionLoading(false) }
  }

  async function handleUnsuspend() {
    if (!selected) return
    setActionLoading(true); setActionError('')
    try {
      await adminApi.unsuspendUser(selected.id)
      setSelected(s => s ? { ...s, isSuspended: false } : s)
      load()
    } catch (e) { setActionError((e as Error).message) }
    finally { setActionLoading(false) }
  }

  async function handleWalletAdjust() {
    if (!selected || !walletAmount) return
    const pence = Math.round(parseFloat(walletAmount) * 100)
    if (isNaN(pence)) return
    setActionLoading(true); setActionError('')
    try {
      await adminApi.adjustWallet(selected.id, pence, walletNote || 'Admin adjustment')
      setSelected(s => s ? { ...s, walletBalance: s.walletBalance + pence } : s)
      setWalletAmount(''); setWalletNote('')
      load()
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
          <span className="text-sm text-muted-foreground">{total.toLocaleString()} total</span>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1) } }}
              placeholder="Search username / email…"
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => { setSearch(searchInput); setPage(1) }}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Search
          </button>
        </div>

        {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

        <div className="flex-1 overflow-y-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-card">
              <tr>
                {['Username', 'Email', 'Tier', 'Wallet', 'Status', 'Joined'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : users.map(u => (
                <tr
                  key={u.id}
                  onClick={() => { setSelected(u); setActionError('') }}
                  className={`cursor-pointer border-b border-border/40 transition-colors hover:bg-accent/40 ${selected?.id === u.id ? 'bg-accent/60' : ''}`}
                >
                  <td className="px-4 py-3 font-medium text-foreground">{u.username}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {u.subscriptionTier ?? 'Free'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{formatPence(u.walletBalance)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.isSuspended ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-400'}`}>
                      {u.isSuspended ? 'Suspended' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
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
            <Row label="Role" value={selected.role} />
            <Row label="Tier" value={selected.subscriptionTier ?? 'Free'} />
            <Row label="Wallet" value={formatPence(selected.walletBalance)} />
            <Row label="Verified" value={selected.isVerified ? 'Yes' : 'No'} />
            <Row label="Status" value={selected.isSuspended ? 'Suspended' : 'Active'} />
            <Row label="Joined" value={formatDate(selected.createdAt)} />
          </div>

          {actionError && <p className="mb-3 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{actionError}</p>}

          {/* Suspend / unsuspend */}
          <div className="mb-4 rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account status</p>
            {selected.isSuspended ? (
              <button
                onClick={handleUnsuspend}
                disabled={actionLoading}
                className="w-full rounded-md bg-green-500/20 px-3 py-2 text-xs font-medium text-green-400 hover:bg-green-500/30 disabled:opacity-50"
              >
                Unsuspend account
              </button>
            ) : (
              <>
                <input
                  value={suspendReason}
                  onChange={e => setSuspendReason(e.target.value)}
                  placeholder="Reason for suspension…"
                  className="mb-2 w-full rounded border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none"
                />
                <button
                  onClick={handleSuspend}
                  disabled={actionLoading || !suspendReason.trim()}
                  className="w-full rounded-md bg-destructive/20 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/30 disabled:opacity-50"
                >
                  Suspend account
                </button>
              </>
            )}
          </div>

          {/* Wallet adjustment */}
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Wallet adjustment</p>
            <input
              type="number"
              step="0.01"
              value={walletAmount}
              onChange={e => setWalletAmount(e.target.value)}
              placeholder="Amount in £ (negative to deduct)"
              className="mb-2 w-full rounded border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none"
            />
            <input
              value={walletNote}
              onChange={e => setWalletNote(e.target.value)}
              placeholder="Note (optional)"
              className="mb-2 w-full rounded border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none"
            />
            <button
              onClick={handleWalletAdjust}
              disabled={actionLoading || !walletAmount}
              className="w-full rounded-md bg-primary/20 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/30 disabled:opacity-50"
            >
              Apply adjustment
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
