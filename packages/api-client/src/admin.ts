import type { ApiClient } from './client'
import type {
  AdminUser, AdminOrder, AdminTrade, AdminListing,
  AdminReportedUser, AdminAuditLog, AdminBinder,
  UserCollectionSummary, AdminProduct, AdminProductInput,
  CatalogSet, SchedulerTask, ServiceHealthEntry, IngestResult,
  AdminSubscription, AdminSubscriptionPage, SubscriptionPlan,
  AdminWithdrawal, AdminWithdrawalList,
  ProofQueueItem, ReviewQueueItem,
  OrderDispute, AdminRevenueSummary, AdminMarketplaceRevenue,
  DockerService, DockerRestartAllResult,
  MailboxSummary,
} from '@tcg-admin/types'

const PAGE_SIZE = 20

/**
 * Returns a "virtual" total that drives the UI paginator without a real server-side count.
 * - Full page (count === limit) → assume at least one more page exists.
 * - Partial page               → this is the last page.
 */
function virtualTotal(page: number, count: number, limit: number): number {
  return count === limit
    ? page * limit + 1
    : (page - 1) * limit + count
}

export function createAdminApi(client: ApiClient) {
  return {
    // ── Users ──────────────────────────────────────────────────────────────
    // Schema: allUsers(limit: Int, offset: Int): [AdminUser!]!
    // AdminUser fields: id username email isAdmin isBanned emailVerified
    // Note: no server-side search — search/filter is not supported by allUsers.

    async getUsers(opts: { page?: number; search?: string } = {}): Promise<{ users: AdminUser[]; total: number }> {
      const { page = 1 } = opts
      const limit = PAGE_SIZE
      const offset = (page - 1) * limit
      const data = await client.gql<{ allUsers: AdminUser[] }>(
        `query AdminAllUsers($limit: Int, $offset: Int) {
          allUsers(limit: $limit, offset: $offset) {
            id username email isAdmin isBanned emailVerified
          }
        }`,
        { limit, offset }
      )
      const users = data.allUsers ?? []
      return { users, total: virtualTotal(page, users.length, limit) }
    },

    async suspendUser(id: string, _reason?: string): Promise<void> {
      // Schema: adminBanUser(id: ID!): Boolean! — no reason parameter
      await client.gql(
        `mutation AdminBanUser($id: ID!) {
          adminBanUser(id: $id)
        }`,
        { id }
      )
    },

    async unsuspendUser(id: string): Promise<void> {
      await client.gql(
        `mutation AdminUnbanUser($id: ID!) {
          adminUnbanUser(id: $id)
        }`,
        { id }
      )
    },

    async adjustWallet(_id: string, _amountPence: number, _note: string): Promise<void> {
      throw new Error('Wallet adjustments are not yet available via the admin API')
    },

    // ── Orders ─────────────────────────────────────────────────────────────
    // Schema: adminOrders(paymentStatus, fulfilmentStatus, limit, offset): [Order!]!
    // The status filter maps to fulfilmentStatus.

    async getOrders(opts: { page?: number; status?: string } = {}): Promise<{ orders: AdminOrder[]; total: number }> {
      const { page = 1, status } = opts
      const limit = PAGE_SIZE
      const offset = (page - 1) * limit
      const data = await client.gql<{ adminOrders: AdminOrder[] }>(
        `query AdminOrders($fulfilmentStatus: String, $limit: Int, $offset: Int) {
          adminOrders(fulfilmentStatus: $fulfilmentStatus, limit: $limit, offset: $offset) {
            id buyerId sellerId paymentStatus fulfilmentStatus totalAmount createdAt
            buyer { username }
            seller { username }
          }
        }`,
        { fulfilmentStatus: status || null, limit, offset }
      )
      const orders = data.adminOrders ?? []
      return { orders, total: virtualTotal(page, orders.length, limit) }
    },

    // ── Trades ─────────────────────────────────────────────────────────────
    // Schema: adminTrades(page, pageSize, status: TradeStatus, userId): [Trade!]!
    // Trade type has no partyA/partyB sub-objects — pages fall back to partyAId/partyBId.

    async getTrades(opts: { page?: number; status?: string } = {}): Promise<{ trades: AdminTrade[]; total: number }> {
      const { page = 1, status } = opts
      const data = await client.gql<{ adminTrades: AdminTrade[] }>(
        `query AdminTrades($page: Int, $pageSize: Int, $status: TradeStatus) {
          adminTrades(page: $page, pageSize: $pageSize, status: $status) {
            id partyAId partyBId status createdAt
          }
        }`,
        { page, pageSize: PAGE_SIZE, status: (status as any) || null }
      )
      const trades = data.adminTrades ?? []
      return { trades, total: virtualTotal(page, trades.length, PAGE_SIZE) }
    },

    async resolveTradeDispute(id: string, resolution: string, resolvedInFavourOf: string): Promise<void> {
      await client.gql(
        `mutation AdminResolveTradeDispute($id: ID!, $resolution: String!, $resolvedInFavourOf: String!) {
          adminResolveTradeDispute(id: $id, resolution: $resolution, resolvedInFavourOf: $resolvedInFavourOf)
        }`,
        { id, resolution, resolvedInFavourOf }
      )
    },

    // ── Marketplace ────────────────────────────────────────────────────────
    // Schema: adminListings(status, sellerId, limit, offset): [CardListing!]!
    // CardListing fields: id sellerId title price status createdAt
    // No search param, no isSuspended field, no seller sub-object.

    async getListings(opts: { page?: number; search?: string; suspended?: boolean } = {}): Promise<{ listings: AdminListing[]; total: number }> {
      const { page = 1 } = opts
      const limit = PAGE_SIZE
      const offset = (page - 1) * limit
      const data = await client.gql<{ adminListings: AdminListing[] }>(
        `query AdminListings($limit: Int, $offset: Int) {
          adminListings(limit: $limit, offset: $offset) {
            id sellerId title price status createdAt
          }
        }`,
        { limit, offset }
      )
      const listings = data.adminListings ?? []
      return { listings, total: virtualTotal(page, listings.length, limit) }
    },

    async suspendListing(_id: string, _reason: string): Promise<void> {
      throw new Error('Listing suspension is not yet available via the admin API')
    },

    // ── Financials ─────────────────────────────────────────────────────────
    // A combined adminStats query doesn't exist in the gateway schema yet —
    // totalUsers is real (adminUserCount); the rest stay zero-state stubs
    // until their own backend support lands.

    async getStats() {
      const totalUsers = await client.gql<{ adminUserCount: number }>(
        `query AdminUserCount { adminUserCount }`
      ).then(d => d.adminUserCount).catch(() => 0)

      return {
        totalRevenuePence: 0,
        revenueThisMonthPence: 0,
        totalUsers,
        activeSubscriptions: 0,
        openOrders: 0,
        openTrades: 0,
        openDisputes: 0,
      }
    },

    // ── Reported Users ─────────────────────────────────────────────────────
    // Schema: adminQueryReportedUsers(page, pageSize, isCleared): [ReportedUser!]!

    async getReportedUsers(opts: { page?: number; isCleared?: boolean } = {}): Promise<{ reports: AdminReportedUser[]; total: number }> {
      const { page = 1, isCleared } = opts
      const data = await client.gql<{ adminQueryReportedUsers: AdminReportedUser[] }>(
        `query AdminReportedUsers($page: Int, $pageSize: Int, $isCleared: Boolean) {
          adminQueryReportedUsers(page: $page, pageSize: $pageSize, isCleared: $isCleared) {
            id userId reporterId reason details isCleared createdAt
            user { id username }
            reporter { id username }
          }
        }`,
        { page, pageSize: PAGE_SIZE, isCleared: isCleared ?? null }
      )
      const reports = data.adminQueryReportedUsers ?? []
      return { reports, total: virtualTotal(page, reports.length, PAGE_SIZE) }
    },

    async clearUserReport(userId: string): Promise<void> {
      await client.gql(
        `mutation AdminClearUserReport($userId: ID!) { adminClearUserReport(userId: $userId) }`,
        { userId }
      )
    },

    async banUserFromChat(userId: string, reason?: string): Promise<void> {
      await client.gql(
        `mutation AdminBanUserFromChat($userId: ID!, $reason: String) { adminBanUserFromChat(userId: $userId, reason: $reason) }`,
        { userId, reason: reason || null }
      )
    },

    async unbanUserFromChat(userId: string): Promise<void> {
      await client.gql(
        `mutation AdminUnbanUserFromChat($userId: ID!) { adminUnbanUserFromChat(userId: $userId) }`,
        { userId }
      )
    },

    // ── Audit Logs ─────────────────────────────────────────────────────────
    // Schema: auditLogs(userId, action, targetId, targetType, page, pageSize): [AuditLog!]!

    async getAuditLogs(opts: { page?: number; userId?: string; action?: string; targetType?: string } = {}): Promise<{ logs: AdminAuditLog[]; total: number }> {
      const { page = 1, userId, action, targetType } = opts
      const data = await client.gql<{ auditLogs: AdminAuditLog[] }>(
        `query AdminAuditLogs($page: Int, $pageSize: Int, $userId: ID, $action: String, $targetType: String) {
          auditLogs(page: $page, pageSize: $pageSize, userId: $userId, action: $action, targetType: $targetType) {
            id userId action targetId targetType details ip createdAt
          }
        }`,
        { page, pageSize: PAGE_SIZE, userId: userId || null, action: action || null, targetType: targetType || null }
      )
      const logs = data.auditLogs ?? []
      return { logs, total: virtualTotal(page, logs.length, PAGE_SIZE) }
    },

    // ── Notifications ──────────────────────────────────────────────────────
    // Schema: adminSendBroadcastNotification(input: BroadcastNotificationInput!): Boolean!

    async sendBroadcastNotification(input: { title: string; body: string; type?: string; iconUrl?: string; linkUrl?: string }): Promise<void> {
      await client.gql(
        `mutation AdminBroadcast($input: BroadcastNotificationInput!) { adminSendBroadcastNotification(input: $input) }`,
        { input }
      )
    },

    // ── Binders ────────────────────────────────────────────────────────────
    // Schema: adminBinders(limit, offset): [AdminBinder!]!
    // Schema: adminDeleteBinder(id, permanent): Boolean!

    async getBinders(opts: { page?: number } = {}): Promise<{ binders: AdminBinder[]; total: number }> {
      const { page = 1 } = opts
      const limit = PAGE_SIZE
      const offset = (page - 1) * limit
      const data = await client.gql<{ adminBinders: AdminBinder[] }>(
        `query AdminBinders($limit: Int, $offset: Int) {
          adminBinders(limit: $limit, offset: $offset) {
            id userId username name visibility isDeleted createdAt
          }
        }`,
        { limit, offset }
      )
      const binders = data.adminBinders ?? []
      return { binders, total: virtualTotal(page, binders.length, limit) }
    },

    async deleteBinder(id: string): Promise<void> {
      await client.gql(
        `mutation AdminDeleteBinder($id: ID!) { adminDeleteBinder(id: $id) }`,
        { id }
      )
    },

    // ── Collections ────────────────────────────────────────────────────────
    // Schema: adminUserCollections(limit, search): [UserCollectionSummary!]!

    async getUserCollections(opts: { limit?: number; search?: string } = {}): Promise<UserCollectionSummary[]> {
      const { limit = 200, search } = opts
      const data = await client.gql<{ adminUserCollections: UserCollectionSummary[] }>(
        `query AdminUserCollections($limit: Int, $search: String) {
          adminUserCollections(limit: $limit, search: $search) {
            userId username email totalCards distinctCards
          }
        }`,
        { limit, search: search || null }
      )
      return data.adminUserCollections ?? []
    },

    // ── Products ───────────────────────────────────────────────────────────
    // Schema: listings(type: PRODUCT, limit, offset): [Listing!]! (union — filter ProductListing)
    // Schema: adminCreateProductListing(input): ProductListing!
    // Schema: adminUpdateProductListing(id, input): ProductListing!
    // Schema: deleteListing(id): Boolean!

    async getProductListings(opts: { page?: number } = {}): Promise<{ products: AdminProduct[]; total: number }> {
      const { page = 1 } = opts
      const limit = PAGE_SIZE
      const offset = (page - 1) * limit
      const data = await client.gql<{ listings: Array<{ __typename: string } & AdminProduct> }>(
        `query AdminProductListings($limit: Int, $offset: Int) {
          listings(type: PRODUCT, limit: $limit, offset: $offset) {
            __typename
            ... on ProductListing {
              id title description imageUrl price currency quantity status
              fulfilmentType fulfilmentProvider fulfilmentExternalId createdAt
            }
          }
        }`,
        { limit, offset }
      )
      const products = (data.listings ?? [])
        .filter(l => l.__typename === 'ProductListing')
        .map(({ __typename: _t, ...p }) => p as AdminProduct)
      return { products, total: virtualTotal(page, products.length, limit) }
    },

    async createProductListing(input: AdminProductInput): Promise<AdminProduct> {
      const data = await client.gql<{ adminCreateProductListing: AdminProduct }>(
        `mutation AdminCreateProduct($input: ProductListingInput!) {
          adminCreateProductListing(input: $input) {
            id title price currency quantity status fulfilmentType createdAt
          }
        }`,
        { input }
      )
      return data.adminCreateProductListing
    },

    async updateProductListing(id: string, input: AdminProductInput): Promise<AdminProduct> {
      const data = await client.gql<{ adminUpdateProductListing: AdminProduct }>(
        `mutation AdminUpdateProduct($id: ID!, $input: ProductListingInput!) {
          adminUpdateProductListing(id: $id, input: $input) {
            id title price currency quantity status fulfilmentType createdAt
          }
        }`,
        { id, input }
      )
      return data.adminUpdateProductListing
    },

    async deleteProductListing(id: string): Promise<void> {
      await client.gql(
        `mutation DeleteListing($id: ID!) { deleteListing(id: $id) }`,
        { id }
      )
    },

    // ── Catalog sets ───────────────────────────────────────────────────────
    // All routes go through the gateway /catalog-admin proxy → catalog-service /admin/*
    // Requires x-admin-key (set via apiClient.setAdminApiKey before calling these).

    async getCatalogSets(opts: { q?: string; page?: number; pageSize?: number } = {}): Promise<{ sets: CatalogSet[]; total: number }> {
      const { q, page = 1, pageSize = 50 } = opts
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (q) params.set('q', q)
      return client.rest<{ sets: CatalogSet[]; total: number }>(`/catalog-admin/sets?${params}`, { skipAuthRefresh: true, adminKeyOnly: true })
    },

    async ingestSet(input: string, opts: { refresh?: boolean; dryRun?: boolean } = {}): Promise<IngestResult> {
      return client.rest<IngestResult>('/catalog-admin/jobs/ingest', {
        method: 'POST',
        body: JSON.stringify({ input, refresh: opts.refresh ?? false, dryRun: opts.dryRun ?? false }),
        skipAuthRefresh: true, adminKeyOnly: true,
      })
    },

    /** Ingest all sets. Returns array of per-set results (gateway buffers the NDJSON). */
    async ingestAll(opts: { refresh?: boolean; dryRun?: boolean; only?: string[] } = {}): Promise<IngestResult[]> {
      const res = await client.rest<string>('/catalog-admin/jobs/ingest-all', {
        method: 'POST',
        body: JSON.stringify({ refresh: opts.refresh ?? false, dryRun: opts.dryRun ?? false, only: opts.only }),
        skipAuthRefresh: true, adminKeyOnly: true,
      })
      // Gateway proxy calls upstream.text() so the response is a raw string of NDJSON lines.
      const text = typeof res === 'string' ? res : JSON.stringify(res)
      return text.split('\n').filter(Boolean).map(line => {
        try { return JSON.parse(line) as IngestResult } catch { return { ok: false, error: line } }
      })
    },

    async toggleCatalogSet(code: string): Promise<{ code: string; enabled: boolean }> {
      return client.rest<{ code: string; enabled: boolean }>(`/catalog-admin/sets/${encodeURIComponent(code)}/toggle`, {
        method: 'POST',
        skipAuthRefresh: true, adminKeyOnly: true,
      })
    },

    async ensureSetTasks(code: string): Promise<void> {
      await client.rest(`/catalog-admin/sets/${encodeURIComponent(code)}/ensure-tasks`, { method: 'POST', skipAuthRefresh: true, adminKeyOnly: true })
    },

    async collectPrices(opts: { set: string; dryRun?: boolean }): Promise<unknown> {
      return client.rest('/catalog-admin/jobs/collect', {
        method: 'POST',
        body: JSON.stringify({ set: opts.set, dryRun: opts.dryRun ?? false }),
        skipAuthRefresh: true, adminKeyOnly: true,
      })
    },

    async fxDaily(opts: { backfillDays?: number } = {}): Promise<unknown> {
      return client.rest('/catalog-admin/jobs/fx-daily', {
        method: 'POST',
        body: JSON.stringify(opts),
        skipAuthRefresh: true, adminKeyOnly: true,
      })
    },

    async rebuildRollups(opts: { scope?: string; set?: string; cardId?: string } = {}): Promise<unknown> {
      return client.rest('/catalog-admin/jobs/rollups', {
        method: 'POST',
        body: JSON.stringify({ scope: opts.scope ?? 'all', ...opts }),
        skipAuthRefresh: true, adminKeyOnly: true,
      })
    },

    // ── Scheduler ──────────────────────────────────────────────────────────

    async getSchedulerTasks(): Promise<SchedulerTask[]> {
      const res = await client.rest<SchedulerTask[] | { tasks: SchedulerTask[] }>('/catalog-admin/scheduler', { skipAuthRefresh: true, adminKeyOnly: true })
      return Array.isArray(res) ? res : (res as any).tasks ?? []
    },

    async runSchedulerTask(id: string): Promise<void> {
      await client.rest(`/catalog-admin/scheduler/${encodeURIComponent(id)}/run`, { method: 'POST', skipAuthRefresh: true, adminKeyOnly: true })
    },

    async pauseSchedulerTask(id: string): Promise<void> {
      await client.rest(`/catalog-admin/scheduler/${encodeURIComponent(id)}/pause`, { method: 'POST', skipAuthRefresh: true, adminKeyOnly: true })
    },

    async resumeSchedulerTask(id: string): Promise<void> {
      await client.rest(`/catalog-admin/scheduler/${encodeURIComponent(id)}/resume`, { method: 'POST', skipAuthRefresh: true, adminKeyOnly: true })
    },

    async seedScheduler(): Promise<void> {
      await client.rest('/catalog-admin/scheduler/seed', { method: 'POST', skipAuthRefresh: true, adminKeyOnly: true })
    },

    // ── Service health ─────────────────────────────────────────────────────

    async getServiceHealth(): Promise<{ gateway: ServiceHealthEntry; auth: unknown; catalog: unknown }> {
      const data = await client.gql<{ serviceHealth: { gateway: ServiceHealthEntry; auth: unknown; catalog: unknown } }>(
        `query ServiceHealth { serviceHealth { gateway { status service } auth catalog } }`
      )
      return data.serviceHealth
    },

    async getFxRates(): Promise<unknown> {
      return client.rest('/catalog-admin/fx/rates', { skipAuthRefresh: true, adminKeyOnly: true })
    },

    // ── Auth admin ─────────────────────────────────────────────────────────
    // POST /auth/admin/clear-brute — clears in-memory login rate-limit for an email.
    // Requires x-admin-key (same key used for catalog-admin endpoints).

    async clearLoginBrute(email: string): Promise<void> {
      await client.rest('/auth/admin/clear-brute', {
        method: 'POST',
        body: JSON.stringify({ email }),
        skipAuthRefresh: true, adminKeyOnly: true,
      })
    },

    // ── Subscriptions ──────────────────────────────────────────────────────

    async getSubscriptions(opts: { status?: string; page?: number; pageSize?: number } = {}): Promise<AdminSubscriptionPage> {
      const { status, page = 1, pageSize = 50 } = opts
      const data = await client.gql<{ adminSubscriptions: AdminSubscriptionPage }>(
        `query AdminSubscriptions($status: String, $page: Int, $pageSize: Int) {
          adminSubscriptions(status: $status, page: $page, pageSize: $pageSize) {
            total page pageSize
            subscriptions {
              id userId planId status currentPeriodStart currentPeriodEnd
              cancelAtPeriodEnd cancelledAt createdAt
              plan { id name price interval }
            }
          }
        }`,
        { status: status || null, page, pageSize }
      )
      return data.adminSubscriptions ?? { subscriptions: [], total: 0, page: 1, pageSize }
    },

    async getPlans(): Promise<SubscriptionPlan[]> {
      const data = await client.gql<{ adminPlans: SubscriptionPlan[] }>(
        `query AdminPlans {
          adminPlans {
            id name description price interval platformFeePercent
            maxBinders maxActiveListings maxActiveTrades
            active sortOrder createdAt
          }
        }`
      )
      return (data.adminPlans ?? []).filter(p => !p.interval?.toLowerCase().includes('year'))
    },

    async cancelAdminSubscription(id: string): Promise<void> {
      await client.gql(
        `mutation AdminCancelSub($id: ID!) { adminCancelSubscription(id: $id) }`,
        { id }
      )
    },

    async resumeAdminSubscription(id: string): Promise<void> {
      await client.gql(
        `mutation AdminResumeSub($id: ID!) { adminResumeSubscription(id: $id) }`,
        { id }
      )
    },

    async changeSubscriptionPlan(id: string, planId: string): Promise<void> {
      await client.gql(
        `mutation AdminChangePlan($id: ID!, $planId: ID!) { adminChangePlan(id: $id, planId: $planId) }`,
        { id, planId }
      )
    },

    async grantSubscription(userId: string, planId: string, periodDays?: number): Promise<void> {
      await client.gql(
        `mutation AdminGrantSub($userId: ID!, $planId: ID!, $periodDays: Int) {
          adminGrantSubscription(userId: $userId, planId: $planId, periodDays: $periodDays)
        }`,
        { userId, planId, periodDays: periodDays ?? null }
      )
    },

    async revokeSubscription(id: string): Promise<void> {
      await client.gql(
        `mutation AdminRevokeSub($id: ID!) { adminRevokeSubscription(id: $id) }`,
        { id }
      )
    },

    // ── Withdrawals ────────────────────────────────────────────────────────

    async getWithdrawals(opts: { status?: string; limit?: number; offset?: number } = {}): Promise<AdminWithdrawalList> {
      const { status = 'pending', limit = 50, offset = 0 } = opts
      const data = await client.gql<{ adminWithdrawals: AdminWithdrawalList }>(
        `query AdminWithdrawals($status: String, $limit: Int, $offset: Int) {
          adminWithdrawals(status: $status, limit: $limit, offset: $offset) {
            total
            withdrawals {
              id userId amountPence amount status description
              sortCode accountNumber accountName createdAt
            }
          }
        }`,
        { status, limit, offset }
      )
      return data.adminWithdrawals ?? { total: 0, withdrawals: [] }
    },

    async completeWithdrawal(id: string): Promise<void> {
      await client.gql(
        `mutation AdminCompleteWithdrawal($id: ID!) { adminCompleteWithdrawal(id: $id) }`,
        { id }
      )
    },

    async rejectWithdrawal(id: string, reason?: string): Promise<void> {
      await client.gql(
        `mutation AdminRejectWithdrawal($id: ID!, $reason: String) { adminRejectWithdrawal(id: $id, reason: $reason) }`,
        { id, reason: reason || null }
      )
    },

    // ── Proof queue ────────────────────────────────────────────────────────

    async getProofQueue(): Promise<ProofQueueItem[]> {
      const data = await client.gql<{ adminProofQueue: ProofQueueItem[] }>(
        `query AdminProofQueue {
          adminProofQueue {
            id sellerId cardId title price status
            proofCode proofImagePath moderationResult createdAt
          }
        }`
      )
      return data.adminProofQueue ?? []
    },

    async approveProof(id: string): Promise<void> {
      await client.gql(
        `mutation AdminApproveProof($id: ID!) { adminApproveProof(id: $id) }`,
        { id }
      )
    },

    async rejectProof(id: string, reason?: string): Promise<void> {
      await client.gql(
        `mutation AdminRejectProof($id: ID!, $reason: String) { adminRejectProof(id: $id, reason: $reason) }`,
        { id, reason: reason || null }
      )
    },

    // ── Review queue ───────────────────────────────────────────────────────

    async getReviewQueue(opts: { status?: string; limit?: number; offset?: number } = {}): Promise<ReviewQueueItem[]> {
      const { status, limit = 50, offset = 0 } = opts
      const data = await client.gql<{ adminReviewQueue: ReviewQueueItem[] }>(
        `query AdminReviewQueue($status: String, $limit: Int, $offset: Int) {
          adminReviewQueue(status: $status, limit: $limit, offset: $offset) {
            id sellerId cardId rating review reviewStatus disputeReason updatedAt
          }
        }`,
        { status: status || null, limit, offset }
      )
      return data.adminReviewQueue ?? []
    },

    async resolveReview(listingId: string, action: 'approve' | 'void'): Promise<void> {
      await client.gql(
        `mutation AdminResolveReview($listingId: ID!, $action: String!) { adminResolveReview(listingId: $listingId, action: $action) }`,
        { listingId, action }
      )
    },

    // ── Order disputes ─────────────────────────────────────────────────────

    async getOrderDisputes(status?: string): Promise<OrderDispute[]> {
      const data = await client.gql<{ adminOrderDisputes: OrderDispute[] }>(
        `query AdminOrderDisputes($status: String) {
          adminOrderDisputes(status: $status) {
            id orderId raisedBy reason status resolution
            resolvedInFavourOf escrowActionTaken resolvedAt createdAt
          }
        }`,
        { status: status || null }
      )
      return data.adminOrderDisputes ?? []
    },

    async resolveDispute(id: string, resolution: string, resolvedInFavourOf: string): Promise<void> {
      await client.gql(
        `mutation AdminResolveDispute($id: ID!, $resolution: String!, $resolvedInFavourOf: String!) {
          adminResolveDispute(id: $id, resolution: $resolution, resolvedInFavourOf: $resolvedInFavourOf)
        }`,
        { id, resolution, resolvedInFavourOf }
      )
    },

    // ── Revenue ────────────────────────────────────────────────────────────

    async getRevenueSummary(): Promise<AdminRevenueSummary> {
      const data = await client.gql<{ adminRevenueSummary: AdminRevenueSummary }>(
        `query AdminRevenueSummary {
          adminRevenueSummary {
            totalRevenue revenue30d revenue7d subRevenue productRevenue refunds currency
          }
        }`
      )
      return data.adminRevenueSummary
    },

    async getMarketplaceRevenue(): Promise<AdminMarketplaceRevenue> {
      const data = await client.gql<{ adminMarketplaceRevenue: AdminMarketplaceRevenue }>(
        `query AdminMarketplaceRevenue {
          adminMarketplaceRevenue {
            gmv platformFees shippingCollected walletUsed refundedTotal stripeFeeEstimate
            gmv30d gmv7d platformFees30d totalOrders completedOrders
            openDisputes resolvedDisputes currency
            monthly { month gmv fees orders }
          }
        }`
      )
      return data.adminMarketplaceRevenue
    },

    // ── Docker management ──────────────────────────────────────────────────
    // All calls go through the gateway /docker-admin proxy → docker-mgmt service.
    // Protected by x-admin-key (auto-forwarded by apiClient.rest via setAdminApiKey).

    async getDockerServices(): Promise<DockerService[]> {
      return client.rest<DockerService[]>('/docker-admin/services', { skipAuthRefresh: true, adminKeyOnly: true })
    },

    async dockerAction(name: string, action: 'start' | 'stop' | 'restart'): Promise<{ ok: boolean; name: string; action: string }> {
      return client.rest(`/docker-admin/services/${encodeURIComponent(name)}/${action}`, { method: 'POST', skipAuthRefresh: true, adminKeyOnly: true })
    },

    async dockerRestartAll(): Promise<DockerRestartAllResult> {
      return client.rest<DockerRestartAllResult>('/docker-admin/services/restart-all', { method: 'POST', skipAuthRefresh: true, adminKeyOnly: true })
    },

    async getDockerLogs(name: string, tail = 100): Promise<{ name: string; logs: string }> {
      return client.rest<{ name: string; logs: string }>(
        `/docker-admin/services/${encodeURIComponent(name)}/logs?tail=${tail}`,
        { skipAuthRefresh: true, adminKeyOnly: true }
      )
    },

    // ── Mailbox webmail SSO ─────────────────────────────────────────────────
    // All calls go through the gateway /mail-admin proxy → mail-mgmt service.
    // Protected by x-admin-key (auto-forwarded by apiClient.rest via setAdminApiKey).

    async getMailboxes(): Promise<MailboxSummary[]> {
      return client.rest<MailboxSummary[]>('/mail-admin/mailboxes', { skipAuthRefresh: true, adminKeyOnly: true })
    },

    async addMailbox(address: string, password: string, label?: string): Promise<{ ok: boolean; address: string }> {
      return client.rest('/mail-admin/mailboxes', {
        method: 'POST',
        body: JSON.stringify({ address, password, label }),
        skipAuthRefresh: true, adminKeyOnly: true,
      })
    },

    async removeMailbox(address: string): Promise<{ ok: boolean; address: string }> {
      return client.rest(`/mail-admin/mailboxes/${encodeURIComponent(address)}`, {
        method: 'DELETE',
        skipAuthRefresh: true, adminKeyOnly: true,
      })
    },

    async openMailboxWebmail(address: string): Promise<{ token: string; url: string }> {
      return client.rest(`/mail-admin/mailboxes/${encodeURIComponent(address)}/sso-token`, {
        method: 'POST',
        skipAuthRefresh: true, adminKeyOnly: true,
      })
    },
  }
}
