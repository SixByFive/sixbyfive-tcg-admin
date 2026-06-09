import { createHashRouter } from 'react-router-dom'
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

export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'trades', element: <TradesPage /> },
      { path: 'marketplace', element: <MarketplacePage /> },
      { path: 'financials', element: <FinancialsPage /> },
      { path: 'reported-users', element: <ReportedUsersPage /> },
      { path: 'audit-logs', element: <AuditLogsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'binders', element: <BindersPage /> },
      { path: 'collections', element: <CollectionsPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'subscriptions', element: <SubscriptionsPage /> },
      { path: 'withdrawals', element: <WithdrawalsPage /> },
      { path: 'proof-queue', element: <ProofQueuePage /> },
      { path: 'reviews', element: <ReviewsPage /> },
      { path: 'sets', element: <SetsPage /> },
      { path: 'services', element: <ServicesPage /> },
      { path: 'docker', element: <DockerPage /> },
    ],
  },
])
