import { useEffect, useState, useCallback } from 'react'
import { adminApi, saveAdminApiKey } from '@/lib/api'
import type { SchedulerTask, ServiceHealthEntry } from '@tcg-admin/types'

const hasStoredKey = (): boolean =>
  !!(import.meta.env.VITE_ADMIN_API_KEY || localStorage.getItem('adminApiKey'))

type JobStatus = 'idle' | 'running' | 'ok' | 'error'

interface JobState { status: JobStatus; result?: unknown; error?: string }

function useJob(): [JobState, (fn: () => Promise<unknown>) => void] {
  const [state, setState] = useState<JobState>({ status: 'idle' })
  const run = useCallback((fn: () => Promise<unknown>) => {
    setState({ status: 'running' })
    fn()
      .then(result => setState({ status: 'ok', result }))
      .catch(e  => setState({ status: 'error', error: (e as Error).message }))
  }, [])
  return [state, run]
}

const statusDot = (s: string | undefined) => {
  if (!s || s === 'loading') return 'bg-accent text-muted-foreground'
  if (s === 'ok')            return 'bg-green-500/10 text-green-400'
  return                            'bg-destructive/10 text-destructive'
}

export function ServicesPage(): JSX.Element {
  // Admin key
  const [adminKey, setAdminKey]   = useState('')
  const [keyApplied, setKeyApplied] = useState(hasStoredKey)

  // Health
  const [health, setHealth]         = useState<{ gateway?: ServiceHealthEntry; auth?: unknown; catalog?: unknown } | null>(null)
  const [healthLoading, setHL]      = useState(false)
  const [healthErr, setHealthErr]   = useState('')

  // Scheduler
  const [tasks, setTasks]         = useState<SchedulerTask[]>([])
  const [tasksLoading, setTL]     = useState(false)
  const [tasksErr, setTasksErr]   = useState('')
  const [taskAction, setTaskAction] = useState<Record<string, 'running' | null>>({})

  // Ad-hoc jobs
  const [fxJob,      runFx]      = useJob()
  const [rollupJob,  runRollup]  = useJob()
  const [seedJob,    runSeed]    = useJob()

  // FX rollup options
  const [rollupScope, setRollupScope] = useState<'all' | 'set'>('all')
  const [rollupSet,   setRollupSet]   = useState('')

  const loadHealth = useCallback(() => {
    setHL(true); setHealthErr('')
    adminApi.getServiceHealth()
      .then(setHealth)
      .catch(e => setHealthErr(e.message))
      .finally(() => setHL(false))
  }, [])

  const loadTasks = useCallback(() => {
    setTL(true); setTasksErr('')
    adminApi.getSchedulerTasks()
      .then(setTasks)
      .catch(e => setTasksErr(e.message))
      .finally(() => setTL(false))
  }, [])

  useEffect(() => { loadHealth() }, [loadHealth])

  const applyKey = () => {
    if (!adminKey.trim()) return
    saveAdminApiKey(adminKey.trim())
    setKeyApplied(true)
    loadTasks()
  }

  const doTaskAction = async (id: string, action: 'run' | 'pause' | 'resume') => {
    setTaskAction(prev => ({ ...prev, [id]: 'running' }))
    try {
      if (action === 'run')     await adminApi.runSchedulerTask(id)
      if (action === 'pause')   await adminApi.pauseSchedulerTask(id)
      if (action === 'resume')  await adminApi.resumeSchedulerTask(id)
      await loadTasks()
    } catch (e) {
      setTasksErr((e as Error).message)
    } finally {
      setTaskAction(prev => ({ ...prev, [id]: null }))
    }
  }

  const inputCls   = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary'
  const btnCls     = 'rounded-md bg-accent px-3 py-2 text-sm text-foreground hover:bg-accent/80 disabled:opacity-50'
  const btnPrimary = 'rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50'

  const renderJobResult = (job: JobState) => {
    if (job.status === 'idle')    return null
    if (job.status === 'running') return <p className="text-xs text-muted-foreground">Running…</p>
    if (job.status === 'error')   return <p className="text-xs text-destructive">{job.error}</p>
    return (
      <pre className="rounded-lg border border-border bg-background p-2 text-xs text-muted-foreground overflow-x-auto max-h-28">
        {typeof job.result === 'string' ? job.result : JSON.stringify(job.result, null, 2)}
      </pre>
    )
  }

  // Health entries to display
  const healthEntries = health ? [
    { label: 'Gateway', val: health.gateway },
    { label: 'Auth',    val: health.auth },
    { label: 'Catalog', val: health.catalog },
  ] : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Services</h1>
        <p className="text-sm text-muted-foreground">Health status, scheduler management, and manual job triggers.</p>
      </div>

      {/* Admin key */}
      {!keyApplied && !import.meta.env.VITE_ADMIN_API_KEY && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-400">Admin API key required for scheduler controls</p>
          <p className="text-xs text-amber-300/80">Scheduler endpoints need <code className="font-mono bg-amber-500/20 px-1 rounded">x-admin-key</code>. Enter below or set <code className="font-mono bg-amber-500/20 px-1 rounded">VITE_ADMIN_API_KEY</code> in .env.</p>
          <div className="flex gap-2">
            <input value={adminKey} onChange={e => setAdminKey(e.target.value)} type="password" placeholder="ADMIN_API_KEY…" className="flex-1 rounded-md border border-amber-500/40 bg-background px-3 py-2 text-sm text-foreground outline-none" />
            <button onClick={applyKey} disabled={!adminKey.trim()} className={btnPrimary}>Apply</button>
          </div>
        </div>
      )}

      {/* ── Health status ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Service health</h2>
          <button onClick={loadHealth} disabled={healthLoading} className={btnCls}>
            {healthLoading ? 'Checking…' : 'Refresh'}
          </button>
        </div>
        {healthErr && <p className="text-sm text-destructive">{healthErr}</p>}
        <div className="grid grid-cols-3 gap-3">
          {healthLoading ? (
            ['Gateway', 'Auth', 'Catalog'].map(l => (
              <div key={l} className="rounded-lg border border-border p-3 animate-pulse">
                <p className="text-xs font-semibold text-muted-foreground mb-1">{l}</p>
                <div className="h-4 w-16 rounded bg-accent" />
              </div>
            ))
          ) : healthEntries.map(({ label, val }) => {
            const entry = val as any
            const status = entry?.status ?? (val ? 'ok' : 'unknown')
            return (
              <div key={label} className="rounded-lg border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{label}</p>
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusDot(status)}`}>
                  {status}
                </span>
                {entry?.service && <p className="mt-1 text-xs text-muted-foreground">{entry.service}</p>}
                {entry?.error   && <p className="mt-1 text-xs text-destructive truncate">{entry.error}</p>}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Ad-hoc jobs ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <h2 className="text-sm font-semibold text-foreground">Manual jobs</h2>

        {/* FX daily */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">FX rates update</p>
              <p className="text-xs text-muted-foreground">Fetch latest GBP exchange rates from the provider.</p>
            </div>
            <button
              onClick={() => runFx(() => adminApi.fxDaily())}
              disabled={fxJob.status === 'running'}
              className={btnPrimary}
            >
              {fxJob.status === 'running' ? 'Running…' : 'Run now'}
            </button>
          </div>
          {renderJobResult(fxJob)}
        </div>

        <div className="border-t border-border" />

        {/* Rollups */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Rebuild price rollups</p>
              <p className="text-xs text-muted-foreground">Re-aggregate weekly/monthly price rollups.</p>
            </div>
            <button
              onClick={() => runRollup(() => adminApi.rebuildRollups({ scope: rollupScope, set: rollupScope === 'set' && rollupSet ? rollupSet : undefined }))}
              disabled={rollupJob.status === 'running'}
              className={btnPrimary}
            >
              {rollupJob.status === 'running' ? 'Running…' : 'Run now'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
              <input type="radio" name="rscope" value="all" checked={rollupScope === 'all'} onChange={() => setRollupScope('all')} />
              All sets
            </label>
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
              <input type="radio" name="rscope" value="set" checked={rollupScope === 'set'} onChange={() => setRollupScope('set')} />
              Single set
            </label>
            {rollupScope === 'set' && (
              <input value={rollupSet} onChange={e => setRollupSet(e.target.value)} placeholder="Set code" className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground outline-none w-28" />
            )}
          </div>
          {renderJobResult(rollupJob)}
        </div>

        <div className="border-t border-border" />

        {/* Seed scheduler */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Seed standard scheduler tasks</p>
              <p className="text-xs text-muted-foreground">Idempotent — ensures default cron tasks exist (nightly ingest, price collect, etc.).</p>
            </div>
            <button
              onClick={() => runSeed(() => adminApi.seedScheduler())}
              disabled={seedJob.status === 'running'}
              className={btnPrimary}
            >
              {seedJob.status === 'running' ? 'Seeding…' : 'Seed tasks'}
            </button>
          </div>
          {renderJobResult(seedJob)}
        </div>
      </div>

      {/* ── Scheduler task list ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Scheduled tasks</h2>
          <button
            onClick={loadTasks}
            disabled={tasksLoading}
            className={btnCls}
          >
            {tasksLoading ? 'Loading…' : tasks.length ? 'Refresh' : 'Load tasks'}
          </button>
        </div>
        {tasksErr && <p className="text-sm text-destructive">{tasksErr}</p>}

        {tasks.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-card">
                <tr>
                  {['Name', 'Cron', 'Description', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => (
                  <tr key={t.id} className="border-b border-border/40 hover:bg-accent/30">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{t.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{t.id.slice(0, 8)}…</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.cronExp ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px]">{t.description ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.enabled ? 'bg-green-500/10 text-green-400' : 'bg-accent text-muted-foreground'}`}>
                        {t.enabled ? 'enabled' : 'paused'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button
                          disabled={taskAction[t.id] === 'running'}
                          onClick={() => doTaskAction(t.id, 'run')}
                          className="rounded px-2 py-1 text-xs border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50"
                        >
                          {taskAction[t.id] === 'running' ? '…' : 'Run now'}
                        </button>
                        {t.enabled ? (
                          <button
                            disabled={taskAction[t.id] === 'running'}
                            onClick={() => doTaskAction(t.id, 'pause')}
                            className="rounded px-2 py-1 text-xs border border-border text-muted-foreground hover:bg-accent disabled:opacity-50"
                          >
                            Pause
                          </button>
                        ) : (
                          <button
                            disabled={taskAction[t.id] === 'running'}
                            onClick={() => doTaskAction(t.id, 'resume')}
                            className="rounded px-2 py-1 text-xs border border-green-500/40 text-green-400 hover:bg-green-500/10 disabled:opacity-50"
                          >
                            Resume
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tasks.length === 0 && !tasksLoading && !tasksErr && (
          <p className="text-sm text-muted-foreground">Click "Load tasks" to fetch the scheduler task list (requires admin API key).</p>
        )}
      </div>
    </div>
  )
}
