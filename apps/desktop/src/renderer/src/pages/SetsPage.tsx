import { useEffect, useState, useCallback, useRef } from 'react'
import { adminApi, saveAdminApiKey } from '@/lib/api'
import type { CatalogSet, IngestResult } from '@tcg-admin/types'

const hasStoredKey = (): boolean =>
  !!(import.meta.env.VITE_ADMIN_API_KEY || localStorage.getItem('adminApiKey'))

export function SetsPage(): JSX.Element {
  const [sets, setSets]       = useState<CatalogSet[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [q, setQ]             = useState('')
  const [draftQ, setDraftQ]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // Admin key entry (hidden when already stored)
  const [adminKey, setAdminKey] = useState('')
  const [keyApplied, setKeyApplied] = useState(hasStoredKey)

  // Single ingest
  const [ingestCode, setIngestCode]       = useState('')
  const [ingestRefresh, setIngestRefresh] = useState(false)
  const [ingestDryRun, setIngestDryRun]   = useState(false)
  const [ingesting, setIngesting]         = useState(false)
  const [ingestResult, setIngestResult]   = useState<IngestResult | null>(null)
  const [ingestErr, setIngestErr]         = useState('')

  // Ingest-all
  const [ingestingAll, setIngestingAll]         = useState(false)
  const [ingestAllRefresh, setIngestAllRefresh] = useState(false)
  const [ingestAllDryRun, setIngestAllDryRun]   = useState(false)
  const [ingestAllResults, setIngestAllResults] = useState<IngestResult[]>([])

  // Price collection
  const [priceSet, setPriceSet]     = useState('')
  const [priceDry, setPriceDry]     = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [collectResult, setCollectResult] = useState<unknown>(null)
  const [collectErr, setCollectErr] = useState('')

  // Toggling
  const [toggling, setToggling] = useState<string | null>(null)
  const [ensuringTasks, setEnsuringTasks] = useState<string | null>(null)

  const PAGE_SIZE = 50

  const load = useCallback(() => {
    setLoading(true); setError('')
    adminApi.getCatalogSets({ q: q || undefined, page, pageSize: PAGE_SIZE })
      .then(({ sets, total }) => { setSets(sets); setTotal(total) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [q, page])

  useEffect(() => { load() }, [load])

  const applyKey = () => {
    if (!adminKey.trim()) return
    saveAdminApiKey(adminKey.trim())
    setKeyApplied(true)
    load()
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setQ(draftQ.trim())
    setPage(1)
  }

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ingestCode.trim()) return
    setIngesting(true); setIngestErr(''); setIngestResult(null)
    try {
      const result = await adminApi.ingestSet(ingestCode.trim(), { refresh: ingestRefresh, dryRun: ingestDryRun })
      setIngestResult(result)
      if (!ingestDryRun) load()
    } catch (e) { setIngestErr((e as Error).message) }
    finally { setIngesting(false) }
  }

  const handleIngestAll = async () => {
    setIngestingAll(true); setIngestAllResults([])
    try {
      const results = await adminApi.ingestAll({ refresh: ingestAllRefresh, dryRun: ingestAllDryRun })
      setIngestAllResults(results)
      if (!ingestAllDryRun) load()
    } catch (e) { setIngestAllResults([{ ok: false, error: (e as Error).message }]) }
    finally { setIngestingAll(false) }
  }

  const handleCollect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!priceSet.trim()) return
    setCollecting(true); setCollectErr(''); setCollectResult(null)
    try {
      const result = await adminApi.collectPrices({ set: priceSet.trim(), dryRun: priceDry })
      setCollectResult(result)
    } catch (e) { setCollectErr((e as Error).message) }
    finally { setCollecting(false) }
  }

  const handleToggle = async (set: CatalogSet) => {
    setToggling(set.code)
    try {
      await adminApi.toggleCatalogSet(set.code)
      load()
    } catch (e) { setError((e as Error).message) }
    finally { setToggling(null) }
  }

  const handleEnsureTasks = async (code: string) => {
    setEnsuringTasks(code)
    try {
      await adminApi.ensureSetTasks(code)
      alert(`Scheduler tasks ensured for set ${code}`)
    } catch (e) { setError((e as Error).message) }
    finally { setEnsuringTasks(null) }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const ingestAllDone   = ingestAllResults.find(r => r.done)
  const ingestAllFailed = ingestAllResults.filter(r => !r.ok && !r.done)
  const ingestAllOk     = ingestAllResults.filter(r => r.ok)

  const inputCls  = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary'
  const btnCls    = 'rounded-md bg-accent px-3 py-2 text-sm text-foreground hover:bg-accent/80 disabled:opacity-50'
  const btnPrimary = 'rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Set Ingestion</h1>
        <p className="text-sm text-muted-foreground">Browse catalog sets, trigger ingestion jobs, and manage price collection.</p>
      </div>

      {/* Admin key banner */}
      {!keyApplied && !import.meta.env.VITE_ADMIN_API_KEY && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-400">Admin API key required</p>
          <p className="text-xs text-amber-300/80">Catalog service admin endpoints require <code className="font-mono bg-amber-500/20 px-1 rounded">x-admin-key</code>. Enter the key below or set <code className="font-mono bg-amber-500/20 px-1 rounded">VITE_ADMIN_API_KEY</code> in your .env.</p>
          <div className="flex gap-2">
            <input
              value={adminKey}
              onChange={e => setAdminKey(e.target.value)}
              type="password"
              placeholder="ADMIN_API_KEY value…"
              className="flex-1 rounded-md border border-amber-500/40 bg-background px-3 py-2 text-sm text-foreground outline-none"
            />
            <button onClick={applyKey} disabled={!adminKey.trim()} className={btnPrimary}>Apply</button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* ── Ingest single set ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Ingest single set</h2>
        <p className="text-xs text-muted-foreground">Enter a set code or TCGdex identifier (e.g. <code className="font-mono">sv01</code>, <code className="font-mono">base1</code>).</p>
        <form onSubmit={handleIngest} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 flex-1 min-w-32">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Set code *</label>
            <input required value={ingestCode} onChange={e => setIngestCode(e.target.value)} placeholder="sv01" className={inputCls} />
          </div>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={ingestRefresh} onChange={e => setIngestRefresh(e.target.checked)} className="rounded" />
            Refresh existing
          </label>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={ingestDryRun} onChange={e => setIngestDryRun(e.target.checked)} className="rounded" />
            Dry run
          </label>
          <button type="submit" disabled={ingesting} className={btnPrimary}>
            {ingesting ? 'Ingesting…' : 'Ingest'}
          </button>
        </form>
        {ingestErr && <p className="text-sm text-destructive">{ingestErr}</p>}
        {ingestResult && (
          <div className={`rounded-lg border p-3 text-sm ${ingestResult.ok ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>
            {ingestResult.ok
              ? `✓ Ingested set ${ingestResult.setCode ?? ingestCode}${ingestResult.counts ? ` — ${JSON.stringify(ingestResult.counts)}` : ''}`
              : `✗ ${ingestResult.error ?? 'Unknown error'}`}
          </div>
        )}
      </div>

      {/* ── Ingest all sets ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Ingest all sets</h2>
        <p className="text-xs text-muted-foreground">Runs ingestion for every known set sequentially. May take several minutes.</p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={ingestAllRefresh} onChange={e => setIngestAllRefresh(e.target.checked)} className="rounded" />
            Refresh existing
          </label>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={ingestAllDryRun} onChange={e => setIngestAllDryRun(e.target.checked)} className="rounded" />
            Dry run
          </label>
          <button
            onClick={handleIngestAll}
            disabled={ingestingAll}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {ingestingAll ? 'Running — please wait…' : 'Ingest all sets'}
          </button>
        </div>
        {ingestAllResults.length > 0 && (
          <div className="rounded-lg border border-border bg-background p-3 space-y-1 max-h-48 overflow-y-auto">
            {ingestAllDone && (
              <p className="text-sm font-semibold text-foreground mb-2">
                Done: {ingestAllDone.succeeded ?? 0} succeeded, {ingestAllDone.failed ?? 0} failed out of {ingestAllDone.total ?? 0}
              </p>
            )}
            {ingestAllFailed.map((r, i) => (
              <p key={i} className="font-mono text-xs text-destructive">✗ {r.code ?? '?'}: {r.error}</p>
            ))}
            {ingestAllOk.slice(0, 10).map((r, i) => (
              <p key={i} className="font-mono text-xs text-green-400">✓ {r.code}: {r.cards != null ? `${r.cards} cards` : 'ok'}</p>
            ))}
            {ingestAllOk.length > 10 && (
              <p className="text-xs text-muted-foreground">…and {ingestAllOk.length - 10} more successful</p>
            )}
          </div>
        )}
      </div>

      {/* ── Price collection ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Collect prices</h2>
        <form onSubmit={handleCollect} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 flex-1 min-w-32">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Set code *</label>
            <input required value={priceSet} onChange={e => setPriceSet(e.target.value)} placeholder="sv01" className={inputCls} />
          </div>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={priceDry} onChange={e => setPriceDry(e.target.checked)} className="rounded" />
            Dry run
          </label>
          <button type="submit" disabled={collecting} className={btnPrimary}>
            {collecting ? 'Collecting…' : 'Collect prices'}
          </button>
        </form>
        {collectErr && <p className="text-sm text-destructive">{collectErr}</p>}
        {collectResult && (
          <pre className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground overflow-x-auto">
            {JSON.stringify(collectResult, null, 2)}
          </pre>
        )}
      </div>

      {/* ── Sets table ── */}
      <div>
        <form onSubmit={handleSearch} className="mb-3 flex items-center gap-2">
          <input
            value={draftQ}
            onChange={e => setDraftQ(e.target.value)}
            placeholder="Search sets by code or name…"
            className="w-56 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button type="submit" className={btnCls}>Search</button>
          {q && <button type="button" onClick={() => { setDraftQ(''); setQ(''); setPage(1) }} className={btnCls}>Clear</button>}
          <button type="button" onClick={load} disabled={loading} className={`ml-auto ${btnCls}`}>Refresh</button>
        </form>

        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-card">
              <tr>
                {['Code', 'Name', 'Era', 'Release', 'Cards', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : sets.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No sets found.</td></tr>
              ) : sets.map(s => (
                <tr key={s.code} className="border-b border-border/40 hover:bg-accent/30">
                  <td className="px-4 py-3 font-mono font-semibold text-foreground">{s.code}</td>
                  <td className="px-4 py-3 text-foreground">{s.name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{s.era ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{s.release_date?.slice(0, 10) ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums text-xs">
                    {s.total_cards ?? '—'}{s.official_count ? ` / ${s.official_count}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.enabled !== false ? 'bg-green-500/10 text-green-400' : 'bg-accent text-muted-foreground'}`}>
                      {s.enabled !== false ? 'enabled' : 'disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button
                        disabled={toggling === s.code}
                        onClick={() => handleToggle(s)}
                        className="rounded px-2 py-1 text-xs border border-border text-muted-foreground hover:bg-accent disabled:opacity-50"
                      >
                        {toggling === s.code ? '…' : s.enabled !== false ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        disabled={ensuringTasks === s.code}
                        onClick={() => handleEnsureTasks(s.code)}
                        className="rounded px-2 py-1 text-xs border border-border text-muted-foreground hover:bg-accent disabled:opacity-50"
                      >
                        {ensuringTasks === s.code ? '…' : 'Tasks'}
                      </button>
                      <button
                        onClick={() => { setIngestCode(s.code); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                        className="rounded px-2 py-1 text-xs border border-primary/40 text-primary hover:bg-primary/10"
                      >
                        Ingest
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} sets total — page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded px-2 py-1 hover:bg-accent disabled:opacity-40">← Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded px-2 py-1 hover:bg-accent disabled:opacity-40">Next →</button>
          </div>
        </div>
      </div>
    </div>
  )
}
