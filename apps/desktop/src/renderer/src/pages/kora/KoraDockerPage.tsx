import { useEffect, useState, useCallback } from 'react'
import { koraDockerApi } from '@/lib/kora'
import type { KoraDockerService } from '@sixbyfive/kora-client'

function stateColor(state: string): string {
  const s = state.toLowerCase()
  if (s === 'running')        return 'bg-green-500/10 text-green-400 border-green-500/20'
  if (s === 'exited')         return 'bg-destructive/10 text-destructive border-destructive/20'
  if (s.includes('start') || s.includes('restart')) return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  return 'bg-accent text-muted-foreground border-border'
}

function stateDot(state: string): string {
  const s = state.toLowerCase()
  if (s === 'running') return 'bg-green-400'
  if (s === 'exited')  return 'bg-destructive'
  if (s.includes('start') || s.includes('restart')) return 'bg-amber-400 animate-pulse'
  return 'bg-muted-foreground'
}

export function KoraDockerPage(): JSX.Element {
  const [services, setServices]     = useState<KoraDockerService[]>([])
  const [loading, setLoading]       = useState(false)
  const [loadError, setLoadError]   = useState('')

  const [actionBusy, setActionBusy] = useState<Record<string, string | null>>({})
  const [actionErr, setActionErr]   = useState<Record<string, string>>({})

  const [globalBusy, setGlobalBusy]     = useState(false)
  const [globalResult, setGlobalResult] = useState<{ ok: boolean; message: string } | null>(null)

  const [logService, setLogService] = useState<string | null>(null)
  const [logContent, setLogContent] = useState('')
  const [logLoading, setLogLoading] = useState(false)
  const [logTail, setLogTail]       = useState(100)

  const loadServices = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      setServices(await koraDockerApi.listServices())
    } catch (err: any) {
      setLoadError(err?.message ?? 'Failed to fetch services')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadServices() }, [loadServices])

  const doAction = async (name: string, action: 'start' | 'stop' | 'restart') => {
    setActionBusy(p => ({ ...p, [name]: action }))
    setActionErr(p => ({ ...p, [name]: '' }))
    try {
      await koraDockerApi.action(name, action)
    } catch (err: any) {
      setActionErr(p => ({ ...p, [name]: err?.message ?? 'Error' }))
    } finally {
      setActionBusy(p => ({ ...p, [name]: null }))
    }
    await loadServices()
  }

  const doRestartAll = async () => {
    setGlobalBusy(true)
    setGlobalResult(null)
    try {
      const res = await koraDockerApi.restartAll()
      setGlobalResult({
        ok: res.ok,
        message: `Restarted ${res.restarted} service${res.restarted !== 1 ? 's' : ''}${res.failed ? `, ${res.failed} failed` : ''}.`,
      })
    } catch (err: any) {
      setGlobalResult({ ok: false, message: err?.message ?? 'Restart-all failed' })
    } finally {
      setGlobalBusy(false)
    }
    await loadServices()
  }

  const viewLogs = async (name: string) => {
    setLogService(name)
    setLogContent('')
    setLogLoading(true)
    try {
      const res = await koraDockerApi.getLogs(name, logTail)
      setLogContent(res.logs || '(no output)')
    } catch (err: any) {
      setLogContent(`Error: ${err?.message ?? 'Failed to fetch logs'}`)
    } finally {
      setLogLoading(false)
    }
  }

  const btnCls     = 'rounded-md bg-accent px-3 py-2 text-sm text-foreground hover:bg-accent/80 disabled:opacity-50'
  const btnPrimary = 'rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Docker Services</h1>
        <p className="text-sm text-muted-foreground">Manage Kora platform containers.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={loadServices} disabled={loading} className={btnCls}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <div className="h-5 w-px bg-border" />
        <button onClick={doRestartAll} disabled={globalBusy} className={btnPrimary}>
          {globalBusy ? 'Restarting all…' : 'Restart all'}
        </button>
      </div>

      {globalResult && (
        <div className={`rounded-lg border p-3 text-sm ${globalResult.ok
          ? 'border-green-500/30 bg-green-500/10 text-green-400'
          : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>
          {globalResult.ok ? '✓ ' : '✗ '}{globalResult.message}
        </div>
      )}

      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm font-semibold text-destructive">Failed to load services</p>
          <pre className="mt-1 text-xs text-destructive/80 whitespace-pre-wrap font-mono">{loadError}</pre>
        </div>
      )}

      {services.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-card">
              <tr>
                {['Service', 'State', 'Details', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.map(svc => {
                const busy = actionBusy[svc.name]
                const err  = actionErr[svc.name]
                return (
                  <tr key={svc.name} className="border-b border-border/40 hover:bg-accent/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block h-2 w-2 rounded-full ${stateDot(svc.state)}`} />
                        <span className="font-mono font-medium text-foreground">{svc.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${stateColor(svc.state)}`}>
                        {svc.state}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <p>{svc.status}</p>
                      {svc.health && (
                        <p className={`mt-0.5 ${svc.health === 'healthy' ? 'text-green-400' : 'text-amber-400'}`}>
                          health: {svc.health}
                        </p>
                      )}
                      {err && <p className="mt-0.5 text-destructive">{err}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button
                          disabled={!!busy}
                          onClick={() => doAction(svc.name, 'restart')}
                          className="rounded px-2 py-1 text-xs border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50"
                        >
                          {busy === 'restart' ? '…' : 'Restart'}
                        </button>
                        {svc.state === 'running' ? (
                          <button
                            disabled={!!busy}
                            onClick={() => doAction(svc.name, 'stop')}
                            className="rounded px-2 py-1 text-xs border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                          >
                            {busy === 'stop' ? '…' : 'Stop'}
                          </button>
                        ) : (
                          <button
                            disabled={!!busy}
                            onClick={() => doAction(svc.name, 'start')}
                            className="rounded px-2 py-1 text-xs border border-green-500/40 text-green-400 hover:bg-green-500/10 disabled:opacity-50"
                          >
                            {busy === 'start' ? '…' : 'Start'}
                          </button>
                        )}
                        <button
                          disabled={!!busy}
                          onClick={() => viewLogs(svc.name)}
                          className="rounded px-2 py-1 text-xs border border-border text-muted-foreground hover:bg-accent disabled:opacity-50"
                        >
                          Logs
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {services.length === 0 && !loading && !loadError && (
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No containers found. Ensure the Docker socket is mounted.</p>
        </div>
      )}

      {logService && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-foreground">
                Logs: <span className="font-mono">{logService}</span>
              </p>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground">Last</label>
                <select
                  value={logTail}
                  onChange={e => setLogTail(Number(e.target.value))}
                  className="rounded border border-input bg-background px-2 py-0.5 text-xs text-foreground outline-none"
                >
                  {[50, 100, 200, 500].map(n => (
                    <option key={n} value={n}>{n} lines</option>
                  ))}
                </select>
                <button
                  onClick={() => viewLogs(logService)}
                  disabled={logLoading}
                  className="rounded px-2 py-1 text-xs border border-border text-muted-foreground hover:bg-accent disabled:opacity-50"
                >
                  {logLoading ? '…' : 'Reload'}
                </button>
              </div>
            </div>
            <button onClick={() => setLogService(null)} className="text-xs text-muted-foreground hover:text-foreground">
              ✕ Close
            </button>
          </div>
          {logLoading ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">Fetching logs…</p>
          ) : (
            <pre className="overflow-x-auto overflow-y-auto max-h-96 p-4 font-mono text-xs text-muted-foreground leading-relaxed whitespace-pre">
              {logContent}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
