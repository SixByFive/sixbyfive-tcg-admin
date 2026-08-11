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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useAlerts, type AlertCounts } from '@/context/AlertsContext'

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  end?: boolean
  badge?: keyof AlertCounts
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
      { to: '/tcg/financials',    label: 'Financials',    icon: BarChart3 },
      { to: '/tcg/withdrawals',   label: 'Withdrawals',   icon: Wallet,     badge: 'withdrawals' },
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
      { to: '/tcg/docker',    label: 'Docker',   icon: Container },
      { to: '/tcg/mailboxes', label: 'Webmail',  icon: Mail },
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

const vaultNavGroups: NavGroup[] = [
  {
    label: 'Credentials',
    items: [
      { to: '/vault', label: 'All entries', icon: KeyRound, end: true },
    ],
  },
]

type Section = 'tcg' | 'kora' | 'vl' | 'vault'

const sections: { id: Section; label: string; shortLabel: string; icon: React.ElementType; root: string }[] = [
  { id: 'tcg',   label: 'TCG Admin',  shortLabel: 'TCG',   icon: ShoppingBag, root: '/tcg' },
  { id: 'kora',  label: 'Kora Admin', shortLabel: 'Kora',  icon: HeartPulse,  root: '/kora' },
  { id: 'vl',    label: 'Vision Lab', shortLabel: 'VL',    icon: Cpu,         root: '/vl' },
  { id: 'vault', label: 'Vault',      shortLabel: 'Vault', icon: KeyRound,    root: '/vault' },
]

const sectionMeta: Record<Section, { title: string; sub: string }> = {
  tcg:   { title: 'TCG',        sub: 'Collection Management' },
  kora:  { title: 'Kora',       sub: 'Care platform admin' },
  vl:    { title: 'Vision Lab', sub: 'ML training pipeline' },
  vault: { title: 'Vault',      sub: 'Logins & passwords' },
}

function useActiveSection(): Section {
  const { pathname } = useLocation()
  if (pathname.startsWith('/kora'))  return 'kora'
  if (pathname.startsWith('/vl'))    return 'vl'
  if (pathname.startsWith('/vault')) return 'vault'
  return 'tcg'
}

export function Sidebar(): JSX.Element {
  const { user, logout } = useAuth()
  const { counts } = useAlerts()
  const navigate = useNavigate()
  const activeSection = useActiveSection()
  const { title, sub } = sectionMeta[activeSection]

  const navGroups =
    activeSection === 'tcg'   ? tcgNavGroups   :
    activeSection === 'kora'  ? koraNavGroups  :
    activeSection === 'vault' ? vaultNavGroups :
    vlNavGroups

  const initials = (user?.username ?? user?.email ?? '?').slice(0, 2).toUpperCase()

  return (
    <aside className="flex h-full">

      {/* Activity bar */}
      <div
        className="flex w-[52px] shrink-0 flex-col items-center border-r border-border py-3"
        style={{ backgroundColor: 'hsl(var(--act-bar))' }}
      >
        <span className="mb-5 select-none text-[11px] font-bold tracking-tight text-primary">
          SBF
        </span>

        <div className="flex w-full flex-1 flex-col gap-0.5">
          {sections.map(({ id, label, shortLabel, icon: Icon, root }) => (
            <button
              key={id}
              onClick={() => navigate(root)}
              title={label}
              className={cn(
                'flex w-full flex-col items-center gap-1 border-l-2 py-2.5 text-[8px] font-semibold uppercase tracking-[0.1em] transition-colors',
                activeSection === id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-transparent text-muted-foreground/40 hover:bg-accent/50 hover:text-muted-foreground'
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span>{shortLabel}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center gap-2.5">
          {user && (
            <button
              onClick={logout}
              title="Sign out"
              className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-[9px] font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              {initials}
            </button>
          )}
        </div>
      </div>

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
          {navGroups.map((group, gi) => (
            <div key={group.label} className={cn(gi > 0 && 'mt-3')}>
              <p className="px-4 pb-0.5 pt-2.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/40">
                {group.label}
              </p>
              {group.items.map(({ to, label, icon: Icon, end, badge }) => {
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
          ))}
        </div>
      </nav>
    </aside>
  )
}
