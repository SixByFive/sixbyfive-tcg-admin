import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Signal, ShoppingBag, HeartPulse, Cpu, KeyRound, Braces,
  Rocket, TerminalSquare, LayoutDashboard, Users, ArrowLeftRight,
  Store, BarChart3, Flag, ScrollText, Bell, BookOpen, Library,
  Package, CreditCard, Wallet, FileCheck, Star, Database, Server,
  Container, Mail, Building2, Home, Activity, Images, ScanLine,
  Dumbbell, BarChart2, FlaskConical, Settings, Copy, Check,
  Play, RefreshCw, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCommandPalette } from '@/context/CommandPaletteContext'
import { usePermissions } from '@/context/PermissionsContext'

interface Command {
  id:          string
  title:       string
  subtitle?:   string
  group:       'navigate' | 'snippet' | 'action'
  icon:        React.ElementType
  keywords?:   string[]
  permission?: string
  action:      () => void | Promise<void>
}

const NAV_COMMANDS: Omit<Command, 'action'>[] = [
  { id: 'nav-status',           group: 'navigate', icon: Signal,         title: 'Status Board',      subtitle: 'Service health' },
  { id: 'nav-tcg',              group: 'navigate', icon: LayoutDashboard,title: 'TCG Dashboard',     subtitle: 'TCG Admin',  permission: 'tcg' },
  { id: 'nav-tcg-users',        group: 'navigate', icon: Users,          title: 'TCG Users',         subtitle: 'TCG Admin',  permission: 'tcg' },
  { id: 'nav-tcg-orders',       group: 'navigate', icon: ShoppingBag,    title: 'TCG Orders',        subtitle: 'TCG Admin',  permission: 'tcg' },
  { id: 'nav-tcg-trades',       group: 'navigate', icon: ArrowLeftRight, title: 'TCG Trades',        subtitle: 'TCG Admin',  permission: 'tcg' },
  { id: 'nav-tcg-marketplace',  group: 'navigate', icon: Store,          title: 'TCG Marketplace',   subtitle: 'TCG Admin',  permission: 'tcg' },
  { id: 'nav-tcg-financials',   group: 'navigate', icon: BarChart3,      title: 'TCG Financials',    subtitle: 'TCG Admin',  permission: 'tcg.financial' },
  { id: 'nav-tcg-reports',      group: 'navigate', icon: Flag,           title: 'TCG Reported Users',subtitle: 'TCG Admin',  permission: 'tcg' },
  { id: 'nav-tcg-audit',        group: 'navigate', icon: ScrollText,     title: 'TCG Audit Logs',    subtitle: 'TCG Admin',  permission: 'tcg' },
  { id: 'nav-tcg-notifications',group: 'navigate', icon: Bell,           title: 'TCG Notifications', subtitle: 'TCG Admin',  permission: 'tcg' },
  { id: 'nav-tcg-binders',      group: 'navigate', icon: BookOpen,       title: 'TCG Binders',       subtitle: 'TCG Admin',  permission: 'tcg' },
  { id: 'nav-tcg-collections',  group: 'navigate', icon: Library,        title: 'TCG Collections',   subtitle: 'TCG Admin',  permission: 'tcg' },
  { id: 'nav-tcg-products',     group: 'navigate', icon: Package,        title: 'TCG Products',      subtitle: 'TCG Admin',  permission: 'tcg' },
  { id: 'nav-tcg-subs',         group: 'navigate', icon: CreditCard,     title: 'TCG Subscriptions', subtitle: 'TCG Admin',  permission: 'tcg' },
  { id: 'nav-tcg-withdrawals',  group: 'navigate', icon: Wallet,         title: 'TCG Withdrawals',   subtitle: 'TCG Admin',  permission: 'tcg.financial' },
  { id: 'nav-tcg-proofqueue',   group: 'navigate', icon: FileCheck,      title: 'TCG Proof Queue',   subtitle: 'TCG Admin',  permission: 'tcg' },
  { id: 'nav-tcg-reviews',      group: 'navigate', icon: Star,           title: 'TCG Reviews',       subtitle: 'TCG Admin',  permission: 'tcg' },
  { id: 'nav-tcg-sets',         group: 'navigate', icon: Database,       title: 'TCG Set Ingestion', subtitle: 'TCG Admin',  permission: 'tcg' },
  { id: 'nav-tcg-services',     group: 'navigate', icon: Server,         title: 'TCG Services',      subtitle: 'TCG Admin',  permission: 'tcg' },
  { id: 'nav-tcg-docker',       group: 'navigate', icon: Container,      title: 'TCG Docker',        subtitle: 'TCG Admin',  permission: 'tcg' },
  { id: 'nav-tcg-mailboxes',    group: 'navigate', icon: Mail,           title: 'TCG Webmail',       subtitle: 'TCG Admin',  permission: 'tcg' },
  { id: 'nav-kora',             group: 'navigate', icon: HeartPulse,     title: 'Kora Dashboard',    subtitle: 'Kora Admin', permission: 'kora' },
  { id: 'nav-kora-orgs',        group: 'navigate', icon: Building2,      title: 'Kora Organisations',subtitle: 'Kora Admin', permission: 'kora' },
  { id: 'nav-kora-homes',       group: 'navigate', icon: Home,           title: 'Kora Care Homes',   subtitle: 'Kora Admin', permission: 'kora' },
  { id: 'nav-kora-health',      group: 'navigate', icon: Activity,       title: 'Kora API Health',   subtitle: 'Kora Admin', permission: 'kora' },
  { id: 'nav-kora-docker',      group: 'navigate', icon: Container,      title: 'Kora Docker',       subtitle: 'Kora Admin', permission: 'kora' },
  { id: 'nav-kora-mailboxes',   group: 'navigate', icon: Mail,           title: 'Kora Webmail',      subtitle: 'Kora Admin', permission: 'kora' },
  { id: 'nav-vault',            group: 'navigate', icon: KeyRound,       title: 'Vault',             subtitle: 'Credentials' },
  { id: 'nav-snippets',         group: 'navigate', icon: Braces,         title: 'Snippets',          subtitle: 'Commands & queries' },
  { id: 'nav-release',          group: 'navigate', icon: Rocket,         title: 'Release Manager',   subtitle: 'Build & deploy' },
  { id: 'nav-ssh-terminal',     group: 'navigate', icon: TerminalSquare, title: 'SSH Terminal',      subtitle: 'SSH' },
  { id: 'nav-ssh-connections',  group: 'navigate', icon: Settings,       title: 'SSH Connections',   subtitle: 'SSH' },
  { id: 'nav-vl-dataset',       group: 'navigate', icon: Images,         title: 'VL Dataset',        subtitle: 'Vision Lab', permission: 'vl' },
  { id: 'nav-vl-process',       group: 'navigate', icon: ScanLine,       title: 'VL Process',        subtitle: 'Vision Lab', permission: 'vl' },
  { id: 'nav-vl-train',         group: 'navigate', icon: Dumbbell,       title: 'VL Train',          subtitle: 'Vision Lab', permission: 'vl' },
  { id: 'nav-vl-results',       group: 'navigate', icon: BarChart2,      title: 'VL Results',        subtitle: 'Vision Lab', permission: 'vl' },
  { id: 'nav-vl-test',          group: 'navigate', icon: FlaskConical,   title: 'VL Test',           subtitle: 'Vision Lab', permission: 'vl' },
  { id: 'nav-vl-settings',      group: 'navigate', icon: Settings,       title: 'VL Settings',       subtitle: 'Vision Lab', permission: 'vl' },
  { id: 'nav-vl-browser',       group: 'navigate', icon: Cpu,            title: 'VL Dataset Browser',subtitle: 'Vision Lab', permission: 'vl' },
]

