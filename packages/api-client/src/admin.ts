import type { ApiClient } from './client'
import type { AdminUser, AdminOrder, AdminTrade, AdminListing } from '@tcg-admin/types'

export function createAdminApi(client: ApiClient) {
  return {
    // ── Users ──────────────────────────────────────────────────────────────

    async getUsers(opts: { page?: number; search?: string } = {}): Promise<{ users: AdminUser[]; total: number }> {
      const { page = 1, search } = opts
      const data = await client.gql<{ adminUsers: { users: AdminUser[]; total: number } }>(
        `query AdminUsers($page: Int, $search: String) {
          adminUsers(page: $page, search: $search) {
            total
            users {
              id username email role subscriptionTier isSuspended isVerified walletBalance createdAt
            }
          }
        }`,
        { page, search: search || null }
      )
      return data.adminUsers
    },

    async getUser(id: string): Promise<AdminUser> {
      const data = await client.gql<{ adminUser: AdminUser }>(
        `query AdminUser($id: ID!) {
          adminUser(id: $id) {
            id username email role subscriptionTier isSuspended isVerified walletBalance createdAt
          }
        }`,
        { id }
      )
      return data.adminUser
    },

    async suspendUser(id: string, reason: string): Promise<void> {
      await client.gql(
        `mutation AdminSuspendUser($id: ID!, $reason: String!) {
          adminSuspendUser(id: $id, reason: $reason)
        }`,
        { id, reason }
      )
    },

    async unsuspendUser(id: string): Promise<void> {
      await client.gql(
        `mutation AdminUnsuspendUser($id: ID!) {
          adminUnsuspendUser(id: $id)
        }`,
        { id }
      )
    },

    async adjustWallet(id: string, amountPence: number, note: string): Promise<void> {
      await client.gql(
        `mutation AdminAdjustWallet($id: ID!, $amountPence: Int!, $note: String!) {
          adminAdjustWallet(userId: $id, amountPence: $amountPence, note: $note)
        }`,
        { id, amountPence, note }
      )
    },

    // ── Orders ─────────────────────────────────────────────────────────────

    async getOrders(opts: { page?: number; status?: string } = {}): Promise<{ orders: AdminOrder[]; total: number }> {
      const { page = 1, status } = opts
      const data = await client.gql<{ adminOrders: { orders: AdminOrder[]; total: number } }>(
        `query AdminOrders($page: Int, $status: String) {
          adminOrders(page: $page, status: $status) {
            total
            orders {
              id buyerId sellerId status fulfilmentStatus paymentStatus totalPricePence createdAt
              buyer { username }
              seller { username }
            }
          }
        }`,
        { page, status: status || null }
      )
      return data.adminOrders
    },

    // ── Trades ─────────────────────────────────────────────────────────────

    async getTrades(opts: { page?: number; status?: string } = {}): Promise<{ trades: AdminTrade[]; total: number }> {
      const { page = 1, status } = opts
      const data = await client.gql<{ adminTrades: { trades: AdminTrade[]; total: number } }>(
        `query AdminTrades($page: Int, $status: String) {
          adminTrades(page: $page, status: $status) {
            total
            trades {
              id partyAId partyBId status createdAt
              partyA { username }
              partyB { username }
            }
          }
        }`,
        { page, status: status || null }
      )
      return data.adminTrades
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

    async getListings(opts: { page?: number; search?: string; suspended?: boolean } = {}): Promise<{ listings: AdminListing[]; total: number }> {
      const { page = 1, search, suspended } = opts
      const data = await client.gql<{ adminListings: { listings: AdminListing[]; total: number } }>(
        `query AdminListings($page: Int, $search: String, $suspended: Boolean) {
          adminListings(page: $page, search: $search, suspended: $suspended) {
            total
            listings {
              id sellerId cardName price status isSuspended createdAt
              seller { username }
            }
          }
        }`,
        { page, search: search || null, suspended: suspended ?? null }
      )
      return data.adminListings
    },

    async suspendListing(id: string, reason: string): Promise<void> {
      await client.gql(
        `mutation AdminSuspendListing($id: ID!, $reason: String!) {
          adminSuspendListing(id: $id, reason: $reason)
        }`,
        { id, reason }
      )
    },

    // ── Financials ─────────────────────────────────────────────────────────

    async getStats(): Promise<{
      totalRevenuePence: number
      revenueThisMonthPence: number
      totalUsers: number
      activeSubscriptions: number
      openOrders: number
      openTrades: number
      openDisputes: number
    }> {
      const data = await client.gql<{ adminStats: ReturnType<typeof this.getStats> extends Promise<infer T> ? T : never }>(
        `query AdminStats {
          adminStats {
            totalRevenuePence revenueThisMonthPence totalUsers
            activeSubscriptions openOrders openTrades openDisputes
          }
        }`
      )
      return (data as any).adminStats
    },
  }
}
