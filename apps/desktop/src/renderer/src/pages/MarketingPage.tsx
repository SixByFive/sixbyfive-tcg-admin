import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, BarChart3, Check, Copy, Cpu, Film, Megaphone, RefreshCw, Sparkles, Target, Users } from 'lucide-react'

type Platform = 'Facebook' | 'Instagram' | 'LinkedIn' | 'Discord'
type Goal = 'registrations' | 'collection' | 'trading' | 'marketplace'
type Status = 'draft' | 'approved'

interface GeneratedPost {
  id: number
  platform: Platform
  content: string
  status: Status
}

interface OllamaModel {
  name: string
  model?: string
  size?: number
  details?: {
    parameter_size?: string
    quantization_level?: string
  }
}

interface ModelsResult {
  ok: boolean
  models: OllamaModel[]
  error?: string
}

interface GenerateResult {
  ok: boolean
  posts?: Array<{ platform: Platform; content: string }>
  error?: string
}

const goalCopy: Record<Goal, { label: string; campaign: string }> = {
  registrations: { label: 'New registrations', campaign: 'new_users' },
  collection: { label: 'Collection tracking', campaign: 'collection_tracking' },
  trading: { label: 'Trading', campaign: 'trading' },
  marketplace: { label: 'Marketplace', campaign: 'marketplace' },
}

function makeUtm(platform: Platform, campaign: string): string {
  const source = platform.toLowerCase()
  return `https://tcg.sixbyfive.com/?utm_source=${source}&utm_medium=social&utm_campaign=${campaign}`
}