const NAV_ROUTES: Record<string, string> = {
  'nav-status': '/status', 'nav-tcg': '/tcg', 'nav-tcg-users': '/tcg/users',
  'nav-tcg-orders': '/tcg/orders', 'nav-tcg-trades': '/tcg/trades',
  'nav-tcg-marketplace': '/tcg/marketplace', 'nav-tcg-financials': '/tcg/financials',
  'nav-tcg-reports': '/tcg/reported-users', 'nav-tcg-audit': '/tcg/audit-logs',
  'nav-tcg-notifications': '/tcg/notifications', 'nav-tcg-binders': '/tcg/binders',
  'nav-tcg-collections': '/tcg/collections', 'nav-tcg-products': '/tcg/products',
  'nav-tcg-subs': '/tcg/subscriptions', 'nav-tcg-withdrawals': '/tcg/withdrawals',
  'nav-tcg-proofqueue': '/tcg/proof-queue', 'nav-tcg-reviews': '/tcg/reviews',
  'nav-tcg-sets': '/tcg/sets', 'nav-tcg-services': '/tcg/services',
  'nav-tcg-docker': '/tcg/docker', 'nav-tcg-mailboxes': '/tcg/mailboxes',
  'nav-kora': '/kora', 'nav-kora-orgs': '/kora/orgs', 'nav-kora-homes': '/kora/homes',
  'nav-kora-health': '/kora/health', 'nav-kora-docker': '/kora/docker',
  'nav-kora-mailboxes': '/kora/mailboxes', 'nav-vault': '/vault',
  'nav-snippets': '/snippets', 'nav-release': '/release',
  'nav-ssh-terminal': '/ssh/terminal', 'nav-ssh-connections': '/ssh/connections',
  'nav-vl-dataset': '/vl/dataset', 'nav-vl-process': '/vl/process',
  'nav-vl-train': '/vl/train', 'nav-vl-results': '/vl/results',
  'nav-vl-test': '/vl/test', 'nav-vl-settings': '/vl/settings',
  'nav-vl-browser': '/vl/browser',
}

