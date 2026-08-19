import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, BarChart3, CheckCircle2, History, RefreshCw, Send, Unplug } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { MarketingPage } from './MarketingPage'

type BufferChannel = { id: string; name: string; service: string; organizationId: string }
type Metric = { type: string; name: string; value: number; unit?: string | null }
type Publication = {
  provider: 'buffer'
  providerPostId: string
  channelId: string
  channelName?: string
  service?: string
  mode: 'shareNow' | 'addToQueue'
  createdAt: string
  dueAt?: string | null
  externalLink?: string | null
  metrics?: Metric[]
  metricsUpdatedAt?: string | null
}
type StoredPost = {
  id: number
  platform: 'Facebook' | 'Instagram' | 'LinkedIn' | 'Discord'
  content: string
  status: 'draft' | 'approved'
  publications?: Publication[]
}
type StoredCampaign = { id: string; posts: StoredPost[] }

const platformService: Partial<Record<StoredPost['platform'], string>> = {
  Facebook: 'facebook',
  Instagram: 'instagram',
  LinkedIn: 'linkedin',
}

function metricValue(metrics: Metric[] | undefined, type: string): number {
  const wanted = type.toLowerCase()
  return Number(metrics?.find(metric =>
    metric.type.toLowerCase() === wanted || metric.name.toLowerCase() === wanted
  )?.value ?? 0)
}

