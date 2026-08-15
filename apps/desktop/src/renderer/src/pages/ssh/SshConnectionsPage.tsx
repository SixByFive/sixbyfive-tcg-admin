import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Terminal, Key, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SavedConnection {
  id: string
  label: string
  host: string
  port: number
  username: string
  authMethod: 'key' | 'password'
  keyPath?: string
  vaultId?: string
}

const BLANK: Omit<SavedConnection, 'id'> = {
  label: '', host: '', port: 22, username: '',
  authMethod: 'password', keyPath: '', vaultId: '',
}

const api = (window as any).ssh as {
  listConnections:  () => Promise<SavedConnection[]>
  saveConnection:   (conn: SavedConnection) => Promise<{ ok: boolean }>
  deleteConnection: (args: { id: string }) => Promise<{ ok: boolean }>
}

export function SshConnectionsPage(): JSX.Element {
  const [connections, setConnections] = useState<SavedConnection[]>([])
  const [editing, setEditing]         = useState<Partial<SavedConnection> | null>(null)
  const [saving, setSaving]           = useState(false)
  const [deleteId, setDeleteId]       = useState<string | null>(null)

  async function load() {
    setConnections(await api.listConnections())
  }

  useEffect(() => { load() }, [])

  async function handleSave() {
    if (!editing) return
    if (!editing.label || !editing.host || !editing.username) return
    setSaving(true)
    try {
      await api.saveConnection({
        ...editing,
        id: editing.id ?? crypto.randomUUID(),
        port: Number(editing.port ?? 22),
      } as SavedConnection)
      await load()
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await api.deleteConnection({ id })
    await load()
    setDeleteId(null)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-foreground">SSH Connections</h1>
        <button
          onClick={() => setEditing({ ...BLANK })}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          New connection
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Terminal className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">No connections yet. Add one to get started.</p>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl flex flex-col gap-2">
            {connections.map(conn => (
              <div
                key={conn.id}
                className="group flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3"
              >
                <Terminal className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{conn.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {conn.username}@{conn.host}:{conn.port ?? 22}
                    <span className={cn('ml-2 inline-flex items-center gap-0.5', conn.authMethod === 'key' ? 'text-green-600' : 'text-blue-500')}>
                      {conn.authMethod === 'key' ? <Key className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                      {conn.authMethod === 'key' ? 'key' : 'password'}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => setEditing({ ...conn })}
                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteId(conn.id)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit / Add modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">{editing.id ? 'Edit connection' : 'New connection'}</h2>
            </div>
            <div className="flex flex-col gap-3 p-5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Label</label>
                <input
                  value={editing.label ?? ''}
                  onChange={e => setEditing(d => ({ ...d!, label: e.target.value }))}
                  placeholder="e.g. Heimdall"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Host</label>
                  <input
                    value={editing.host ?? ''}
                    onChange={e => setEditing(d => ({ ...d!, host: e.target.value }))}
                    placeholder="192.168.1.100"
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="flex w-20 flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Port</label>
                  <input
                    type="number"
                    value={editing.port ?? 22}
                    onChange={e => setEditing(d => ({ ...d!, port: Number(e.target.value) }))}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Username</label>
                <input
                  value={editing.username ?? ''}
                  onChange={e => setEditing(d => ({ ...d!, username: e.target.value }))}
                  placeholder="ubuntu"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Auth method</label>
                <div className="flex gap-2">
                  {(['password', 'key'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setEditing(d => ({ ...d!, authMethod: m }))}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1.5 rounded-md border py-2 text-xs font-medium transition-colors',
                        editing.authMethod === m
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {m === 'key' ? <Key className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {m === 'key' ? 'Private key' : 'Password (Vault)'}
                    </button>
                  ))}
                </div>
              </div>
              {editing.authMethod === 'key' ? (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Key file path</label>
                  <input
                    value={editing.keyPath ?? ''}
                    onChange={e => setEditing(d => ({ ...d!, keyPath: e.target.value }))}
                    placeholder="C:\Users\you\.ssh\id_rsa"
                    className="rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Vault entry ID</label>
                  <input
                    value={editing.vaultId ?? ''}
                    onChange={e => setEditing(d => ({ ...d!, vaultId: e.target.value }))}
                    placeholder="Paste the UUID from your Vault entry"
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                  <p className="text-[10px] text-muted-foreground">Save the SSH password in Vault first, then copy its ID here.</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 border-t border-border px-5 py-4">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-md border border-border py-2 text-xs font-medium text-muted-foreground hover:text-foreground">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving || !editing.label || !editing.host || !editing.username}
                className="flex-1 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-80 rounded-xl border border-border bg-card p-5 shadow-xl">
            <p className="text-sm font-semibold">Delete connection?</p>
            <p className="mt-1 text-xs text-muted-foreground">This cannot be undone.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 rounded-md border border-border py-2 text-xs font-medium text-muted-foreground">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 rounded-md bg-destructive py-2 text-xs font-semibold text-destructive-foreground">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