function formatModelSize(bytes?: number): string {
  if (!bytes) return ''
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

export function MarketingPage(): JSX.Element {
  const navigate = useNavigate()
  const [goal, setGoal] = useState<Goal>('registrations')
  const [brief, setBrief] = useState('')
  const [posts, setPosts] = useState<GeneratedPost[]>([])
  const [models, setModels] = useState<OllamaModel[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [ollamaLoading, setOllamaLoading] = useState(true)
  const [ollamaError, setOllamaError] = useState('')
  const [generationError, setGenerationError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)

  const approved = useMemo(() => posts.filter(post => post.status === 'approved').length, [posts])

  async function loadModels() {
    setOllamaLoading(true)
    setOllamaError('')
    try {
      const result = await (window as any).marketing.listModels() as ModelsResult
      if (!result.ok) {
        setModels([])
        setSelectedModel('')
        setOllamaError(result.error ?? 'Could not connect to Ollama.')
        return
      }

      setModels(result.models)
      setSelectedModel(current => {
        if (current && result.models.some(model => model.name === current)) return current
        return result.models[0]?.name ?? ''
      })

      if (result.models.length === 0) {
        setOllamaError('Ollama is running, but no local models are installed. Pull a model in Ollama first.')
      }
    } catch (error) {
      setOllamaError(error instanceof Error ? error.message : String(error))
    } finally {
      setOllamaLoading(false)
    }
  }

  useEffect(() => {
    void loadModels()
  }, [])

  async function handleGenerate() {
    if (!selectedModel || generating) return
    setGenerating(true)
    setGenerationError('')

    try {
      const result = await (window as any).marketing.generateCampaign({
        model: selectedModel,
        goal,
        brief: brief.trim() || undefined,
      }) as GenerateResult

      if (!result.ok || !result.posts) {
        setGenerationError(result.error ?? 'The local model could not generate the campaign.')
        return
      }

      const campaign = goalCopy[goal].campaign
      const now = Date.now()
      setPosts(result.posts.map((post, index) => ({
        id: now + index,
        platform: post.platform,
        status: 'draft',
        content: `${post.content.trim()}\n\n${makeUtm(post.platform, campaign)}`,
      })))
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : String(error))
    } finally {
      setGenerating(false)
    }
  }

  function toggleApproval(id: number) {
    setPosts(current => current.map(post => post.id === id
      ? { ...post, status: post.status === 'approved' ? 'draft' : 'approved' }
      : post
    ))
  }

  async function copyPost(post: GeneratedPost) {
    await navigator.clipboard.writeText(post.content)
    setCopied(post.id)
    window.setTimeout(() => setCopied(null), 1200)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Marketing</h1>
          </div>
          <p className="text-sm text-muted-foreground">Generate user-acquisition campaigns with AI running locally through Ollama.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/tcg/marketing/video')} className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent/40">
            <Film className="h-4 w-4 text-primary" /> TikTok Video
          </button>
          <div className="rounded-lg border border-border bg-card px-4 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Approved</p>
            <p className="text-lg font-bold">{approved}/{posts.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">AI</p>
            <p className="text-sm font-semibold">Local Ollama</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Local AI</h2>
            </div>

            {ollamaLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Checking Ollama…
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`h-2 w-2 rounded-full ${ollamaError && models.length === 0 ? 'bg-destructive' : 'bg-green-500'}`} />
                  <span className="text-muted-foreground">{models.length > 0 ? `Connected · ${models.length} model${models.length === 1 ? '' : 's'}` : 'Not ready'}</span>
                </div>

                {models.length > 0 && (
                  <select
                    value={selectedModel}
                    onChange={event => setSelectedModel(event.target.value)}
                    className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                  >
                    {models.map(model => (
                      <option key={model.name} value={model.name}>
                        {model.name}{model.details?.parameter_size ? ` · ${model.details.parameter_size}` : ''}{model.size ? ` · ${formatModelSize(model.size)}` : ''}
                      </option>
                    ))}
                  </select>
                )}

                {ollamaError && (
                  <div className="mt-3 flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{ollamaError}</span>
                  </div>
                )}

                <button onClick={() => void loadModels()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh models
                </button>
              </>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Campaign goal</h2>
            </div>
            <div className="space-y-2">
              {(Object.keys(goalCopy) as Goal[]).map(key => (
                <button
                  key={key}
                  onClick={() => setGoal(key)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition ${goal === key ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent/40 hover:text-foreground'}`}
                >
                  {goalCopy[key].label}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">AI brief</h2>
            </div>
            <textarea
              value={brief}
              onChange={event => setBrief(event.target.value)}
              rows={6}
              placeholder="Optional: feature release, collector problem, set, card, campaign angle, tone…"
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={() => void handleGenerate()}
              disabled={generating || !selectedModel}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? 'Local model is writing…' : 'Generate with local AI'}
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              The selected Ollama model generates the copy through the Ollama server running on this machine. This feature does not require a paid model API key.
            </p>
          </section>
        </aside>

        <main className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-card p-4"><Users className="mb-2 h-4 w-4 text-primary" /><p className="text-xs text-muted-foreground">Objective</p><p className="mt-1 text-sm font-semibold">Acquire users</p></div>
            <div className="rounded-xl border border-border bg-card p-4"><BarChart3 className="mb-2 h-4 w-4 text-primary" /><p className="text-xs text-muted-foreground">Tracking</p><p className="mt-1 text-sm font-semibold">UTM per platform</p></div>
            <div className="rounded-xl border border-border bg-card p-4"><Target className="mb-2 h-4 w-4 text-primary" /><p className="text-xs text-muted-foreground">Current angle</p><p className="mt-1 text-sm font-semibold">{goalCopy[goal].label}</p></div>
          </div>

          {generationError && (
            <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{generationError}</span>
            </div>
          )}

          {posts.length === 0 && !generating && (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
              <Sparkles className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">No campaign generated yet</p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">Choose a local model and campaign goal, add any useful context, then generate. The model will create a separate acquisition post for each platform.</p>
            </div>
          )}

          {posts.map(post => (
            <article key={post.id} className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{post.platform}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${post.status === 'approved' ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'}`}>{post.status}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => void copyPost(post)} className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                    <Copy className="h-3.5 w-3.5" />{copied === post.id ? 'Copied' : 'Copy'}
                  </button>
                  <button onClick={() => toggleApproval(post.id)} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${post.status === 'approved' ? 'border border-border text-muted-foreground' : 'bg-primary text-primary-foreground'}`}>
                    <Check className="h-3.5 w-3.5" />{post.status === 'approved' ? 'Unapprove' : 'Approve'}
                  </button>
                </div>
              </div>
              <textarea
                value={post.content}
                onChange={event => setPosts(current => current.map(item => item.id === post.id ? { ...item, content: event.target.value } : item))}
                rows={9}
                className="w-full resize-y bg-transparent p-5 text-sm leading-relaxed text-foreground outline-none"
              />
            </article>
          ))}
        </main>
      </div>
    </div>
  )
}
