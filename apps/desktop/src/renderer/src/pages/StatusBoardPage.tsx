import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, Plus, Trash2, Globe, Network, X, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/context/PermissionsContext'

interface StatusTarget {
  id: string
  label: string
  type: 'http' | 'tcp'
  url?: string
  host?: string
  port?: number
  degradedThresholdMs?: number
  permission?: string  // if set, only users with this permission can see the target
}

interface ServiceStatus {
  targetId: string
  state: 'up' | 'degraded' | 'down'
  responseMs: number
  statusCode: number | null
  checkedAt: string
  error: string | null
}

const STATE = {
  up:       { dot: 'bg-green-500',              badge: 'text-green-600 bg-green-500/10',  label: 'UP' },
  degraded: { dot: 'bg-amber-500',              badge: 'text-amber-600 bg-amber-500/10',  label: 'DEGRADED' },
  down:     { dot: 'bg-red-500',                badge: 'text-red-600   bg-red-500/10',    label: 'DOWN' },
  unknown:  { dot: 'bg-muted-foreground/30',    badge: 'text-muted-foreground bg-muted',  label: '—' },
}

const INTERVALS = [
  { label: '30s', ms: 30_000 },
  { label: '1m',  ms: 60_000 },
  { label: '5m',  ms: 300_000 },
  { label: 'Off', ms: 0 },
]

const PERMISSION_OPTIONS = [
  { value: '',              label: 'Everyone' },
  { value: 'tcg',          label: 'TCG Admin' },
  { value: 'tcg.financial',label: 'TCG Financial' },
  { value: 'kora',         label: 'Kora Admin' },
  { value: 'vl',           label: 'Vision Lab' },
  { value: '*',            label: 'Super admin only' },
]

function formatAge(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 5)  return 'just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

const statusAPI = (window as any).statusBoard as {
  getTargets:   () => Promise<StatusTarget[]>
  checkAll:     () => Promise<ServiceStatus[]>
  saveTarget:   (t: StatusTarget) => Promise<{ ok: boolean }>
  deleteTarget: (id: string)      => Promise<{ ok: boolean }>
}

const EMPTY_FORM: Partial<StatusTarget> = { label: '', type: 'http', url: '', host: '', port: 22, permission: '' }

