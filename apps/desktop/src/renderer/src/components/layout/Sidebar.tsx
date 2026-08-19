import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  ArrowLeftRight,
  Store,
  BarChart3,
  Flag,
  ScrollText,
  Bell,
  BookOpen,
  Library,
  Package,
  CreditCard,
  Wallet,
  FileCheck,
  Star,
  Database,
  Server,
  Container,
  Mail,
  Cpu,
  HeartPulse,
  Building2,
  Home,
  Activity,
  Images,
  ScanLine,
  Dumbbell,
  BarChart2,
  FlaskConical,
  Settings,
  KeyRound,
  Signal,
  Braces,
  Rocket,
  TerminalSquare,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuth, getTcgServiceAccount, saveTcgServiceAccount, authenticateTcg } from '@/context/AuthContext'
import { getKoraServiceAccount, saveKoraServiceAccount } from '@/context/KoraAuthContext'
import { useKoraAuth } from '@/context/KoraAuthContext'
import { useAlerts, type AlertCounts } from '@/context/AlertsContext'
import { usePermissions } from '@/context/PermissionsContext'

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  end?: boolean
  badge?: keyof AlertCounts
  permission?: string  // if set, item is hidden unless can(permission)
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const tcgNavGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/tcg', label: 'Dashboard', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'Users',
    items: [
      { to: '/tcg/users',          label: 'Users',      icon: Users },
      { to: '/tcg/reported-users', label: 'Reports',    icon: Flag,       badge: 'reports' },
      { to: '/tcg/reviews',        label: 'Reviews',    icon: Star,       badge: 'reviews' },
      { to: '/tcg/audit-logs',     label: 'Audit Logs', icon: ScrollText },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { to: '/tcg/orders',        label: 'Orders',        icon: ShoppingBag },
      { to: '/tcg/trades',        label: 'Trades',        icon: ArrowLeftRight },
      { to: '/tcg/marketplace',   label: 'Marketplace',   icon: Store },
      { to: '/tcg/subscriptions', label: 'Subscriptions', icon: CreditCard },
      { to: '/tcg/financials',    label: 'Financials',    icon: BarChart3,  permission: 'tcg.financial' },
      { to: '/tcg/withdrawals',   label: 'Withdrawals',   icon: Wallet,     badge: 'withdrawals', permission: 'tcg.financial' },
      { to: '/tcg/proof-queue',   label: 'Proof Queue',   icon: FileCheck,  badge: 'proofQueue' },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/tcg/products',    label: 'Products',      icon: Package },
      { to: '/tcg/sets',        label: 'Set Ingestion', icon: Database },
      { to: '/tcg/binders',     label: 'Binders',       icon: BookOpen },
      { to: '/tcg/collections', label: 'Collections',   icon: Library },
    ],
  },
  {
    label: 'Communications',
    items: [
      { to: '/tcg/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { to: '/tcg/services',  label: 'Services', icon: Server },
      { to: '/tcg/docker',    label: 'Docker',   icon: Container, permission: 'tcg.financial' },
      { to: '/tcg/mailboxes', label: 'Webmail',  icon: Mail,      permission: 'tcg.financial' },
    ],
  },
]

const koraNavGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/kora', label: 'Dashboard', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'Platform',
    items: [
      { to: '/kora/orgs',  label: 'Organisations', icon: Building2 },
      { to: '/kora/homes', label: 'Care Homes',     icon: Home },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { to: '/kora/health',    label: 'API Health', icon: Activity },
      { to: '/kora/docker',    label: 'Docker',     icon: Container },
      { to: '/kora/mailboxes', label: 'Webmail',    icon: Mail },
    ],
  },
]

