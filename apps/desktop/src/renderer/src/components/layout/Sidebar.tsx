import { NavLink } from 'react-router-dom'
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

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'Users',
    items: [
      { to: '/users',          label: 'Users',      icon: Users },
      { to: '/reported-users', label: 'Reports',    icon: Flag,  badge: 'reports' },
      { to: '/reviews',        label: 'Reviews',    icon: Star,  badge: 'reviews' },
      { to: '/audit-logs',     label: 'Audit Logs', icon: ScrollText },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { to: '/orders',        label: 'Orders',        icon: ShoppingBag },
      { to: '/trades',        label: 'Trades',        icon: ArrowLeftRight },
      { to: '/marketplace',   label: 'Marketplace',   icon: Store },
      { to: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
      { to: '/financials',    label: 'Financials',    icon: BarChart3 },
      { to: '/withdrawals',   label: 'Withdrawals',   icon: Wallet,      badge: 'withdrawals' },
      { to: '/proof-queue',   label: 'Proof Queue',   icon: FileCheck,   badge: 'proofQueue' },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/products',    label: 'Products',       icon: Package },
      { to: '/sets',        label: 'Set Ingestion',  icon: Database },
      { to: '/binders',     label: 'Binders',        icon: BookOpen },
      { to: '/collections', label: 'Collections',    icon: Library },
    ],
  },
  {
    label: 'Communications',
    items: [
      { to: '/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { to: '/services',   label: 'Services', icon: Server },
      { to: '/docker',     label: 'Docker',   icon: Container },
      { to: '/mailboxes',  label: 'Webmail',  icon: Mail },
    ],
  },
]

export function Sidebar(): JSX.Element {
  const { user, logout } = useAuth()
  const { counts } = useAlerts()

  return (
    <aside className="flex h-full w-52 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <span className="text-sm font-bold tracking-wide text-foreground">TCG Admin</span>
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto p-2">
        {navGroups.map((group, gi) => (
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
        ))}
      </nav>

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
