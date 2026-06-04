import { createHashRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/pages/DashboardPage'
import { UsersPage } from '@/pages/UsersPage'
import { OrdersPage } from '@/pages/OrdersPage'
import { TradesPage } from '@/pages/TradesPage'
import { MarketplacePage } from '@/pages/MarketplacePage'
import { FinancialsPage } from '@/pages/FinancialsPage'

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
    ],
  },
])
