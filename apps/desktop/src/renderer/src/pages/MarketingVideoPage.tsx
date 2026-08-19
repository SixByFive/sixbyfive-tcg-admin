import { useEffect, useState } from 'react'
import { AlertCircle, Cpu, Film, FolderOpen, RefreshCw, Server, Sparkles, WandSparkles } from 'lucide-react'

type Goal = 'registrations' | 'collection' | 'trading' | 'marketplace'

interface OllamaModel {
  name: string
  size?: number
  details?: { parameter_size?: string }
}

interface VideoStatus {
  ok: boolean
  connected: boolean
  ffmpeg: boolean
  gpu: boolean
  comfy: boolean
  message: string
}

const goals: Record<Goal, string> = {
  registrations: 'New registrations',
  collection: 'Collection tracking',
  trading: 'Trading',
  marketplace: 'Marketplace',
}

function firstSentence(value: string): string {
  const clean = value.replace(/https?:\/\/\S+/g, '').trim()
  const match = clean.match(/^(.{10,120}?[.!?])(?:\s|$)/)
  return (match?.[1] ?? clean.split('\n')[0] ?? 'SixByFive TCG').slice(0, 120)
}

export function MarketingVideoPage(): JSX.Element {
  const [models, setModels] = useState<OllamaModel[]>([])
  const [model, setModel] = useState('')
  const [goal, setGoal] = useState<Goal>('registrations')
  const [brief, setBrief] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [cta, setCta] = useState('Track your collection at tcg.sixbyfive.com')
  const [duration, setDuration] = useState(15)
  const [status, setStatus] = useState<VideoStatus | null>(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [outputPath, setOutputPath] = useState('')

  async function loadModels() {
    try {
      const result = await (window as any).marketing.listModels()
      if (result?.ok) {
        setModels(result.models ?? [])
        setModel((current: string) => current || result.models?.[0]?.name || '')
      }
    } catch {
      // Marketing text page already explains Ollama setup in detail.
    }
  }

  async function refreshStatus() {
    setError('')
    try {
      const result = await (window as any).marketing.videoStatus() as VideoStatus
      setStatus(result)
      if (!result.ok) setError(result.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    void loadModels()
    void refreshStatus()
    const unsubscribe = (window as any).marketing.onVideoStatus?.((event: any) => {
      setMessage(event.message ?? '')
      if (event.status === 'done' && event.outputPath) setOutputPath(event.outputPath)
    })
    return () => unsubscribe?.()
  }, [])

  async function generateScript() {
    if (!model) return
    setBusy('script')
    setError('')
    setMessage('Local Ollama is writing the TikTok concept…')
    try {
      const result = await (window as any).marketing.generateCampaign({ model, goal, brief: brief.trim() || undefined })
      if (!result?.ok || !result.posts) throw new Error(result?.error ?? 'Could not generate video copy.')
      const instagram = result.posts.find((post: any) => post.platform === 'Instagram') ?? result.posts[0]
      const content = String(instagram?.content ?? '').trim()
      setTitle(firstSentence(content))
      setBody(content)
      setMessage('Script generated locally. Edit it if needed, then render on Heimdall.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  async function setupNode() {
    setBusy('setup')
    setError('')
    setMessage('Installing ComfyUI dependencies on Heimdall…')
    try {
      const result = await (window as any).marketing.setupVideoNode()
      if (!result?.ok) throw new Error(result?.message ?? 'Setup failed.')
      setMessage(result.message)
      await refreshStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  async function startComfy() {
    setBusy('comfy')
    setError('')
    try {
      const result = await (window as any).marketing.startComfyUi()
      if (!result?.ok) throw new Error(result?.message ?? 'Could not start ComfyUI.')
      setMessage(result.message)
      window.setTimeout(() => void refreshStatus(), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  async function renderVideo() {
    if (!title.trim() || !body.trim()) return
    setBusy('render')
    setError('')
    setOutputPath('')
    try {
      const result = await (window as any).marketing.renderMotionVideo({
        title: title.trim(),
        body: body.trim(),
        cta: cta.trim() || undefined,
        duration,
      })
      if (!result?.ok) throw new Error(result?.error ?? 'Render failed.')
      setOutputPath(result.outputPath ?? '')
      setMessage('Vertical MP4 rendered on Heimdall and saved to the shared Fenrir workspace.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <Film className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">TikTok Video</h1>
        </div>
        <p className="text-sm text-muted-foreground">Write locally with Ollama, render remotely on Heimdall, and keep the finished MP4 on Fenrir.</p>
      </div>

      {error && (
        <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2"><Server className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Heimdall video node</h2></div>
            <p className="text-xs text-muted-foreground">{status?.message ?? 'Checking Heimdall…'}</p>
            {status && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="rounded-md border border-border p-2"><div className={status.ffmpeg ? 'text-green-400' : 'text-muted-foreground'}>FFmpeg</div><b>{status.ffmpeg ? 'Ready' : 'Missing'}</b></div>
                <div className="rounded-md border border-border p-2"><div className={status.gpu ? 'text-green-400' : 'text-muted-foreground'}>GPU</div><b>{status.gpu ? 'Ready' : 'Missing'}</b></div>
                <div className="rounded-md border border-border p-2"><div className={status.comfy ? 'text-green-400' : 'text-muted-foreground'}>ComfyUI</div><b>{status.comfy ? 'Running' : 'Stopped'}</b></div>
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => void refreshStatus()} className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"><RefreshCw className="mr-1.5 inline h-3.5 w-3.5" />Refresh</button>
              <button onClick={() => void setupNode()} disabled={!!busy} className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">{busy === 'setup' ? 'Setting up…' : 'Setup ComfyUI'}</button>
            </div>
            <button onClick={() => void startComfy()} disabled={!!busy} className="mt-2 w-full rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">{busy === 'comfy' ? 'Starting…' : 'Start ComfyUI on Heimdall'}</button>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">ComfyUI setup installs the software only. Wan model weights are deliberately not auto-downloaded because they are large. Motion renders below already run remotely with FFmpeg.</p>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2"><Cpu className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Local script AI</h2></div>
            <select value={model} onChange={e => setModel(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {models.length === 0 && <option value="">No Ollama models found</option>}
              {models.map(item => <option key={item.name} value={item.name}>{item.name}{item.details?.parameter_size ? ` · ${item.details.parameter_size}` : ''}</option>)}
            </select>
            <select value={goal} onChange={e => setGoal(e.target.value as Goal)} className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {(Object.keys(goals) as Goal[]).map(key => <option key={key} value={key}>{goals[key]}</option>)}
            </select>
            <textarea value={brief} onChange={e => setBrief(e.target.value)} rows={4} placeholder="Optional TikTok angle, card, set, feature or collector problem…" className="mt-2 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <button onClick={() => void generateScript()} disabled={!model || !!busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {busy === 'script' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {busy === 'script' ? 'Writing locally…' : 'Generate TikTok script'}
            </button>
          </section>
        </aside>

        <main className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2"><WandSparkles className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Video content</h2></div>
            <label className="text-xs font-medium text-muted-foreground">Hook / title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="The first thing viewers see…" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <label className="mt-4 block text-xs font-medium text-muted-foreground">Main copy</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={7} placeholder="AI-generated script or your own copy…" className="mt-1 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <label className="mt-4 block text-xs font-medium text-muted-foreground">Call to action</label>
            <input value={cta} onChange={e => setCta(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <div className="mt-4 flex items-center gap-3">
              <label className="text-xs font-medium text-muted-foreground">Duration</label>
              <select value={duration} onChange={e => setDuration(Number(e.target.value))} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value={10}>10 seconds</option><option value={15}>15 seconds</option><option value={20}>20 seconds</option><option value={30}>30 seconds</option>
              </select>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-sm font-semibold">Remote render</h2><p className="mt-1 text-xs text-muted-foreground">1080×1920 H.264 MP4 rendered by FFmpeg on Heimdall.</p></div>
              <button onClick={() => void renderVideo()} disabled={!title.trim() || !body.trim() || !!busy || !status?.ffmpeg} className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy === 'render' ? 'Rendering on Heimdall…' : 'Render vertical video'}</button>
            </div>
            {message && <p className="mt-4 rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">{message}</p>}
            {outputPath && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-green-500/30 bg-green-500/10 p-3">
                <div className="min-w-0"><p className="text-xs font-semibold text-green-400">Render complete</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{outputPath}</p></div>
                <button onClick={() => void (window as any).marketing.revealVideo(outputPath)} className="shrink-0 rounded-md border border-border px-3 py-2 text-xs"><FolderOpen className="mr-1.5 inline h-3.5 w-3.5" />Show file</button>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Generative video readiness</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">The same Heimdall node now has a ComfyUI setup/start path. Once Wan model weights and a controlled workflow are installed, this screen can submit image-to-video or text-to-video jobs to ComfyUI. The first working renderer intentionally uses real SixByFive copy and deterministic FFmpeg rather than pretending generative video is configured when the model files are not present.</p>
          </section>
        </main>
      </div>
    </div>
  )
}