const GROUP_LABELS: Record<Command['group'], string> = {
  navigate: 'Go to',
  snippet:  'Snippets',
  action:   'Actions',
}

function score(text: string, query: string): number {
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  if (t === q)            return 3
  if (t.startsWith(q))    return 2
  if (t.includes(q))      return 1
  return 0
}

function matches(cmd: Command, query: string): boolean {
  if (!query) return true
  const fields = [cmd.title, cmd.subtitle ?? '', ...(cmd.keywords ?? [])]
  return fields.some(f => score(f, query) > 0)
}

function rankScore(cmd: Command, query: string): number {
  const fields = [cmd.title, cmd.subtitle ?? '', ...(cmd.keywords ?? [])]
  return Math.max(...fields.map(f => score(f, query)))
}

export function CommandPalette(): JSX.Element {
  const { isOpen, close } = useCommandPalette()
  const { can } = usePermissions()
  const navigate   = useNavigate()
  const inputRef   = useRef<HTMLInputElement>(null)
  const listRef    = useRef<HTMLDivElement>(null)

  const [query, setQuery]           = useState('')
  const [activeIdx, setActiveIdx]   = useState(0)
  const [snippets, setSnippets]     = useState<Array<{ id: string; title: string; body: string; language?: string; category?: string }>>([])
  const [copiedId, setCopiedId]     = useState<string | null>(null)
  const [sentId, setSentId]         = useState<string | null>(null)

  // Load snippets when palette opens
  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setActiveIdx(0)
    setTimeout(() => inputRef.current?.focus(), 10)
    const api = (window as any).snippets
    if (api) api.list().then(setSnippets).catch(() => {})
  }, [isOpen])

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = NAV_COMMANDS
      .filter(c => !c.permission || can(c.permission))
      .map(c => ({
        ...c,
        action: () => { navigate(NAV_ROUTES[c.id]); close() },
      }))

    const snip: Command[] = snippets.flatMap(s => [
      {
        id:       `snip-copy-${s.id}`,
        title:    s.title,
        subtitle: s.category ? `Copy · ${s.category}` : 'Copy snippet',
        group:    'snippet' as const,
        icon:     Copy,
        keywords: [s.body.slice(0, 60), s.language ?? '', s.category ?? ''],
        action:   async () => {
          await navigator.clipboard.writeText(s.body)
          setCopiedId(s.id)
          setTimeout(() => setCopiedId(null), 1500)
        },
      },
      {
        id:       `snip-run-${s.id}`,
        title:    s.title,
        subtitle: s.category ? `Run in terminal · ${s.category}` : 'Run in terminal',
        group:    'snippet' as const,
        icon:     TerminalSquare,
        keywords: [s.body.slice(0, 60), s.language ?? '', s.category ?? ''],
        action:   async () => {
          const ssh = (window as any).ssh
          if (!ssh) return
          const tabs = await ssh.getConnectedTabs()
          if (tabs.length === 0) return
          await ssh.input({ tabId: tabs[tabs.length - 1].tabId, data: s.body + '\n' })
          setSentId(s.id)
          setTimeout(() => setSentId(null), 1500)
          close()
        },
      },
    ])

    const actions: Command[] = [
      {
        id: 'action-check-updates', group: 'action', icon: RefreshCw,
        title: 'Check for updates',
        action: async () => {
          close()
          const rm = (window as any).releaseManager
          if (rm) await rm.checkForUpdates()
          navigate('/release')
        },
      },
      {
        id: 'action-trigger-build', group: 'action', icon: Play,
        title: 'Trigger build on main',
        subtitle: 'Release Manager',
        action: async () => {
          close()
          const rm = (window as any).releaseManager
          if (rm) await rm.triggerWorkflow('main')
          navigate('/release')
        },
      },
    ]

    return [...nav, ...snip, ...actions]
  }, [snippets, navigate, close])

  const filtered = useMemo(() => {
    const q = query.trim()
    const matched = commands.filter(c => matches(c, q))
    if (q) matched.sort((a, b) => rankScore(b, q) - rankScore(a, q))
    return matched
  }, [commands, query])

  // Reset active index when results change
  useEffect(() => { setActiveIdx(0) }, [filtered.length, query])

  // Keyboard nav inside list
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      filtered[activeIdx]?.action()
    } else if (e.key === 'Escape') {
      close()
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  if (!isOpen) return <></>

  // Group filtered results preserving order but adding headers
  const groups = (['navigate', 'snippet', 'action'] as Command['group'][])
    .map(g => ({ group: g, items: filtered.filter(c => c.group === g) }))
    .filter(g => g.items.length > 0)

  let globalIdx = 0

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      onMouseDown={() => close()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, snippets, actions…"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[420px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No results for "{query}"</p>
          ) : (
            groups.map(({ group, items }) => (
              <div key={group}>
                <p className="px-4 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/40">
                  {GROUP_LABELS[group]}
                </p>
                {items.map(cmd => {
                  const idx = globalIdx++
                  const isActive = idx === activeIdx
                  const Icon = cmd.icon
                  const isCopied = cmd.id.startsWith('snip-copy-') && copiedId && cmd.id === `snip-copy-${copiedId}`
                  const isSent   = cmd.id.startsWith('snip-run-')  && sentId   && cmd.id === `snip-run-${sentId}`
                  return (
                    <button
                      key={cmd.id}
                      data-idx={idx}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => cmd.action()}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        isActive ? 'bg-accent' : 'hover:bg-accent/50'
                      )}
                    >
                      <span className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                        isActive ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground'
                      )}>
                        {(isCopied || isSent)
                          ? <Check className="h-3.5 w-3.5 text-green-500" />
                          : <Icon className="h-3.5 w-3.5" />
                        }
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{cmd.title}</span>
                        {cmd.subtitle && (
                          <span className="block truncate text-[11px] text-muted-foreground">{cmd.subtitle}</span>
                        )}
                      </span>
                      {isActive && (
                        <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          ↵
                        </kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t border-border px-4 py-2">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[9px]">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[9px]">↵</kbd> select
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[9px]">Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  )
}