export function StatusBoardPage(): JSX.Element {
  const { can } = usePermissions()
  const [targets, setTargets]     = useState<StatusTarget[]>([])
  const [results, setResults]     = useState<Map<string, ServiceStatus>>(new Map())
  const [checking, setChecking]   = useState(false)
  const [intervalMs, setIntervalMs] = useState(60_000)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState<Partial<StatusTarget>>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const ageTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [, forceRender]           = useState(0)

  const loadTargets = useCallback(async () => {
    try {
      if (!statusAPI) throw new Error('window.status not exposed — preload may not have loaded')
      const t = await statusAPI.getTargets()
      if (!Array.isArray(t)) throw new Error(`getTargets returned unexpected value: ${JSON.stringify(t)}`)
      setTargets(t)
      setLoadError(null)
      return t
    } catch (err) {
      const msg = (err as Error).message
      console.error('[StatusBoard] loadTargets failed:', msg)
      setLoadError(msg)
      return []
    }
  }, [])

  const runCheck = useCallback(async () => {
    setChecking(true)
    try {
      const raw = await statusAPI.checkAll()
      setResults(new Map(raw.map(r => [r.targetId, r])))
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    loadTargets().then(() => runCheck())
  }, [])

  // Auto-refresh
  useEffect(() => {
    if (!intervalMs) return
    const id = setInterval(runCheck, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, runCheck])

  // Re-render every 5s so "X ago" labels stay fresh
  useEffect(() => {
    ageTimer.current = setInterval(() => forceRender(n => n + 1), 5000)
    return () => { if (ageTimer.current) clearInterval(ageTimer.current) }
  }, [])

  function openAdd() {
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(target: StatusTarget) {
    setForm({ ...target })
    setShowModal(true)
  }

  async function handleSaveTarget() {
    if (!form.label?.trim()) return
    if (form.type === 'http' && !form.url?.trim()) return
    if (form.type === 'tcp'  && (!form.host?.trim() || !form.port)) return
    setSaving(true)
    try {
      await statusAPI.saveTarget({ ...form, id: form.id ?? '' } as StatusTarget)
      await loadTargets()
      setShowModal(false)
      setForm(EMPTY_FORM)
      runCheck()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await statusAPI.deleteTarget(id)
    await loadTargets()
    setResults(prev => { const m = new Map(prev); m.delete(id); return m })
  }

  // Filter targets the current user is allowed to see
  const visibleTargets = targets.filter(t => !t.permission || can(t.permission))

  const upCount   = [...results.values()].filter(r => r.state === 'up').length
  const downCount = [...results.values()].filter(r => r.state === 'down').length

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Status Board</h1>
          {results.size > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {upCount} up · {downCount} down · {results.size - upCount - downCount} degraded
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Interval selector */}
          <div className="flex items-center rounded-md border border-border bg-background">
            {INTERVALS.map(({ label, ms }) => (
              <button
                key={label}
                onClick={() => setIntervalMs(ms)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md',
                  intervalMs === ms
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => runCheck()}
            disabled={checking}
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', checking && 'animate-spin')} />
            Check now
          </button>

          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Add target
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {visibleTargets.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            {loadError ? (
              <>
                <p className="text-sm font-medium text-destructive">Failed to load targets</p>
                <p className="max-w-sm text-center text-xs text-muted-foreground">{loadError}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No targets configured.</p>
            )}
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {visibleTargets.map(target => {
              const result = results.get(target.id)
              const s = STATE[result?.state ?? 'unknown']

              return (
                <div
                  key={target.id}
                  className="group relative rounded-lg border border-border bg-card p-4"
                >
                  {/* Action buttons */}
                  <div className="absolute right-3 top-3 hidden items-center gap-1 group-hover:flex">
                    <button
                      onClick={() => openEdit(target)}
                      className="rounded p-1 text-muted-foreground/40 transition-colors hover:bg-accent/50 hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(target.id)}
                      className="rounded p-1 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-start gap-3">
                    {/* Pulse dot */}
                    <div className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                      {result?.state === 'up' && (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-20" />
                      )}
                      <span className={cn('h-2.5 w-2.5 rounded-full', s.dot)} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{target.label}</p>
                        <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', s.badge)}>
                          {s.label}
                        </span>
                      </div>

                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {target.type === 'http'
                          ? target.url
                          : `${target.host}:${target.port}`}
                      </p>

                      {result ? (
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                          {result.responseMs !== undefined && (
                            <span className={cn(
                              'font-medium',
                              result.state === 'up'       ? 'text-green-600' :
                              result.state === 'degraded' ? 'text-amber-600' : 'text-red-600'
                            )}>
                              {result.responseMs}ms
                            </span>
                          )}
                          <span>· {formatAge(result.checkedAt)}</span>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {checking ? 'Checking…' : 'Not checked yet'}
                        </p>
                      )}

                      {result?.error && (
                        <p className="mt-1.5 truncate text-xs text-destructive" title={result.error}>
                          {result.error}
                        </p>
                      )}
                    </div>

                    {/* Type icon */}
                    <div className="shrink-0 text-muted-foreground/30">
                      {target.type === 'http' ? <Globe className="h-3.5 w-3.5" /> : <Network className="h-3.5 w-3.5" />}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add / edit target modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">{form.id ? 'Edit target' : 'Add target'}</h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Label</label>
                <input
                  autoFocus
                  value={form.label ?? ''}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="My Service"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Type</label>
                <div className="flex gap-2">
                  {(['http', 'tcp'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setForm(f => ({ ...f, type: t }))}
                      className={cn(
                        'flex-1 rounded-md border py-1.5 text-xs font-medium uppercase transition-colors',
                        form.type === t
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {form.type === 'http' ? (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">URL</label>
                  <input
                    value={form.url ?? ''}
                    onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                    placeholder="https://example.com/health"
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="flex flex-1 flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Host</label>
                    <input
                      value={form.host ?? ''}
                      onChange={e => setForm(f => ({ ...f, host: e.target.value }))}
                      placeholder="192.168.1.10"
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div className="flex w-20 flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Port</label>
                    <input
                      type="number"
                      value={form.port ?? 22}
                      onChange={e => setForm(f => ({ ...f, port: Number(e.target.value) }))}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Visible to</label>
                <select
                  value={form.permission ?? ''}
                  onChange={e => setForm(f => ({ ...f, permission: e.target.value }))}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                >
                  {PERMISSION_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="mt-1 flex gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-md border border-border py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTarget}
                  disabled={saving}
                  className="flex-1 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {saving ? 'Saving…' : form.id ? 'Save changes' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
