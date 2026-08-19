import { adminApi, apiClient } from './api'

export interface MarketingAttributionCampaign {
  source: string | null
  medium: string | null
  campaign: string | null
  campaignId: string | null
  registrations: number
  firstRegistrationAt: string | null
  lastRegistrationAt: string | null
}

export interface MarketingAttributionSummary {
  totalAttributedRegistrations: number
  campaigns: MarketingAttributionCampaign[]
}

export interface MarketingLiveDataSnapshot {
  capturedAt: string
  totalUsers: number
  collectionProfilesSampled: number
  collectionCardsInSample: number
  distinctCardsInSample: number
  recentMarketplaceListings: Array<{
    title: string
    price: number
    status: string
  }>
  recentTradesSampleCount: number
  attribution: MarketingAttributionSummary
  notes: string[]
}

export async function loadMarketingLiveDataSnapshot(): Promise<MarketingLiveDataSnapshot> {
  const [stats, collections, listingsResult, tradesResult, attribution] = await Promise.all([
    adminApi.getStats(),
    adminApi.getUserCollections({ limit: 200 }),
    adminApi.getListings({ page: 1 }),
    adminApi.getTrades({ page: 1 }),
    apiClient.rest<MarketingAttributionSummary>('/auth/attribution/admin')
      .catch(() => ({ totalAttributedRegistrations: 0, campaigns: [] })),
  ])

  const collectionCardsInSample = collections.reduce((sum, item) => sum + Number(item.totalCards ?? 0), 0)
  const distinctCardsInSample = collections.reduce((sum, item) => sum + Number(item.distinctCards ?? 0), 0)

  return {
    capturedAt: new Date().toISOString(),
    totalUsers: Number(stats.totalUsers ?? 0),
    collectionProfilesSampled: collections.length,
    collectionCardsInSample,
    distinctCardsInSample,
    recentMarketplaceListings: (listingsResult.listings ?? []).slice(0, 8).map(listing => ({
      title: String(listing.title ?? ''),
      price: Number(listing.price ?? 0),
      status: String(listing.status ?? ''),
    })),
    recentTradesSampleCount: (tradesResult.trades ?? []).length,
    attribution: {
      totalAttributedRegistrations: Number(attribution?.totalAttributedRegistrations ?? 0),
      campaigns: Array.isArray(attribution?.campaigns) ? attribution.campaigns : [],
    },
    notes: [
      'totalUsers is an exact admin count at capture time.',
      'Collection figures are based on up to 200 collection profiles returned by the admin API and are not guaranteed platform-wide totals.',
      'Marketplace listings and trades are recent first-page samples, not platform-wide totals.',
      'attribution contains aggregate signup counts keyed by campaignId; it contains no username, email, or user id.',
      'Do not expose usernames, emails, user IDs or other personal data in generated marketing copy.',
    ],
  }
}
