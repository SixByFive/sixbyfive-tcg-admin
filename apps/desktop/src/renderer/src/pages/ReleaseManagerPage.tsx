import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Trash2, Pencil, X, ExternalLink, GitBranch, Play,
  RefreshCw, Check, Tag, Clock, ChevronDown, ChevronUp, Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Project {
  id: string
  name: string
  description?: string
  githubOwner?: string
  githubRepo?: string
  workflowFile?: string
  defaultBranch?: string
  patVaultId?: string
  createdAt: string
}

interface Release {
  id: string
  projectId: string
  version: string
  title?: string
  notes?: string
  status: 'draft' | 'released' | 'archived'
  releasedAt?: string | null
  gitTag?: string
  repoUrl?: string
  workflowUrl?: string
  createdAt: string
}

interface GhTag  { name: string; sha: string }
interface GhRun  { id: number; displayTitle: string; status: string; conclusion: string | null; createdAt: string; headBranch: string; runNumber: number; url: string }

const api = (window as any).releaseManager as {
  listProjects:    ()                         => Promise<Project[]>
  saveProject:     (p: Partial<Project>)      => Promise<{ ok: boolean; id: string }>
  deleteProject:   (id: string)               => Promise<{ ok: boolean }>
  listReleases:    (projectId: string)        => Promise<Release[]>
  saveRelease:     (r: Partial<Release>)      => Promise<{ ok: boolean; id: string }>
  deleteRelease:   (id: string)               => Promise<{ ok: boolean }>
  listTags:        (projectId: string)        => Promise<GhTag[]>
  listRuns:        (projectId: string)        => Promise<GhRun[]>
  triggerWorkflow: (projectId: string, ref: string) => Promise<{ ok: boolean }>
}

const STATUS_META = {
  released: { label: 'Released', cls: 'bg-green-500/10 text-green-600' },
  draft:    { label: 'Draft',    cls: 'bg-amber-500/10 text-amber-600' },
  archived: { label: 'Archived', cls: 'bg-muted text-muted-foreground' },
}

const EMPTY_PROJECT: Partial<Project> = { name: '', description: '', githubOwner: '', githubRepo: '', workflowFile: '', defaultBranch: 'main', patVaultId: '' }
const EMPTY_RELEASE: Partial<Release> = { version: '', title: '', notes: '', status: 'released', releasedAt: new Date().toISOString().slice(0, 10), gitTag: '', repoUrl: '', workflowUrl: '' }

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatAge(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60)  return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function RunBadge({ status, conclusion }: { status: string; conclusion: string | null }) {
  if (status === 'in_progress' || status === 'queued')
    return <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600"><RefreshCw className="h-2.5 w-2.5 animate-spin" />{status === 'queued' ? 'Queued' : 'Running'}</span>
  if (conclusion === 'success')
    return <span className="flex items-center gap-1 rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-green-600"><Check className="h-2.5 w-2.5" />Success</span>
  if (conclusion === 'failure' || conclusion === 'cancelled')
    return <span className="flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-600"><X className="h-2.5 w-2.5" />{conclusion === 'cancelled' ? 'Cancelled' : 'Failed'}</span>
  return <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{conclusion ?? status}</span>
}

// ── Project form modal ────────────────────────────────────────────────────────