const vlNavGroups: NavGroup[] = [
  {
    label: 'Data',
    items: [
      { to: '/vl/dataset', label: 'Dataset', icon: Images,        end: true },
      { to: '/vl/process', label: 'Process', icon: ScanLine },
      { to: '/vl/browser', label: 'Browser', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Training',
    items: [
      { to: '/vl/train',   label: 'Train',   icon: Dumbbell },
      { to: '/vl/results', label: 'Results', icon: BarChart2 },
    ],
  },
  {
    label: 'Inference',
    items: [
      { to: '/vl/test', label: 'Test', icon: FlaskConical },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { to: '/vl/settings', label: 'Settings', icon: Settings },
    ],
  },
]

const snippetsNavGroups: NavGroup[] = [
  {
    label: 'Library',
    items: [
      { to: '/snippets', label: 'All snippets', icon: Braces, end: true },
    ],
  },
]

const vaultNavGroups: NavGroup[] = [
  {
    label: 'Credentials',
    items: [
      { to: '/vault', label: 'All entries', icon: KeyRound, end: true },
    ],
  },
]

const statusNavGroups: NavGroup[] = [
  {
    label: 'Monitoring',
    items: [
      { to: '/status', label: 'Status Board', icon: Signal },
    ],
  },
]

const sshNavGroups: NavGroup[] = [
  {
    label: 'Sessions',
    items: [
      { to: '/ssh/terminal',    label: 'Terminal',    icon: TerminalSquare },
      { to: '/ssh/connections', label: 'Connections', icon: Settings },
    ],
  },
]

const releaseNavGroups: NavGroup[] = [
  {
    label: 'Deployment',
    items: [
      { to: '/release', label: 'Release Manager', icon: Rocket, end: true },
    ],
  },
]

type Section = 'tcg' | 'kora' | 'vl' | 'vault' | 'status' | 'snippets' | 'release' | 'ssh'

const sections: { id: Section; label: string; shortLabel: string; icon: React.ElementType; root: string; permission?: string }[] = [
  { id: 'status',   label: 'Status',     shortLabel: 'Status',   icon: Signal,         root: '/status' },
  { id: 'tcg',     label: 'TCG Admin',  shortLabel: 'TCG',      icon: ShoppingBag,    root: '/tcg',           permission: 'tcg' },
  { id: 'kora',    label: 'Kora',       shortLabel: 'Kora',     icon: HeartPulse,     root: '/kora',          permission: 'kora' },
  { id: 'vl',      label: 'Vision Lab', shortLabel: 'VL',       icon: Cpu,            root: '/vl',            permission: 'vl' },
  { id: 'vault',   label: 'Vault',      shortLabel: 'Vault',    icon: KeyRound,       root: '/vault' },
  { id: 'snippets',label: 'Snippets',   shortLabel: 'Snippets', icon: Braces,         root: '/snippets' },
  { id: 'release', label: 'Releases',   shortLabel: 'Release',  icon: Rocket,         root: '/release' },
  { id: 'ssh',     label: 'SSH',        shortLabel: 'SSH',      icon: TerminalSquare, root: '/ssh/terminal' },
]

const sectionMeta: Record<Section, { title: string; sub: string }> = {
  status:   { title: 'Status',     sub: 'Service health' },
  tcg:      { title: 'TCG',        sub: 'Collection Management' },
  kora:     { title: 'Kora',       sub: 'Care platform admin' },
  vl:       { title: 'Vision Lab', sub: 'ML training pipeline' },
  vault:    { title: 'Vault',      sub: 'Logins & passwords' },
  snippets: { title: 'Snippets',   sub: 'Commands & queries' },
  release:  { title: 'Releases',   sub: 'Build & deploy' },
  ssh:      { title: 'SSH',        sub: 'Remote terminals' },
}

function useActiveSection(): Section {
  const { pathname } = useLocation()
  if (pathname.startsWith('/status'))   return 'status'
  if (pathname.startsWith('/kora'))     return 'kora'
  if (pathname.startsWith('/vl'))       return 'vl'
  if (pathname.startsWith('/vault'))    return 'vault'
  if (pathname.startsWith('/snippets')) return 'snippets'
  if (pathname.startsWith('/release'))  return 'release'
  if (pathname.startsWith('/ssh'))      return 'ssh'
  return 'tcg'
}

export function Sidebar(): JSX.Element {
  const { user, logout } = useAuth()
  const { koraLogin } = useKoraAuth()
  const { counts } = useAlerts()
  const { can } = usePermissions()
  const navigate = useNavigate()
  const activeSection = useActiveSection()
  const { title, sub } = sectionMeta[activeSection]

  const visibleSections = sections.filter(s => !s.permission || can(s.permission))

  const [showPermSettings, setShowPermSettings] = useState(false)
  const [tcgEmail, setTcgEmail]         = useState('')
  const [tcgPassword, setTcgPassword]   = useState('')
  const [koraEmail, setKoraEmail]       = useState('')
  const [koraPassword, setKoraPassword] = useState('')
  const [permSaving, setPermSaving]     = useState(false)
  const [permError, setPermError]       = useState('')

  function openPermSettings() {
    const { email } = getTcgServiceAccount()
    const { email: ke } = getKoraServiceAccount()
    setTcgEmail(email)
    setTcgPassword('')
    setKoraEmail(ke)
    setKoraPassword('')
    setPermError('')
    setShowPermSettings(true)
  }

  async function savePermSettings() {
    const email = tcgEmail.trim()
    const { vaultId: existingVaultId } = getTcgServiceAccount()

    setPermSaving(true)
    setPermError('')
    try {
      let vaultId = existingVaultId

      // Save TCG credentials if email + password provided
      if (email && (tcgPassword || !existingVaultId)) {
        if (!tcgPassword) { setPermError('TCG password is required for first-time setup.'); return }
        const result = await (window as any).vault.save({
          id:       existingVaultId || undefined,
          name:     'TCG Service Account',
          username: email,
          password: tcgPassword,
          category: 'service',
        })
        if (!result?.ok) throw new Error(result?.error ?? 'Vault save failed')
        vaultId = result.id
      }

      if (email) {
        saveTcgServiceAccount(email, vaultId)
        await authenticateTcg()
      }

      // Save Kora service account if provided
      const koraEmailTrimmed = koraEmail.trim()
      if (koraEmailTrimmed && koraPassword) {
        const { vaultId: existingKoraVaultId } = getKoraServiceAccount()
        const koraResult = await (window as any).vault.save({
          id:       existingKoraVaultId || undefined,
          name:     'Kora Service Account',
          username: koraEmailTrimmed,
          password: koraPassword,
          category: 'service',
        })
        if (!koraResult?.ok) throw new Error(koraResult?.error ?? 'Vault save failed (Kora)')
        saveKoraServiceAccount(koraEmailTrimmed, koraResult.id)
        await koraLogin(koraEmailTrimmed, koraPassword)
      }

      setShowPermSettings(false)
    } catch (err) {
      setPermError((err as Error).message)
    } finally {
      setPermSaving(false)
    }
  }

  const navGroups =
    activeSection === 'status'   ? statusNavGroups   :
    activeSection === 'tcg'      ? tcgNavGroups      :
    activeSection === 'kora'     ? koraNavGroups     :
    activeSection === 'vault'    ? vaultNavGroups    :
    activeSection === 'snippets' ? snippetsNavGroups :
    activeSection === 'release'  ? releaseNavGroups  :
    activeSection === 'ssh'      ? sshNavGroups      :
    vlNavGroups

  const initials = (user?.username ?? user?.email ?? '?').slice(0, 2).toUpperCase()

  return (
    <aside className="flex h-full">

      {/* Activity bar */}
      <div
        className="flex w-[52px] shrink-0 flex-col items-center border-r border-border py-3"
        style={{ backgroundColor: 'hsl(var(--act-bar))' }}
      >
        <span className="mb-5 select-none text-[11px] font-bold tracking-tight text-white">
          SBF
        </span>

        <div className="flex w-full flex-1 flex-col gap-0.5">
          {visibleSections.map(({ id, label, shortLabel, icon: Icon, root }) => (
            <button
              key={id}
              onClick={() => navigate(root)}
              title={label}
              className={cn(
                'flex w-full flex-col items-center gap-1 border-l-2 py-2.5 text-[8px] font-semibold uppercase tracking-[0.1em] transition-colors',
                activeSection === id
                  ? 'border-white bg-white/10 text-white'
                  : 'border-transparent text-white/40 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span>{shortLabel}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center gap-2.5">
          <button
            onClick={openPermSettings}
            title="Permissions settings"
            className="flex h-[26px] w-[26px] items-center justify-center rounded text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Settings className="h-[15px] w-[15px]" />
          </button>
          {user && (
            <button
              onClick={logout}
              title="Sign out"
              className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-white/30 bg-white/10 text-[9px] font-semibold text-white transition-colors hover:bg-white/20"
            >
              {initials}
            </button>
          )}
        </div>
      </div>

      {/* Permissions / Supabase config modal */}
      {showPermSettings && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Settings</h2>
                <p className="text-[11px] text-muted-foreground">Service account credentials</p>
              </div>
              <button onClick={() => setShowPermSettings(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-4 p-5">
              {/* TCG */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">TCG Backend</p>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <input
                    value={tcgEmail}
                    onChange={e => setTcgEmail(e.target.value)}
                    placeholder="service@example.com"
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Password</label>
                  <input
                    type="password"
                    value={tcgPassword}
                    onChange={e => setTcgPassword(e.target.value)}
                    placeholder={getTcgServiceAccount().vaultId ? 'Leave blank to keep existing' : 'Enter password'}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              {/* Kora */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Kora</p>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <input
                    value={koraEmail}
                    onChange={e => setKoraEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Password</label>
                  <input
                    type="password"
                    value={koraPassword}
                    onChange={e => setKoraPassword(e.target.value)}
                    placeholder={getKoraServiceAccount().vaultId ? 'Leave blank to keep existing' : 'Enter password'}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              {permError && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {permError}
                </p>
              )}
            </div>
            <div className="flex gap-2 border-t border-border px-5 py-4">
              <button onClick={() => setShowPermSettings(false)} className="flex-1 rounded-md border border-border py-2 text-xs font-medium text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={savePermSettings} disabled={permSaving} className="flex-1 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                {permSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nav panel */}
      <nav className="flex w-[196px] shrink-0 flex-col overflow-hidden border-r border-border bg-card">
        <div className="px-4 pb-3.5 pt-5">
          <h2 className="text-[20px] font-semibold leading-tight tracking-tight text-foreground">
            {title}
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
        </div>

        <div className="h-px shrink-0 bg-border" />

        <div className="flex-1 overflow-y-auto py-2">
          {navGroups.map((group, gi) => {
            const visibleItems = group.items.filter(item => !item.permission || can(item.permission))
            if (visibleItems.length === 0) return null
            return (
            <div key={group.label} className={cn(gi > 0 && 'mt-3')}>
              <p className="px-4 pb-0.5 pt-2.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/40">
                {group.label}
              </p>
              {visibleItems.map(({ to, label, icon: Icon, end, badge }) => {
                const count = badge ? counts[badge] : 0
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 border-l-2 py-[7px] pr-4 text-[13px] transition-colors',
                        isActive
                          ? 'border-primary bg-primary/5 pl-[14px] font-medium text-foreground'
                          : 'border-transparent pl-4 text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={cn('h-[15px] w-[15px] shrink-0', isActive && 'text-primary')} />
                        <span className="flex-1">{label}</span>
                        {count > 0 && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
            )
          })}
        </div>
      </nav>
    </aside>
  )
}
