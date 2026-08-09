import { createHashRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/pages/DashboardPage'
import { UsersPage } from '@/pages/UsersPage'
import { OrdersPage } from '@/pages/OrdersPage'
import { TradesPage } from '@/pages/TradesPage'
import { MarketplacePage } from '@/pages/MarketplacePage'
import { FinancialsPage } from '@/pages/FinancialsPage'
import { ReportedUsersPage } from '@/pages/ReportedUsersPage'
import { AuditLogsPage } from '@/pages/AuditLogsPage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import { BindersPage } from '@/pages/BindersPage'
import { CollectionsPage } from '@/pages/CollectionsPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { SubscriptionsPage } from '@/pages/SubscriptionsPage'
import { WithdrawalsPage } from '@/pages/WithdrawalsPage'
import { ProofQueuePage } from '@/pages/ProofQueuePage'
import { ReviewsPage } from '@/pages/ReviewsPage'
import { SetsPage } from '@/pages/SetsPage'
import { ServicesPage } from '@/pages/ServicesPage'
import { DockerPage } from '@/pages/DockerPage'
import { MailboxesPage } from '@/pages/MailboxesPage'
import { KoraSection } from '@/pages/kora/KoraSection'
import { KoraDashboardPage } from '@/pages/kora/KoraDashboardPage'
import { KoraOrgsPage } from '@/pages/kora/KoraOrgsPage'
import { KoraHomesPage } from '@/pages/kora/KoraHomesPage'
import { KoraHealthPage } from '@/pages/kora/KoraHealthPage'
import { KoraDockerPage } from '@/pages/kora/KoraDockerPage'
import { KoraMailboxesPage } from '@/pages/kora/KoraMailboxesPage'

export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/tcg" replace /> },

      // ── TCG Admin ──────────────────────────────────────────────────────────
      {
        path: 'tcg',
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'users',          element: <UsersPage /> },
          { path: 'orders',         element: <OrdersPage /> },
          { path: 'trades',         element: <TradesPage /> },
          { path: 'marketplace',    element: <MarketplacePage /> },
          { path: 'financials',     element: <FinancialsPage /> },
          { path: 'reported-users', element: <ReportedUsersPage /> },
          { path: 'audit-logs',     element: <AuditLogsPage /> },
          { path: 'notifications',  element: <NotificationsPage /> },
          { path: 'binders',        element: <BindersPage /> },
          { path: 'collections',    element: <CollectionsPage /> },
          { path: 'products',       element: <ProductsPage /> },
          { path: 'subscriptions',  element: <SubscriptionsPage /> },
          { path: 'withdrawals',    element: <WithdrawalsPage /> },
          { path: 'proof-queue',    element: <ProofQueuePage /> },
          { path: 'reviews',        element: <ReviewsPage /> },
          { path: 'sets',           element: <SetsPage /> },
          { path: 'services',       element: <ServicesPage /> },
          { path: 'docker',         element: <DockerPage /> },
          { path: 'mailboxes',      element: <MailboxesPage /> },
        ],
      },

      // ── Kora Admin — Phase 1 ───────────────────────────────────────────────
      {
        path: 'kora',
        element: <KoraSection />,
        children: [
          { index: true, element: <KoraDashboardPage /> },
          { path: 'orgs',   element: <KoraOrgsPage /> },
          { path: 'homes',  element: <KoraHomesPage /> },
          { path: 'health',     element: <KoraHealthPage /> },
          { path: 'docker',     element: <KoraDockerPage /> },
          { path: 'mailboxes',  element: <KoraMailboxesPage /> },
        ],
      },

      // ── Vision Lab — Phase 2 ───────────────────────────────────────────────
      {
        path: 'vl',
        element: (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Vision Lab — coming soon</p>
          </div>
        ),
      },
    ],
  },
])
