export interface AdminUser {
  id: string
  username: string
  email: string
  isAdmin: boolean
  isBanned: boolean
  emailVerified: boolean
}

export interface AdminOrder {
  id: string
  buyerId: string
  sellerId: string
  fulfilmentStatus: string
  paymentStatus: string
  totalAmount: number   // Float in £ (e.g. 4.99)
  createdAt: string
  buyer?: { username: string }
  seller?: { username: string }
}

export interface AdminTrade {
  id: string
  partyAId: string
  partyBId: string
  status: string
  createdAt: string
}

export interface AdminListing {
  id: string
  sellerId: string
  title: string
  price: number
  status: string
  createdAt: string
}

export interface AuthUser {
  id: string
  username: string
  email: string
  role?: string       // not present in auth-service responses — use isAdmin instead
  isAdmin?: boolean   // auth-service field; true when the user has admin access
}

export interface AdminReportedUser {
  id: string
  userId: string
  reporterId: string
  reason: string
  details?: string
  isCleared: boolean
  createdAt: string
  user?: { id: string; username: string }
  reporter?: { id: string; username: string }
}

export interface AdminAuditLog {
  id: string
  userId?: string
  action: string
  targetId?: string
  targetType?: string
  details?: unknown
  ip?: string
  userAgent?: string
  createdAt: string
}

export interface AdminBinder {
  id: string
  userId?: string
  name: string
  visibility: string
  isDeleted: boolean
  createdAt: string
}

export interface UserCollectionSummary {
  userId: string
  username?: string
  email?: string
  totalCards: number
  distinctCards: number
}

export interface AdminProduct {
  id: string
  title: string
  description?: string
  imageUrl?: string
  price: number
  currency: string
  quantity: number
  status: string
  fulfilmentType?: string
  fulfilmentProvider?: string
  fulfilmentExternalId?: string
  createdAt: string
}

export interface AdminProductInput {
  title: string
  description?: string | null
  imageUrl?: string | null
  price: number
  currency?: string
  quantity?: number
  status?: string
  fulfilmentType?: string | null
  fulfilmentProvider?: string | null
  fulfilmentExternalId?: string | null
}

export interface CatalogSet {
  code: string
  name: string
  era?: string
  release_date?: string
  abbreviation?: string
  official_count?: number
  total_cards?: number
  enabled?: boolean
}

export interface SchedulerTask {
  id: string
  name: string
  cronExp?: string
  description?: string
  enabled?: boolean
  timezone?: string
  lastRun?: string
  nextRun?: string
  payload?: unknown
}

export interface ServiceHealthEntry {
  status: string
  service: string
  error?: string
}

export interface IngestResult {
  code?: string
  ok: boolean
  cards?: number | null
  error?: string
  done?: boolean
  succeeded?: number
  failed?: number
  total?: number
}

export interface SubscriptionPlan {
  id: string
  name: string
  description?: string
  price?: number
  interval?: string
  platformFeePercent?: number
  maxBinders?: number
  maxActiveListings?: number
  maxActiveTrades?: number
  features?: unknown
  isActive?: boolean
  active?: boolean
  sortOrder?: number
  stripePriceIdMonthly?: string
  stripePriceIdYearly?: string
  createdAt?: string
}

export interface AdminSubscription {
  id: string
  userId?: string
  planId?: string
  plan?: SubscriptionPlan
  status: string
  currentPeriodStart?: string
  currentPeriodEnd?: string
  cancelAtPeriodEnd?: boolean
  cancelledAt?: string
  createdAt?: string
}

export interface AdminSubscriptionPage {
  subscriptions: AdminSubscription[]
  total: number
  page: number
  pageSize: number
}

export interface AdminWithdrawal {
  id: string
  userId: string
  amountPence: number
  amount: number
  status: string
  description?: string
  sortCode?: string
  accountNumber?: string
  accountName?: string
  createdAt: string
}

export interface AdminWithdrawalList {
  total: number
  withdrawals: AdminWithdrawal[]
}

export interface ProofQueueItem {
  id: string
  sellerId?: string
  cardId?: string
  title?: string
  price?: number
  status?: string
  proofCode?: string
  proofImagePath?: string
  moderationResult?: string
  createdAt?: string
}

export interface ReviewQueueItem {
  id: string
  sellerId: string
  cardId?: string
  rating: number
  review?: string
  reviewStatus: string
  disputeReason?: string
  updatedAt?: string
}

export interface OrderDispute {
  id: string
  orderId?: string
  raisedBy?: string
  reason?: string
  status: string
  resolution?: string
  resolvedInFavourOf?: string
  escrowActionTaken?: string
  resolvedAt?: string
  createdAt?: string
  order?: {
    id: string
    buyerId?: string
    sellerId?: string
    totalAmount?: number
    createdAt?: string
    buyer?: { username: string }
    seller?: { username: string }
  }
}

export interface AdminRevenueSummary {
  totalRevenue: number
  revenue30d: number
  revenue7d: number
  subRevenue: number
  productRevenue: number
  refunds: number
  currency: string
}

export interface AdminMarketplaceRevenueMonth {
  month: string
  gmv: number
  fees: number
  orders: number
}

export interface AdminMarketplaceRevenue {
  gmv: number
  platformFees: number
  shippingCollected: number
  walletUsed: number
  refundedTotal: number
  stripeFeeEstimate: number
  gmv30d: number
  gmv7d: number
  platformFees30d: number
  totalOrders: number
  completedOrders: number
  openDisputes: number
  resolvedDisputes: number
  monthly: AdminMarketplaceRevenueMonth[]
  currency: string
}

export interface AdminTransaction {
  id: string
  userId?: string
  type?: string
  amount?: number
  currency?: string
  status?: string
  description?: string
  createdAt?: string
}

export interface DockerService {
  id: string
  name: string
  image: string
  state: string   // running | exited | paused | restarting | created | dead | unknown
  status: string
  health: 'healthy' | 'unhealthy' | 'starting' | null
}

export interface DockerRestartAllResult {
  ok: boolean
  restarted: number
  failed: number
  results: Array<{ name: string; ok: boolean; error: string | null }>
}
