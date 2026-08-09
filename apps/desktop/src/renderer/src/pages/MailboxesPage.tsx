import { useEffect, useState, useCallback, useRef } from 'react'
import { adminApi } from '@/lib/api'
import type { MailboxSummary } from '@tcg-admin/types'

// Known sixbyfive.com mailboxes in mailcow — quick-pick so you only have to
// type the password, not the address, when adding one for the first time.
const KNOWN_ADDRESSES = [
  '3dprinting@sixbyfive.com',
  'admin@sixbyfive.com',
  'dev@sixbyfive.com',
  'gaming@sixbyfive.com',
  'hello.holostack@sixbyfive.com',
  'no-reply@sixbyfive.com',
  'ryan@sixbyfive.com',
  'support@sixbyfive.com',
]

export function MailboxesPage(): JSX.Element {
  const [mailboxes, setMailboxes] = useState<MailboxSummary[]>([])
  const [loading, setLoading]     = useState(false)
  const [loadError, setLoadError] = useState('')

  const [address, setAddress]   = useState('')
  const [password, setPassword] = useState('')
  const [label, setLabel]       = useState('')
  const [adding, setAdding]     = useState(false)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [addError, setAddError] = useState('')

  const [busy, setBusy]     = useState<Record<string, 'open' | 'remove' | null>>({})
  const [rowErr, setRowErr] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const all = await adminApi.getMailboxes()
      setMailboxes(all.filter(mb => !mb.address.endsWith('@koraplatform.co.uk')))
    } catch (err: any) {
      setLoadError(err?.message ?? 'Failed to load mailboxes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const addMailbox = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdding(true)
    setAddError('')
    try {
      await adminApi.addMailbox(address.trim(), password, label.trim() || undefined)
      setAddress('')
      setPassword('')
      setLabel('')
      await load()
    } catch (err: any) {
      setAddError(err?.message ?? 'Failed to add mailbox')
    } finally {
      setAdding(false)
    }
  }

  const openWebmail = async (mb: MailboxSummary) => {
    setBusy(p => ({ ...p, [mb.address]: 'open' }))
    setRowErr(p => ({ ...p, [mb.address]: '' }))
    try {
      const { url } = await adminApi.openMailboxWebmail(mb.address)
      window.open(url, '_blank')
    } catch (err: any) {
      setRowErr(p => ({ ...p, [mb.address]: err?.message ?? 'Failed to open webmail' }))
    } finally {
      setBusy(p => ({ ...p, [mb.address]: null }))
    }
  }

  const removeMailbox = async (mb: MailboxSummary) => {
    if (!confirm(`Remove stored credentials for ${mb.address}?`)) return
    setBusy(p => ({ ...p, [mb.address]: 'remove' }))
    try {
      await adminApi.removeMailbox(mb.address)
      await load()
    } catch (err: any) {
      setRowErr(p => ({ ...p, [mb.address]: err?.message ?? 'Failed to remove' }))
    } finally {
      setBusy(p => ({ ...p, [mb.address]: null }))
    }
  }

  const btnCls     = 'rounded-md bg-accent px-3 py-2 text-sm text-foreground hover:bg-accent/80 disabled:opacity-50'
  const btnPrimary = 'rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50'
  const inputCls   = 'rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Webmail</h1>
        <p className="text-sm text-muted-foreground">
          One-click, already-signed-in SOGo webmail access for sixbyfive.com mailboxes.
        </p>
      </div>

      {/* ── Add mailbox ── */}
      <form onSubmit={addMailbox} className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Add a mailbox</p>

        {(() => {
          const configured = new Set(mailboxes.map(mb => mb.address))
          const remaining = KNOWN_ADDRESSES.filter(a => !configured.has(a))
          if (!remaining.length) return null
          return (
            <div className="flex flex-wrap gap-1.5">
              {remaining.map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => {
                    setAddress(a)
                    passwordRef.current?.focus()
                  }}
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
                >
                  {a}
                </button>
              ))}
            </div>
          )
        })()}

        <div className="flex flex-wrap gap-2">
          <input
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="address@sixbyfive.com"
            required
            className={`${inputCls} flex-1 min-w-[220px]`}
          />
          <input
            ref={passwordRef}
            value={password}
            onChange={e => setPassword(e.target.value)}
            type="password"
            placeholder="mailcow password"
            required
            className={`${inputCls} flex-1 min-w-[180px]`}
          />
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Label (optional)"
            className={`${inputCls} flex-1 min-w-[160px]`}
          />
          <button type="submit" disabled={adding} className={btnPrimary}>
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
        {addError && <p className="text-sm text-destructive">{addError}</p>}
      </form>

      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm font-semibold text-destructive">Failed to load mailboxes</p>
          <pre className="mt-1 text-xs text-destructive/80 whitespace-pre-wrap font-mono">{loadError}</pre>
        </div>
      )}

      {/* ── Mailbox table ── */}
      {mailboxes.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-card">
              <tr>
                {['Address', 'Label', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mailboxes.map(mb => {
                const action = busy[mb.address]
                const err    = rowErr[mb.address]
                return (
                  <tr key={mb.address} className="border-b border-border/40 hover:bg-accent/30">
                    <td className="px-4 py-3 font-mono font-medium text-foreground">{mb.address}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {mb.label || '—'}
                      {err && <p className="mt-0.5 text-xs text-destructive">{err}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button
                          disabled={!!action}
                          onClick={() => openWebmail(mb)}
                          className="rounded px-2 py-1 text-xs border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50"
                        >
                          {action === 'open' ? '…' : 'Open webmail'}
                        </button>
                        <button
                          disabled={!!action}
                          onClick={() => removeMailbox(mb)}
                          className="rounded px-2 py-1 text-xs border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          {action === 'remove' ? '…' : 'Remove'}
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

      {mailboxes.length === 0 && !loading && !loadError && (
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
          <p className="text-muted-foreground text-sm">No mailboxes added yet.</p>
        </div>
      )}

      <div>
        <button onClick={load} disabled={loading} className={btnCls}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
    </div>
  )
}
