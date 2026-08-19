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
import { MarketingPage } from '@/pages/MarketingPage'
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
import VlDatasetPage from '@/pages/vl/DatasetPage'
import VlProcessPage from '@/pages/vl/ProcessPage'
import VlDatasetBrowserPage from '@/pages/vl/DatasetBrowserPage'
import VlTrainPage from '@/pages/vl/TrainPage'
import VlResultsPage from '@/pages/vl/ResultsPage'
import VlTestPage from '@/pages/vl/TestPage'
import VlSettingsPage from '@/pages/vl/SettingsPage'
import { VaultPage } from '@/pages/VaultPage'
import { StatusBoardPage } from '@/pages/StatusBoardPage'
import { SnippetsPage } from '@/pages/SnippetsPage'
import { ReleaseManagerPage } from '@/pages/ReleaseManagerPage'
import { SshTerminalPage } from '@/pages/ssh/SshTerminalPage'
import { SshConnectionsPage } from '@/pages/ssh/SshConnectionsPage'

export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/status" replace /> },

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
          { path: 'marketing',      element: <MarketingPage /> },
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

      // ── Vault ─────────────────────────────────────────────────────────────────
      { path: 'vault', element: <VaultPage /> },

      // ── Status ────────────────────────────────────────────────────────────────
      { path: 'status', element: <StatusBoardPage /> },

      // ── Snippets ──────────────────────────────────────────────────────────────
      { path: 'snippets', element: <SnippetsPage /> },

      // ── Release Manager ───────────────────────────────────────────────────────
      { path: 'release', element: <ReleaseManagerPage /> },

      // ── SSH Terminal ──────────────────────────────────────────────────────────
      {
        path: 'ssh',
        children: [
          { index: true,         element: <SshTerminalPage /> },
          { path: 'terminal',    element: <SshTerminalPage /> },
          { path: 'connections', element: <SshConnectionsPage /> },
        ],
      },

      // ── Vision Lab ────────────────────────────────────────────────────────────
      {
        path: 'vl',
        children: [
          { index: true,          element: <VlDatasetPage /> },
          { path: 'dataset',      element: <VlDatasetPage /> },
          { path: 'process',      element: <VlProcessPage /> },
          { path: 'browser',      element: <VlDatasetBrowserPage /> },
          { path: 'train',        element: <VlTrainPage /> },
          { path: 'results',      element: <VlResultsPage /> },
          { path: 'test',         element: <VlTestPage /> },
          { path: 'settings',     element: <VlSettingsPage /> },
        ],
      },
    ],
  },
])
