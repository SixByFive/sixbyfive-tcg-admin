import { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, Copy, Check, Pencil, Trash2, X, Search, TerminalSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Snippet {
  id: string
  title: string
  body: string
  language?: string
  category?: string
  tags?: string[]
  createdAt: string
  updatedAt: string
}

const LANGUAGES = ['', 'bash', 'sql', 'json', 'python', 'javascript', 'typescript', 'yaml', 'text']

const snippetsAPI = (window as any).snippets as {
  list:   ()                   => Promise<Snippet[]>
  save:   (s: Partial<Snippet>) => Promise<{ ok: boolean }>
  delete: (id: string)         => Promise<{ ok: boolean }>
}

interface ConnectedTab { tabId: string; label: string; host: string }

const sshAPI = (window as any).ssh as {
  getConnectedTabs: () => Promise<ConnectedTab[]>
  input:            (args: { tabId: string; data: string }) => Promise<void>
}

const EMPTY_FORM: Partial<Snippet> = { title: '', body: '', language: '', category: '', tags: [] }

export function SnippetsPage(): JSX.Element {
  const [snippets, setSnippets]   = useState<Snippet[]>([])
  const [search, setSearch]       = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [copiedId, setCopiedId]   = useState<string | null>(null)
  const [runFeedback, setRunFeedback] = useState<Record<string, 'sent' | 'no-session'>>({})
  const runFeedbackTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const [sessionPicker, setSessionPicker] = useState<{ snippet: Snippet; tabs: ConnectedTab[] } | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editSnippet, setEditSnippet] = useState<Partial<Snippet>>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)

  async function load() {
    const list = await snippetsAPI.list()
    setSnippets(list)
  }

  useEffect(() => { load() }, [])

  const categories = useMemo(() => {
    const cats = new Set(snippets.map(s => s.category ?? '').filter(Boolean))
    return [...cats].sort()
  }, [snippets])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return snippets.filter(s => {
      if (activeCategory && s.category !== activeCategory) return false
      if (!q) return true
      return (
        s.title.toLowerCase().includes(q) ||
        s.body.toLowerCase().includes(q) ||
        (s.category ?? '').toLowerCase().includes(q) ||
        (s.tags ?? []).some(t => t.toLowerCase().includes(q))
      )
    })
  }, [snippets, search, activeCategory])

  async function sendToTab(snippet: Snippet, tabId: string) {
    await sshAPI.input({ tabId, data: snippet.body + '\n' })
    const key = snippet.id
    clearTimeout(runFeedbackTimers.current[key])
    setRunFeedback(p => ({ ...p, [key]: 'sent' }))
    runFeedbackTimers.current[key] = setTimeout(
      () => setRunFeedback(p => { const n = { ...p }; delete n[key]; return n }),
      2000
    )
  }

  async function handleRunInTerminal(snippet: Snippet) {
    const tabs = await sshAPI.getConnectedTabs()
    const key = snippet.id
    clearTimeout(runFeedbackTimers.current[key])
    if (tabs.length === 0) {
      setRunFeedback(p => ({ ...p, [key]: 'no-session' }))
      runFeedbackTimers.current[key] = setTimeout(
        () => setRunFeedback(p => { const n = { ...p }; delete n[key]; return n }),
        2000
      )
    } else if (tabs.length === 1) {
      await sendToTab(snippet, tabs[0].tabId)
    } else {
      setSessionPicker({ snippet, tabs })
    }
  }

  async function handleCopy(snippet: Snippet) {
    await navigator.clipboard.writeText(snippet.body)
    setCopiedId(snippet.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  function openAdd() {
    setEditSnippet(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(snippet: Snippet) {
    setEditSnippet({ ...snippet })
    setShowModal(true)
  }

  async function handleSave() {
    if (!editSnippet.title?.trim() || !editSnippet.body?.trim()) return
    setSaving(true)
    try {
      await snippetsAPI.save(editSnippet)
      await load()
      setShowModal(false)
      setEditSnippet(EMPTY_FORM)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await snippetsAPI.delete(id)
    setSnippets(prev => prev.filter(s => s.id !== id))
  }

  function setField<K extends keyof Snippet>(key: K, value: Snippet[K]) {
    setEditSnippet(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="flex w-48 shrink-0 flex-col border-r border-border bg-card">
        <div className="p-3">
          <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <div className="h-px bg-border" />

        <nav className="flex-1 overflow-y-auto py-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              'w-full px-4 py-1.5 text-left text-xs transition-colors',
              activeCategory === null
                ? 'font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            All snippets
            <span className="ml-1.5 text-muted-foreground/60">({snippets.length})</span>
          </button>

          {categories.length > 0 && (
            <>
              <p className="mt-3 px-4 pb-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                Categories
              </p>
              {categories.map(cat => {
                const count = snippets.filter(s => s.category === cat).length
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                    className={cn(
                      'w-full px-4 py-1.5 text-left text-xs transition-colors',
                      activeCategory === cat
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {cat}
                    <span className="ml-1.5 text-muted-foreground/60">({count})</span>
                  </button>
                )
              })}
            </>
          )}
        </nav>

        <div className="border-t border-border p-3">
          <button
            onClick={openAdd}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            New snippet
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {snippets.length === 0 ? 'No snippets yet. Add your first one.' : 'No results.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(snippet => (
              <div
                key={snippet.id}
                className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-border/80"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{snippet.title}</p>
                      {snippet.language && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {snippet.language}
                        </span>
                      )}
                      {snippet.category && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {snippet.category}
                        </span>
                      )}
                    </div>
                    <pre className="mt-2 overflow-x-auto rounded-md bg-muted/50 p-2.5 font-mono text-[11px] leading-relaxed text-foreground/80 max-h-32">
                      {snippet.body}
                    </pre>
                  </div>

                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => handleRunInTerminal(snippet)}
                      title={
                        runFeedback[snippet.id] === 'no-session'
                          ? 'No active SSH session'
                          : runFeedback[snippet.id] === 'sent'
                          ? 'Sent!'
                          : 'Run in terminal'
                      }
                      className={cn(
                        'rounded p-1.5 transition-colors',
                        runFeedback[snippet.id] === 'no-session'
                          ? 'text-destructive'
                          : runFeedback[snippet.id] === 'sent'
                          ? 'text-green-500'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      {runFeedback[snippet.id] === 'sent'
                        ? <Check className="h-3.5 w-3.5" />
                        : <TerminalSquare className="h-3.5 w-3.5" />
                      }
                    </button>
                    <button
                      onClick={() => handleCopy(snippet)}
                      title="Copy"
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {copiedId === snippet.id
                        ? <Check className="h-3.5 w-3.5 text-green-500" />
                        : <Copy className="h-3.5 w-3.5" />
                      }
                    </button>
                    <button
                      onClick={() => openEdit(snippet)}
                      title="Edit"
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(snippet.id)}
                      title="Delete"
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session picker */}
      {sessionPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-72 rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Choose a terminal</p>
              <button onClick={() => setSessionPicker(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-1 p-2">
              {sessionPicker.tabs.map(tab => (
                <button
                  key={tab.tabId}
                  onClick={async () => {
                    setSessionPicker(null)
                    await sendToTab(sessionPicker.snippet, tab.tabId)
                  }}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-left hover:bg-accent"
                >
                  <TerminalSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium text-foreground">{tab.label}</p>
                    <p className="text-[10px] text-muted-foreground">{tab.host}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex w-full max-w-lg flex-col rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">
                {editSnippet.id ? 'Edit snippet' : 'New snippet'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 p-5">
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Title</label>
                  <input
                    autoFocus
                    value={editSnippet.title ?? ''}
                    onChange={e => setField('title', e.target.value)}
                    placeholder="e.g. Restart docker service"
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="flex w-32 flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Language</label>
                  <select
                    value={editSnippet.language ?? ''}
                    onChange={e => setField('language', e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                  >
                    {LANGUAGES.map(l => (
                      <option key={l} value={l}>{l || '—'}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Snippet</label>
                <textarea
                  value={editSnippet.body ?? ''}
                  onChange={e => setField('body', e.target.value)}
                  placeholder="Paste your command, query, or text here…"
                  rows={8}
                  className="rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Category</label>
                  <input
                    value={editSnippet.category ?? ''}
                    onChange={e => setField('category', e.target.value)}
                    placeholder="e.g. Docker, SSH, Database"
                    list="category-suggestions"
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                  <datalist id="category-suggestions">
                    {categories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Tags <span className="text-muted-foreground/50">(comma separated)</span></label>
                  <input
                    value={(editSnippet.tags ?? []).join(', ')}
                    onChange={e => setField('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                    placeholder="e.g. restart, prod"
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-border px-5 py-4">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-md border border-border py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editSnippet.title?.trim() || !editSnippet.body?.trim()}
                className="flex-1 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving ? 'Saving…' : editSnippet.id ? 'Save changes' : 'Add snippet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
