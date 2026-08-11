import { useCallback, useEffect, useRef, useState } from 'react'
import {
  KeyRound, Plus, Search, Copy, Eye, EyeOff, Pencil, Trash2,
  Globe, X, Check, ShieldAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface VaultEntry {
  id: string
  name: string
  url: string
  username: string
  hasPassword: boolean
  notes: string
  category: string
  createdAt: string
  updatedAt: string
}

interface EntryForm {
  id?: string
  name: string
  url: string
  username: string
  password: string
  notes: string
  category: string
}

const BLANK_FORM: EntryForm = { name: '', url: '', username: '', password: '', notes: '', category: '' }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const vault = (window as any).vault as {
  list: () => Promise<VaultEntry[]>
  getPassword: (id: string) => Promise<{ password: string | null }>
  save: (entry: EntryForm) => Promise<{ ok: boolean; error?: string }>
  delete: (id: string) => Promise<{ ok: boolean }>
  encryptionStatus: () => Promise<{ available: boolean }>
}

function favicon(url: string): string | null {
  try {
    const { origin } = new URL(url.startsWith('http') ? url : `https://${url}`)
    return `${origin}/favicon.ico`
  } catch {
    return null
  }
}

function groupByCategory(entries: VaultEntry[]): [string, VaultEntry[]][] {
  const map = new Map<string, VaultEntry[]>()
  for (const e of entries) {
    const key = e.category?.trim() || ''
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  // Sort: uncategorised first, then alphabetical
  return Array.from(map.entries()).sort(([a], [b]) => {
    if (!a) return -1
    if (!b) return 1
    return a.localeCompare(b)
  })
}

// ─── Copy-flash hook ─────────────────────────────────────────────────────────

function useCopyFlash() {
  const [copied, setCopied] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flash = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(null), 1800)
  }, [])

  return { copied, flash }
}

// ─── Entry form modal ─────────────────────────────────────────────────────────

