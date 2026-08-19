import { useMemo, useState } from 'react'
import { BarChart3, Check, Copy, Megaphone, RefreshCw, Sparkles, Target, Users } from 'lucide-react'

type Platform = 'Facebook' | 'Instagram' | 'LinkedIn' | 'Discord'
type Goal = 'registrations' | 'collection' | 'trading' | 'marketplace'
type Status = 'draft' | 'approved'

interface GeneratedPost {
  id: number
  platform: Platform
  content: string
  status: Status
}

const goalCopy: Record<Goal, { label: string; hook: string; body: string; campaign: string }> = {
  registrations: {
    label: 'New registrations',
    hook: 'Your Pokémon collection deserves better than another spreadsheet.',
    body: 'Track your cards, wishlist what you still need, and keep your collection together in SixByFive TCG. Create an account for free and start building your collection today.',
    campaign: 'new_users',
  },
  collection: {
    label: 'Collection tracking',
    hook: 'How much of your collection can you actually keep track of?',
    body: 'SixByFive TCG gives collectors one place to organise cards, build binders, manage a wishlist and keep an eye on their collection. Start adding yours for free.',
    campaign: 'collection_tracking',
  },
  trading: {
    label: 'Trading',
    hook: 'The cards sitting in your binder could be the cards another collector needs.',
    body: 'Trading is live on SixByFive TCG. Add your collection, find cards you need and turn duplicates into useful trades with other collectors.',
    campaign: 'trading',
  },
  marketplace: {
    label: 'Marketplace',
    hook: 'Buying and selling Pokémon cards should start with the cards you actually care about.',
    body: 'The SixByFive TCG marketplace is live alongside collection tracking, wishlists and trading. Discover cards, manage your collection and find your next pickup in one place.',
    campaign: 'marketplace',
  },
}

const platformNotes: Record<Platform, string> = {
  Facebook: 'What are you currently collecting?',
  Instagram: 'What card is at the top of your wishlist right now?',
  LinkedIn: 'We built SixByFive around a simple idea: collector tools should connect instead of living in separate spreadsheets and apps.',
  Discord: 'Collectors: what are you chasing at the moment?',
}

function makeUtm(platform: Platform, campaign: string): string {
  const source = platform.toLowerCase()
  return `https://tcg.sixbyfive.com/?utm_source=${source}&utm_medium=social&utm_campaign=${campaign}`
}

function generatePosts(goal: Goal): GeneratedPost[] {
  const copy = goalCopy[goal]
  const platforms: Platform[] = ['Facebook', 'Instagram', 'LinkedIn', 'Discord']

  return platforms.map((platform, index) => ({
    id: Date.now() + index,
    platform,
    status: 'draft',
    content: `${copy.hook}\n\n${copy.body}\n\n${platformNotes[platform]}\n\n${makeUtm(platform, copy.campaign)}`,
  }))
}

export function MarketingPage(): JSX.Element {
  const [goal, setGoal] = useState<Goal>('registrations')
  const [brief, setBrief] = useState('')
  const [posts, setPosts] = useState<GeneratedPost[]>(() => generatePosts('registrations'))
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)

  const approved = useMemo(() => posts.filter(post => post.status === 'approved').length, [posts])

  function handleGenerate() {
    setGenerating(true)
    window.setTimeout(() => {
      const next = generatePosts(goal).map(post => ({
        ...post,
        content: brief.trim() ? `${post.content}\n\nCampaign note: ${brief.trim()}` : post.content,
      }))
      setPosts(next)
      setGenerating(false)
    }, 350)
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
          <p className="text-sm text-muted-foreground">Create acquisition campaigns designed to turn collectors into SixByFive users.</p>
        </div>
        <div className="flex gap-2">
          <div className="rounded-lg border border-border bg-card px-4 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Approved</p>
            <p className="text-lg font-bold">{approved}/{posts.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Primary KPI</p>
            <p className="text-sm font-semibold">Registrations</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
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
              <h2 className="text-sm font-semibold">Generation brief</h2>
            </div>
            <textarea
              value={brief}
              onChange={event => setBrief(event.target.value)}
              rows={5}
              placeholder="Optional: feature, card, set, offer or angle to focus on…"
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? 'Generating…' : 'Generate campaign'}
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              The first version creates platform-specific acquisition drafts locally. AI/provider integration and automatic publishing can be connected next without changing this workflow.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold">Acquisition funnel</h2>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Content</span><span>Platform post</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Traffic</span><span>UTM link</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Conversion</span><span>Registration</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Activation</span><span>First card added</span></div>
            </div>
          </section>
        </aside>

        <main className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-card p-4"><Users className="mb-2 h-4 w-4 text-primary" /><p className="text-xs text-muted-foreground">Campaign objective</p><p className="mt-1 text-sm font-semibold">Acquire users</p></div>
            <div className="rounded-xl border border-border bg-card p-4"><BarChart3 className="mb-2 h-4 w-4 text-primary" /><p className="text-xs text-muted-foreground">Tracking</p><p className="mt-1 text-sm font-semibold">UTM per platform</p></div>
            <div className="rounded-xl border border-border bg-card p-4"><Target className="mb-2 h-4 w-4 text-primary" /><p className="text-xs text-muted-foreground">Current angle</p><p className="mt-1 text-sm font-semibold">{goalCopy[goal].label}</p></div>
          </div>

          {posts.map(post => (
            <article key={post.id} className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{post.platform}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${post.status === 'approved' ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'}`}>{post.status}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => copyPost(post)} className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground">
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
                rows={8}
                className="w-full resize-y bg-transparent p-5 text-sm leading-relaxed text-foreground outline-none"
              />
            </article>
          ))}
        </main>
      </div>
    </div>
  )
}
