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
  LogOut,
  Cpu,
  HeartPulse,
  Building2,
  Home,
  Activity,
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
      { to: '/kora/health',     label: 'API Health', icon: Activity },
      { to: '/kora/docker',     label: 'Docker',     icon: Container },
      { to: '/kora/mailboxes',  label: 'Webmail',    icon: Mail },
    ],
  },
]

type Section = 'tcg' | 'kora' | 'vl'

const sections: { id: Section; label: string; icon: React.ElementType; root: string }[] = [
  { id: 'tcg',  label: 'TCG Admin',   icon: ShoppingBag, root: '/tcg' },
  { id: 'kora', label: 'Kora Admin',  icon: HeartPulse,  root: '/kora' },
  { id: 'vl',   label: 'Vision Lab',  icon: Cpu,         root: '/vl' },
]

function useActiveSection(): Section {
  const { pathname } = useLocation()
  if (pathname.startsWith('/kora')) return 'kora'
  if (pathname.startsWith('/vl')) return 'vl'
  return 'tcg'
}

export function Sidebar(): JSX.Element {
  const { user, logout } = useAuth()
  const { counts } = useAlerts()
  const navigate = useNavigate()
  const activeSection = useActiveSection()

  const navGroups =
    activeSection === 'tcg'  ? tcgNavGroups  :
    activeSection === 'kora' ? koraNavGroups :
    []

  return (
    <aside className="flex h-full w-52 flex-col border-r border-border bg-card">

      {/* Section switcher */}
      <div className="flex gap-1 border-b border-border p-2">
        {sections.map(({ id, label, icon: Icon, root }) => (
          <button
            key={id}
            onClick={() => navigate(root)}
            title={label}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 rounded-md py-2 text-[10px] font-medium transition-colors',
              activeSection === id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="leading-none">{id === 'tcg' ? 'TCG' : id === 'kora' ? 'Kora' : 'Vision'}</span>
          </button>
        ))}
      </div>

      {/* Section nav */}
      <nav className="flex flex-1 flex-col overflow-y-auto p-2">
        {navGroups.length > 0 ? (
          navGroups.map((group, gi) => (
            <div key={group.label} className={cn('flex flex-col gap-0.5', gi > 0 && 'mt-4')}>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
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
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      )
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{label}</span>
                    {count > 0 && (
                      <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          ))
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </div>
        )}
      </nav>

      {/* User footer */}
      {user && (
        <div className="border-t border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-tight">{user.username ?? user.email}</p>
              <p className="text-xs text-muted-foreground">{user.role}</p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