function ProjectModal({ initial, onSave, onClose }: {
  initial: Partial<Project>
  onSave: (p: Partial<Project>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<Partial<Project>>(initial)
  const [saving, setSaving] = useState(false)
  const [showGh, setShowGh] = useState(!!(initial.githubOwner || initial.githubRepo))

  async function submit() {
    if (!form.name?.trim()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  const inp = 'rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">{form.id ? 'Edit project' : 'New project'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex flex-col gap-3 p-5">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <input autoFocus value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My App" className={inp} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Description <span className="text-muted-foreground/50">(optional)</span></label>
            <input value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description" className={inp} />
          </div>

          <button
            onClick={() => setShowGh(v => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {showGh ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            GitHub integration <span className="text-muted-foreground/50">(optional)</span>
          </button>

          {showGh && (
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <div className="flex gap-2">
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Owner / org</label>
                  <input value={form.githubOwner ?? ''} onChange={e => setForm(f => ({ ...f, githubOwner: e.target.value }))} placeholder="your-org" className={inp} />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Repository</label>
                  <input value={form.githubRepo ?? ''} onChange={e => setForm(f => ({ ...f, githubRepo: e.target.value }))} placeholder="my-app" className={inp} />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Workflow file</label>
                  <input value={form.workflowFile ?? ''} onChange={e => setForm(f => ({ ...f, workflowFile: e.target.value }))} placeholder="release.yml" className={inp} />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Default branch</label>
                  <input value={form.defaultBranch ?? ''} onChange={e => setForm(f => ({ ...f, defaultBranch: e.target.value }))} placeholder="main" className={inp} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">PAT vault entry ID <span className="text-muted-foreground/50">(Contents:read, Actions:write)</span></label>
                <input value={form.patVaultId ?? ''} onChange={e => setForm(f => ({ ...f, patVaultId: e.target.value }))} placeholder="Vault entry UUID" className={cn(inp, 'font-mono text-xs')} />
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 border-t border-border px-5 py-4">
          <button onClick={onClose} className="flex-1 rounded-md border border-border py-2 text-xs font-medium text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={submit} disabled={saving || !form.name?.trim()} className="flex-1 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Release form modal ────────────────────────────────────────────────────────

function ReleaseModal({ initial, onSave, onClose }: {
  initial: Partial<Release>
  onSave: (r: Partial<Release>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<Partial<Release>>(initial)
  const [saving, setSaving] = useState(false)
  const [showLinks, setShowLinks] = useState(!!(initial.gitTag || initial.repoUrl || initial.workflowUrl))

  async function submit() {
    if (!form.version?.trim()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  const inp = 'rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">{form.id ? 'Edit release' : 'Log release'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex flex-col gap-3 p-5">
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Version</label>
              <input autoFocus value={form.version ?? ''} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="1.2.3" className={cn(inp, 'font-mono')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select value={form.status ?? 'released'} onChange={e => setForm(f => ({ ...f, status: e.target.value as Release['status'] }))} className={inp}>
                <option value="released">Released</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Date</label>
              <input type="date" value={form.releasedAt?.slice(0, 10) ?? ''} onChange={e => setForm(f => ({ ...f, releasedAt: e.target.value }))} className={inp} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Title <span className="text-muted-foreground/50">(optional)</span></label>
            <input value={form.title ?? ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="What's in this release?" className={inp} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Notes <span className="text-muted-foreground/50">(optional)</span></label>
            <textarea value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Changelog, bug fixes, features…" rows={3} className={cn(inp, 'resize-none')} />
          </div>

          <button onClick={() => setShowLinks(v => !v)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            {showLinks ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Links <span className="text-muted-foreground/50">(optional)</span>
          </button>

          {showLinks && (
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Git tag</label>
                <input value={form.gitTag ?? ''} onChange={e => setForm(f => ({ ...f, gitTag: e.target.value }))} placeholder="v1.2.3" className={cn(inp, 'font-mono')} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Release / repo URL</label>
                <input value={form.repoUrl ?? ''} onChange={e => setForm(f => ({ ...f, repoUrl: e.target.value }))} placeholder="https://github.com/…/releases/tag/v1.2.3" className={inp} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Workflow / CI URL</label>
                <input value={form.workflowUrl ?? ''} onChange={e => setForm(f => ({ ...f, workflowUrl: e.target.value }))} placeholder="https://github.com/…/actions/runs/…" className={inp} />
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 border-t border-border px-5 py-4">
          <button onClick={onClose} className="flex-1 rounded-md border border-border py-2 text-xs font-medium text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={submit} disabled={saving || !form.version?.trim()} className="flex-1 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
            {saving ? 'Saving…' : form.id ? 'Save changes' : 'Log release'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ReleaseManagerPage(): JSX.Element {
  const [projects, setProjects]     = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [releases, setReleases]     = useState<Release[]>([])
  const [ghTags, setGhTags]         = useState<GhTag[]>([])
  const [ghRuns, setGhRuns]         = useState<GhRun[]>([])
  const [ghLoading, setGhLoading]   = useState(false)
  const [ghError, setGhError]       = useState<string | null>(null)
  const [triggerRef, setTriggerRef] = useState('')
  const [triggering, setTriggering] = useState(false)
  const [triggerResult, setTriggerResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [refreshMs, setRefreshMs]   = useState(60_000)
  const refreshTimer                = useRef<ReturnType<typeof setInterval> | null>(null)

  const [projectModal, setProjectModal] = useState<{ open: boolean; initial: Partial<Project> }>({ open: false, initial: EMPTY_PROJECT })
  const [releaseModal, setReleaseModal] = useState<{ open: boolean; initial: Partial<Release> }>({ open: false, initial: EMPTY_RELEASE })
  const [showGhPanel, setShowGhPanel]   = useState(false)

  const selected = projects.find(p => p.id === selectedId) ?? null
  const hasGh    = !!(selected?.githubOwner && selected?.githubRepo && selected?.patVaultId)

  const loadProjects = useCallback(async () => {
    const list = await api.listProjects()
    setProjects(list)
    return list
  }, [])

  const loadReleases = useCallback(async (projectId: string) => {
    const list = await api.listReleases(projectId)
    list.sort((a, b) => {
      if (a.status === 'released' && b.status !== 'released') return -1
      if (b.status === 'released' && a.status !== 'released') return 1
      return new Date(b.releasedAt ?? b.createdAt).getTime() - new Date(a.releasedAt ?? a.createdAt).getTime()
    })
    setReleases(list)
  }, [])

  const loadGh = useCallback(async (projectId: string) => {
    setGhLoading(true); setGhError(null)
    try {
      const [tags, runs] = await Promise.all([api.listTags(projectId), api.listRuns(projectId)])
      setGhTags(tags); setGhRuns(runs)
    } catch (err) {
      setGhError((err as Error).message)
    } finally {
      setGhLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProjects().then(list => {
      if (list.length > 0) setSelectedId(list[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedId) { setReleases([]); return }
    loadReleases(selectedId)
    setGhTags([]); setGhRuns([]); setGhError(null); setShowGhPanel(false)
    const p = projects.find(x => x.id === selectedId)
    setTriggerRef(p?.defaultBranch ?? 'main')
    setTriggerResult(null)
  }, [selectedId])

  // GitHub auto-refresh
  useEffect(() => {
    if (refreshTimer.current) clearInterval(refreshTimer.current)
    if (!refreshMs || !selectedId || !hasGh || !showGhPanel) return
    refreshTimer.current = setInterval(() => loadGh(selectedId), refreshMs)
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current) }
  }, [refreshMs, selectedId, hasGh, showGhPanel])

  async function handleSaveProject(p: Partial<Project>) {
    await api.saveProject(p)
    const list = await loadProjects()
    if (!p.id) setSelectedId(list[list.length - 1].id)
    setProjectModal({ open: false, initial: EMPTY_PROJECT })
  }

  async function handleDeleteProject(id: string) {
    await api.deleteProject(id)
    const list = await loadProjects()
    setSelectedId(list[0]?.id ?? null)
  }

  async function handleSaveRelease(r: Partial<Release>) {
    await api.saveRelease({ ...r, projectId: selectedId! })
    await loadReleases(selectedId!)
    setReleaseModal({ open: false, initial: EMPTY_RELEASE })
  }

  async function handleDeleteRelease(id: string) {
    await api.deleteRelease(id)
    await loadReleases(selectedId!)
  }

  async function handleTrigger() {
    if (!selectedId || !triggerRef.trim()) return
    setTriggering(true); setTriggerResult(null)
    try {
      await api.triggerWorkflow(selectedId, triggerRef.trim())
      setTriggerResult({ ok: true })
      setTimeout(() => loadGh(selectedId), 3000)
    } catch (err) {
      setTriggerResult({ ok: false, error: (err as Error).message })
    } finally {
      setTriggering(false)
    }
  }

  function openGhPanel() {
    setShowGhPanel(true)
    if (selectedId) loadGh(selectedId)
  }

  // Sort releases into groups
  const currentRelease  = releases.find(r => r.status === 'released')
  const previousReleases = releases.filter(r => r.status === 'released').slice(1)
  const drafts          = releases.filter(r => r.status === 'draft')
  const archived        = releases.filter(r => r.status === 'archived')

  return (
    <div className="flex h-full overflow-hidden">

      {/* Project list */}
      <div className="flex w-[200px] shrink-0 flex-col border-r border-border bg-card">
        <div className="flex items-center justify-between px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Projects</p>
          <button
            onClick={() => setProjectModal({ open: true, initial: EMPTY_PROJECT })}
            className="rounded p-0.5 text-muted-foreground/40 hover:bg-accent/50 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {projects.length === 0 ? (
            <p className="px-3 text-xs text-muted-foreground">No projects yet.</p>
          ) : (
            projects.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  'group flex w-full items-center gap-2 border-l-2 px-3 py-2.5 text-left transition-colors',
                  selectedId === p.id
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                )}
              >
                <span className="flex-1 truncate text-[13px]">{p.name}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main content */}
      {!selected ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-sm text-muted-foreground">No project selected.</p>
          <button
            onClick={() => setProjectModal({ open: true, initial: EMPTY_PROJECT })}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Add project
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h1 className="text-lg font-semibold text-foreground">{selected.name}</h1>
              {selected.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{selected.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasGh && !showGhPanel && (
                <button
                  onClick={openGhPanel}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <GitBranch className="h-3.5 w-3.5" /> GitHub
                </button>
              )}
              <button
                onClick={() => setProjectModal({ open: true, initial: { ...selected } })}
                className="rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => { if (confirm(`Delete project "${selected.name}" and all its releases?`)) handleDeleteProject(selected.id) }}
                className="rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setReleaseModal({ open: true, initial: { ...EMPTY_RELEASE, projectId: selected.id } })}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Log release
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex flex-col gap-6">

              {releases.length === 0 && (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
                  <p className="text-sm text-muted-foreground">No releases logged yet.</p>
                  <button
                    onClick={() => setReleaseModal({ open: true, initial: { ...EMPTY_RELEASE, projectId: selected.id } })}
                    className="mt-1 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
                  >
                    Log first release
                  </button>
                </div>
              )}

              {/* Current release */}
              {currentRelease && (
                <ReleaseCard
                  release={currentRelease}
                  highlight
                  onEdit={r => setReleaseModal({ open: true, initial: { ...r } })}
                  onDelete={id => handleDeleteRelease(id)}
                />
              )}

              {/* Drafts */}
              {drafts.length > 0 && (
                <section>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Drafts</p>
                  <div className="flex flex-col gap-2">
                    {drafts.map(r => (
                      <ReleaseCard key={r.id} release={r}
                        onEdit={r => setReleaseModal({ open: true, initial: { ...r } })}
                        onDelete={id => handleDeleteRelease(id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Previous releases */}
              {previousReleases.length > 0 && (
                <section>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Previous</p>
                  <div className="flex flex-col gap-2">
                    {previousReleases.map(r => (
                      <ReleaseCard key={r.id} release={r}
                        onEdit={r => setReleaseModal({ open: true, initial: { ...r } })}
                        onDelete={id => handleDeleteRelease(id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Archived */}
              {archived.length > 0 && (
                <section>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Archived</p>
                  <div className="flex flex-col gap-2">
                    {archived.map(r => (
                      <ReleaseCard key={r.id} release={r}
                        onEdit={r => setReleaseModal({ open: true, initial: { ...r } })}
                        onDelete={id => handleDeleteRelease(id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* GitHub panel */}
              {showGhPanel && (
                <section className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">GitHub</p>
                    <div className="flex items-center gap-2">
                      <select
                        value={refreshMs}
                        onChange={e => setRefreshMs(Number(e.target.value))}
                        className="rounded border border-input bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground outline-none"
                      >
                        <option value={30000}>30s</option>
                        <option value={60000}>1m</option>
                        <option value={300000}>5m</option>
                        <option value={0}>Off</option>
                      </select>
                      <button onClick={() => loadGh(selected.id)} disabled={ghLoading} className="text-muted-foreground hover:text-foreground disabled:opacity-50">
                        <RefreshCw className={cn('h-3.5 w-3.5', ghLoading && 'animate-spin')} />
                      </button>
                      <button onClick={() => setShowGhPanel(false)} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {ghError && (
                    <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{ghError}</p>
                  )}

                  {/* Trigger */}
                  {selected.workflowFile && (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <div className="flex flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
                          <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <input
                            value={triggerRef}
                            onChange={e => setTriggerRef(e.target.value)}
                            placeholder="Branch or tag"
                            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                          />
                        </div>
                        <button
                          onClick={handleTrigger}
                          disabled={triggering || !triggerRef.trim()}
                          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                        >
                          <Play className="h-3.5 w-3.5" />
                          {triggering ? 'Dispatching…' : 'Run workflow'}
                        </button>
                      </div>
                      {triggerResult && (
                        <p className={cn('text-xs', triggerResult.ok ? 'text-green-600' : 'text-destructive')}>
                          {triggerResult.ok ? 'Workflow dispatched.' : triggerResult.error}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {/* Tags */}
                    <div className="rounded-lg border border-border bg-card p-4">
                      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Recent tags</p>
                      {ghTags.length === 0 && !ghLoading ? (
                        <p className="text-xs text-muted-foreground">No tags.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {ghTags.map(t => (
                            <div key={t.name} className="flex items-center gap-2">
                              <Tag className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                              <span className="flex-1 font-mono text-xs text-foreground">{t.name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{t.sha}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Runs */}
                    <div className="rounded-lg border border-border bg-card p-4">
                      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">CI runs</p>
                      {ghRuns.length === 0 && !ghLoading ? (
                        <p className="text-xs text-muted-foreground">No runs.</p>
                      ) : (
                        <div className="flex flex-col gap-2.5">
                          {ghRuns.map(r => (
                            <div key={r.id} className="flex flex-col gap-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-xs text-foreground">#{r.runNumber} {r.displayTitle}</span>
                                <RunBadge status={r.status} conclusion={r.conclusion} />
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <GitBranch className="h-2.5 w-2.5" />{r.headBranch}
                                <Clock className="h-2.5 w-2.5 ml-1" />{formatAge(r.createdAt)}
                                {r.url && (
                                  <a href={r.url} target="_blank" rel="noreferrer" className="ml-auto text-primary hover:underline">
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {projectModal.open && (
        <ProjectModal
          initial={projectModal.initial}
          onSave={handleSaveProject}
          onClose={() => setProjectModal({ open: false, initial: EMPTY_PROJECT })}
        />
      )}
      {releaseModal.open && (
        <ReleaseModal
          initial={releaseModal.initial}
          onSave={handleSaveRelease}
          onClose={() => setReleaseModal({ open: false, initial: EMPTY_RELEASE })}
        />
      )}
    </div>
  )
}

// ── Release card ──────────────────────────────────────────────────────────────

function ReleaseCard({ release, highlight, onEdit, onDelete }: {
  release: Release
  highlight?: boolean
  onEdit: (r: Release) => void
  onDelete: (id: string) => void
}) {
  const meta = STATUS_META[release.status]

  return (
    <div className={cn(
      'group relative rounded-lg border bg-card p-4',
      highlight ? 'border-primary/30 bg-primary/5' : 'border-border'
    )}>
      <div className="absolute right-3 top-3 hidden items-center gap-1 group-hover:flex">
        <button onClick={() => onEdit(release)} className="rounded p-1 text-muted-foreground/40 hover:bg-accent/50 hover:text-foreground">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => onDelete(release.id)} className="rounded p-1 text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('font-mono text-sm font-semibold', highlight ? 'text-primary' : 'text-foreground')}>
              v{release.version}
            </span>
            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', meta.cls)}>
              {meta.label}
            </span>
            {release.releasedAt && (
              <span className="text-xs text-muted-foreground">{formatDate(release.releasedAt)}</span>
            )}
            {release.gitTag && (
              <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                <Tag className="h-2.5 w-2.5" />{release.gitTag}
              </span>
            )}
          </div>
          {release.title && (
            <p className="mt-1 text-sm text-foreground">{release.title}</p>
          )}
          {release.notes && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{release.notes}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {release.repoUrl && (
            <a href={release.repoUrl} target="_blank" rel="noreferrer"
              className="rounded p-1 text-muted-foreground/40 hover:bg-accent/50 hover:text-foreground"
              title="Release page"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {release.workflowUrl && (
            <a href={release.workflowUrl} target="_blank" rel="noreferrer"
              className="rounded p-1 text-muted-foreground/40 hover:bg-accent/50 hover:text-foreground"
              title="CI run"
            >
              <Play className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