function EntryModal({
  initial,
  onSave,
  onClose,
}: {
  initial: EntryForm
  onSave: (form: EntryForm) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<EntryForm>(initial)
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof EntryForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave(form)
    } catch (err: any) {
      setError(err.message ?? 'Failed to save.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">
            {form.id ? 'Edit entry' : 'New entry'}
          </h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-3 px-5 py-4">
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}

          {([
            ['name',     'Name *',    'text',     'e.g. GitHub, AWS Console'],
            ['url',      'URL',       'url',      'https://...'],
            ['username', 'Username / email', 'text', ''],
            ['category', 'Category',  'text',     'e.g. Work, Personal'],
          ] as const).map(([field, label, type, placeholder]) => (
            <label key={field} className="block">
              <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
              <input
                type={type}
                value={form[field]}
                onChange={set(field)}
                placeholder={placeholder}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
          ))}

          {/* Password with toggle */}
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Password{form.id ? ' (leave blank to keep existing)' : ''}
            </span>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                autoComplete="new-password"
                className="w-full rounded-lg border border-border bg-background py-2 pl-3 pr-9 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </label>

          {/* Notes */}
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Notes</span>
            <textarea
              value={form.notes}
              onChange={set('notes')}
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-1.5 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Entry row ────────────────────────────────────────────────────────────────

function EntryRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: VaultEntry
  onEdit: () => void
  onDelete: () => void
}) {
  const { copied, flash } = useCopyFlash()
  const [revealedPw, setRevealedPw] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)
  const [loadingPw, setLoadingPw] = useState(false)
  const fav = entry.url ? favicon(entry.url) : null

  const loadPassword = async () => {
    if (revealedPw !== null) return
    setLoadingPw(true)
    const { password } = await vault.getPassword(entry.id)
    setRevealedPw(password ?? '')
    setLoadingPw(false)
  }

  const copyPassword = async () => {
    setLoadingPw(true)
    const { password } = await vault.getPassword(entry.id)
    setLoadingPw(false)
    if (password) flash('pw-' + entry.id, password)
  }

  const toggleReveal = async () => {
    if (!showPw) await loadPassword()
    setShowPw(v => !v)
  }

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-border/80 hover:bg-accent/20">
      {/* Favicon / icon */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
        {fav ? (
          <img
            src={fav}
            alt=""
            className="h-4 w-4 object-contain"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>

      {/* Name + url */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{entry.name}</p>
        {entry.url && (
          <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            <Globe className="h-3 w-3 shrink-0" />
            {entry.url}
          </p>
        )}
      </div>

      {/* Username */}
      <div className="hidden min-w-0 w-44 sm:block">
        <p className="truncate text-xs text-muted-foreground">{entry.username || '—'}</p>
      </div>

      {/* Password field */}
      <div className="flex items-center gap-1.5">
        {entry.hasPassword ? (
          <>
            <span className="font-mono text-xs tracking-widest text-muted-foreground select-none">
              {showPw ? (revealedPw ?? '••••••••') : '••••••••'}
            </span>
            <button
              onClick={toggleReveal}
              disabled={loadingPw}
              title={showPw ? 'Hide' : 'Reveal'}
              className="p-1 text-muted-foreground/50 hover:text-muted-foreground disabled:opacity-40"
            >
              {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={copyPassword}
              disabled={loadingPw}
              title="Copy password"
              className="p-1 text-muted-foreground/50 hover:text-primary disabled:opacity-40"
            >
              {copied === 'pw-' + entry.id
                ? <Check className="h-3.5 w-3.5 text-green-500" />
                : <Copy className="h-3.5 w-3.5" />
              }
            </button>
          </>
        ) : (
          <span className="text-[11px] text-muted-foreground/40">no password</span>
        )}

        {/* Copy username */}
        {entry.username && (
          <button
            onClick={() => flash('un-' + entry.id, entry.username)}
            title="Copy username"
            className="ml-1 rounded p-1 text-muted-foreground/50 opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
          >
            {copied === 'un-' + entry.id
              ? <Check className="h-3.5 w-3.5 text-green-500" />
              : <Copy className="h-3.5 w-3.5" />
            }
          </button>
        )}
      </div>

      {/* Row actions */}
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={onEdit}
          title="Edit"
          className="rounded p-1.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          title="Delete"
          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function VaultPage(): JSX.Element {
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<EntryForm | null>(null)
  const [encAvailable, setEncAvailable] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const load = useCallback(async () => {
    const data = await vault.list()
    setEntries(data)
  }, [])

  useEffect(() => {
    load()
    vault.encryptionStatus().then(({ available }) => setEncAvailable(available))
  }, [load])

  const filtered = entries.filter(e => {
    const q = search.toLowerCase()
    return (
      e.name.toLowerCase().includes(q) ||
      e.username.toLowerCase().includes(q) ||
      e.url.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q)
    )
  })

  const groups = groupByCategory(filtered)

  const openNew = () => setModal({ ...BLANK_FORM })
  const openEdit = async (entry: VaultEntry) => {
    // Pre-fill password so the field shows the encrypted exists state
    setModal({
      id: entry.id,
      name: entry.name,
      url: entry.url,
      username: entry.username,
      password: '',           // always blank — user re-enters or leaves blank
      notes: entry.notes,
      category: entry.category,
    })
  }

  const handleSave = async (form: EntryForm) => {
    const payload = { ...form }
    // If editing and password is blank, don't overwrite — omit the field
    if (form.id && form.password === '') {
      delete (payload as any).password
    }
    const res = await vault.save(payload)
    if (!res.ok) throw new Error(res.error ?? 'Save failed')
    setModal(null)
    await load()
  }

  const handleDelete = async (id: string) => {
    await vault.delete(id)
    setDeleteConfirm(null)
    await load()
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Vault</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Saved logins and credentials — encrypted with OS key store
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add entry
        </button>
      </div>

      {/* Encryption warning */}
      {!encAvailable && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            OS encryption is unavailable on this system. Passwords cannot be stored safely.
          </span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, username, URL or category…"
          className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Column headers */}
      {entries.length > 0 && (
        <div className="flex items-center gap-3 px-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          <div className="w-8 shrink-0" />
          <div className="flex-1">Name</div>
          <div className="hidden w-44 sm:block">Username</div>
          <div className="w-32">Password</div>
          <div className="w-16" />
        </div>
      )}

      {/* Entries */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <KeyRound className="mb-3 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">
            {search ? 'No entries match your search' : 'No saved entries yet'}
          </p>
          {!search && (
            <button
              onClick={openNew}
              className="mt-3 text-sm text-primary hover:underline"
            >
              Add your first entry
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([category, items]) => (
            <div key={category || '__none__'}>
              {category && (
                <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  {category}
                </p>
              )}
              <div className="space-y-1.5">
                {items.map(entry => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    onEdit={() => openEdit(entry)}
                    onDelete={() => setDeleteConfirm(entry.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      {modal && (
        <EntryModal
          initial={modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
            <p className="text-sm font-medium text-foreground">Delete this entry?</p>
            <p className="mt-1 text-xs text-muted-foreground">This cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg px-4 py-1.5 text-sm text-muted-foreground hover:bg-accent/50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="rounded-lg bg-destructive px-4 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