export function MarketingHubPage(): JSX.Element {
  const navigate = useNavigate()
  const [channels, setChannels] = useState<BufferChannel[]>([])
  const [connected, setConnected] = useState(false)
  const [campaign, setCampaign] = useState<StoredCampaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [publishing, setPublishing] = useState<string | null>(null)

  const approvedPosts = useMemo(() => campaign?.posts?.filter(post => post.status === 'approved') ?? [], [campaign])
  const publicationCount = useMemo(() => campaign?.posts.reduce((sum, post) => sum + (post.publications?.length ?? 0), 0) ?? 0, [campaign])

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const [connectionResult, campaignResult] = await Promise.all([
        (window as any).marketing.getBufferConnection(),
        (window as any).marketing.getActiveCampaign(),
      ])
      setConnected(Boolean(connectionResult?.connected))
      setChannels(Array.isArray(connectionResult?.channels) ? connectionResult.channels : [])
      setCampaign(campaignResult?.campaign ?? null)
      if (connectionResult?.ok === false) setError(connectionResult.error ?? 'Could not connect to Buffer.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  async function syncMetrics() {
    setMetricsLoading(true)
    setError('')
    setMessage('')
    try {
      const result = await (window as any).marketing.syncBufferMetrics()
      if (!result?.ok && !result?.synced) {
        setError(result?.error ?? result?.errors?.join('; ') ?? 'Could not sync Buffer metrics.')
        return
      }
      setMessage(`Synced Buffer metrics for ${result?.synced ?? 0} published post${result?.synced === 1 ? '' : 's'}.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setMetricsLoading(false)
    }
  }

  async function publish(post: StoredPost, channel: BufferChannel, mode: 'shareNow' | 'addToQueue') {
    if (!campaign) return
    const key = `${post.id}:${channel.id}:${mode}`
    setPublishing(key)
    setError('')
    setMessage('')
    try {
      const result = await (window as any).marketing.publishBuffer({
        campaignId: campaign.id,
        postId: post.id,
        channelId: channel.id,
        channelName: channel.name,
        service: channel.service,
        text: post.content,
        mode,
      })
      if (!result?.ok) {
        setError(result?.error ?? 'Buffer could not create the post.')
        return
      }
      setMessage(`${post.platform} post ${mode === 'shareNow' ? 'sent for immediate publishing' : 'added to the Buffer queue'}.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPublishing(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="mx-auto max-w-7xl rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {connected ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Unplug className="h-5 w-5 text-muted-foreground" />}
              <h2 className="text-base font-semibold">Connected social accounts</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Buffer handles Facebook, Instagram and LinkedIn publishing and performance metrics.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/tcg/marketing/history')} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
              <History className="h-3.5 w-3.5" /> Campaign history
            </button>
            {connected && publicationCount > 0 && (
              <button onClick={() => void syncMetrics()} disabled={metricsLoading} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
                <BarChart3 className="h-3.5 w-3.5" /> {metricsLoading ? 'Syncing…' : 'Sync metrics'}
              </button>
            )}
            <button onClick={() => void refresh()} disabled={loading} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {!connected && !loading && (
          <div className="mt-4 rounded-md border border-border bg-background/40 p-3 text-xs text-muted-foreground">
            Add a Vault entry named <strong>SixByFive Marketing - Buffer API</strong> and put your Buffer personal API key in its password field, then click Refresh.
          </div>
        )}

        {connected && (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {['facebook', 'instagram', 'linkedin'].map(service => {
              const matching = channels.filter(channel => channel.service === service)
              return (
                <div key={service} className="rounded-lg border border-border bg-background/40 p-3">
                  <div className="text-xs font-semibold capitalize">{service}</div>
                  {matching.length ? matching.map(channel => <div key={channel.id} className="mt-1 text-xs text-muted-foreground">● {channel.name}</div>) : <div className="mt-1 text-xs text-muted-foreground">Not connected in Buffer</div>}
                </div>
              )
            })}
          </div>
        )}

        {error && <div className="mt-4 flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}</div>}
        {message && <div className="mt-4 rounded-md border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-400">{message}</div>}

        {connected && approvedPosts.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <div className="mb-3 flex items-center gap-2"><Send className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Publish approved posts</h3></div>
            <div className="space-y-3">
              {approvedPosts.map(post => {
                const service = platformService[post.platform]
                if (!service) return null
                const matchingChannels = channels.filter(channel => channel.service === service)
                return (
                  <div key={post.id} className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold">{post.platform}</div>
                      {(post.publications?.length ?? 0) > 0 && <span className="text-[10px] text-green-400">Published/queued</span>}
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{post.content}</p>

                    {(post.publications ?? []).map(publication => (
                      <div key={publication.providerPostId} className="mt-3 rounded-md bg-background/50 p-2 text-[11px] text-muted-foreground">
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          <span>{publication.channelName ?? publication.service ?? 'Buffer'}</span>
                          <span>Clicks: {metricValue(publication.metrics, 'clicks').toLocaleString()}</span>
                          <span>Impressions: {metricValue(publication.metrics, 'impressions').toLocaleString()}</span>
                          <span>Reactions: {metricValue(publication.metrics, 'reactions').toLocaleString()}</span>
                          <span>Shares: {(metricValue(publication.metrics, 'shares') + metricValue(publication.metrics, 'reposts')).toLocaleString()}</span>
                        </div>
                        <div className="mt-1 text-[10px] opacity-70">
                          {publication.metricsUpdatedAt ? `Metrics updated ${new Date(publication.metricsUpdatedAt).toLocaleString()}` : 'Metrics not available yet — Buffer refreshes sent-post metrics after publishing.'}
                        </div>
                      </div>
                    ))}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {matchingChannels.map(channel => (
                        <div key={channel.id} className="flex items-center gap-1 rounded-md border border-border p-1">
                          <span className="px-2 text-[11px] text-muted-foreground">{channel.name}</span>
                          <button onClick={() => void publish(post, channel, 'shareNow')} disabled={publishing !== null} className="rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50">
                            {publishing === `${post.id}:${channel.id}:shareNow` ? 'Publishing…' : 'Publish now'}
                          </button>
                          <button onClick={() => void publish(post, channel, 'addToQueue')} disabled={publishing !== null} className="rounded border border-border px-2 py-1 text-[11px] disabled:opacity-50">
                            {publishing === `${post.id}:${channel.id}:addToQueue` ? 'Adding…' : 'Add to queue'}
                          </button>
                        </div>
                      ))}
                      {matchingChannels.length === 0 && <span className="text-[11px] text-muted-foreground">Connect a {post.platform} channel in Buffer first.</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>
      <MarketingPage />
    </div>
  )
}
