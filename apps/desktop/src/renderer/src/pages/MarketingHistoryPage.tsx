import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, Copy, History, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type Metric = { type: string; name: string; value: number; unit?: string | null }
type Publication = {
  provider: 'buffer'
  providerPostId: string
  channelName?: string
  service?: string
  mode: 'shareNow' | 'addToQueue'
  createdAt: string
  dueAt?: string | null
  metrics?: Metric[]
}
type CampaignPost = {
  id: number
  platform: string
  content: string
  status: 'draft' | 'approved'
  publications?: Publication[]
}
type Campaign = {
  id: string
  createdAt: string
  updatedAt?: string
  model: string
  goal: string
  brief: string
  posts: CampaignPost[]
  liveDataSnapshot?: {
    attribution?: {
      campaigns?: Array<{ campaignId?: string | null; registrations?: number }>
    }
  }
}

function metricValue(metrics: Metric[] | undefined, type: string): number {
  const wanted = type.toLowerCase()
  return Number(metrics?.find(metric =>
    String(metric.type).toLowerCase() === wanted || String(metric.name).toLowerCase() === wanted
  )?.value ?? 0)
}

function registrationsFor(campaign: Campaign): number {
  return Number(campaign.liveDataSnapshot?.attribution?.campaigns?.find(item => item.campaignId === campaign.id)?.registrations ?? 0)
}

export function MarketingHistoryPage(): JSX.Element {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<number | null>(null)

  async function loadCampaigns() {
    setLoading(true)
    setError('')
    try {
      const result = await (window as any).marketing.listCampaigns()
      if (!result?.ok) throw new Error(result?.error ?? 'Could not load campaigns.')
      setCampaigns(Array.isArray(result.campaigns) ? result.campaigns : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadCampaigns() }, [])

  const totals = useMemo(() => campaigns.reduce((summary, campaign) => {
    summary.campaigns += 1
    summary.publications += campaign.posts.reduce((sum, post) => sum + (post.publications?.length ?? 0), 0)
    summary.registrations += registrationsFor(campaign)
    return summary
  }, { campaigns: 0, publications: 0, registrations: 0 }), [campaigns])

  async function copyPost(post: CampaignPost) {
    await navigator.clipboard.writeText(post.content)
    setCopiedId(post.id)
    window.setTimeout(() => setCopiedId(null), 1200)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Campaign history</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Review generated campaigns, publication history and the evidence used by future local-AI generations.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/tcg/marketing')} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Marketing
          </button>
          <button onClick={() => void loadCampaigns()} disabled={loading} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Campaigns</p><p className="mt-1 text-xl font-bold">{totals.campaigns}</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Buffer publications</p><p className="mt-1 text-xl font-bold">{totals.publications}</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Attributed registrations</p><p className="mt-1 text-xl font-bold">{totals.registrations}</p></div>
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="flex min-h-48 items-center justify-center rounded-xl border border-border bg-card/40 text-sm text-muted-foreground"><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading campaigns…</div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No saved campaigns yet.</div>
      ) : (
        <div className="space-y-4">
          {campaigns.map(campaign => {
            const registrations = registrationsFor(campaign)
            const publications = campaign.posts.flatMap(post => post.publications ?? [])
            const clicks = publications.reduce((sum, publication) => sum + metricValue(publication.metrics, 'clicks'), 0)
            const impressions = publications.reduce((sum, publication) => sum + metricValue(publication.metrics, 'impressions'), 0)

            return (
              <article key={campaign.id} className="rounded-xl border border-border bg-card">
                <div className="border-b border-border px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{campaign.id}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{campaign.goal}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{campaign.model}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Created {new Date(campaign.createdAt).toLocaleString()}</p>
                  {campaign.brief && <p className="mt-2 max-w-3xl text-sm">{campaign.brief}</p>}
                </div>

                <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-3">
                  <div className="rounded-lg bg-background/40 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Registrations</p><p className="mt-1 text-lg font-semibold">{registrations}</p></div>
                  <div className="rounded-lg bg-background/40 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Clicks</p><p className="mt-1 text-lg font-semibold">{clicks.toLocaleString()}</p></div>
                  <div className="rounded-lg bg-background/40 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Impressions</p><p className="mt-1 text-lg font-semibold">{impressions.toLocaleString()}</p></div>
                </div>

                <div className="divide-y divide-border">
                  {campaign.posts.map(post => (
                    <div key={post.id} className="p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">{post.platform}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${post.status === 'approved' ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'}`}>{post.status}</span>
                          {(post.publications?.length ?? 0) > 0 && <BarChart3 className="h-3.5 w-3.5 text-primary" />}
                        </div>
                        <button onClick={() => void copyPost(post)} className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"><Copy className="h-3 w-3" /> {copiedId === post.id ? 'Copied' : 'Copy'}</button>
                      </div>
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{post.content}</p>
                    </div>
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
