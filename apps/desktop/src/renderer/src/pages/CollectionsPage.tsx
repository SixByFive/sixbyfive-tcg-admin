import { useEffect, useState } from 'react'
import { adminApi } from '@/lib/api'
import type { UserCollectionSummary } from '@tcg-admin/types'

export function CollectionsPage(): JSX.Element {
  const [rows, setRows]       = useState<UserCollectionSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [draft, setDraft]     = useState('')
  const [search, setSearch]   = useState('')

  const load = (searchVal = search) => {
    setLoading(true); setError('')
    adminApi.getUserCollections({ limit: 200, search: searchVal || undefined })
      .then(setRows)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load('') }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(draft.trim())
    load(draft.trim())
  }

  const maxCards = Math.max(...rows.map(r => r.totalCards ?? 0), 1)

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">Collections</h1>
        <span className="text-sm text-muted-foreground">
          {loading ? 'Loading…' : `${rows.length} user${rows.length !== 1 ? 's' : ''}${search ? ` matching "${search}"` : ' (up to 200)'}`}
        </span>
      </div>

      <form onSubmit={handleSearch} className="mb-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Search username or email…"
          className="w-56 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button type="submit" className="rounded-md bg-accent px-3 py-2 text-sm text-foreground hover:bg-accent/80">Search</button>
        <button type="button" onClick={() => load()} disabled={loading} className="rounded-md bg-accent px-3 py-2 text-sm text-foreground hover:bg-accent/80 disabled:opacity-50">Refresh</button>
      </form>

      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-card">
            <tr>
              {['User', 'Email', 'Total cards', 'Distinct cards', 'Size'].map(h => (
                <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${h === 'Total cards' || h === 'Distinct cards' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No collections found.</td></tr>
            ) : rows.map(r => {
              const pct = Math.round(((r.totalCards ?? 0) / maxCards) * 100)
              return (
                <tr key={r.userId} className="border-b border-border/40 hover:bg-accent/30">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{r.username || '—'}</p>
                    <p className="font-mono text-xs text-muted-foreground">{r.userId.slice(0,8)}…</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.email || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">{(r.totalCards ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{(r.distinctCards ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full bg-primary/50" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-right text-xs text-muted-foreground tabular-nums">{pct}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
