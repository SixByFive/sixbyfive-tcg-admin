import { adminApi } from './api'

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
  notes: string[]
}

export async function loadMarketingLiveDataSnapshot(): Promise<MarketingLiveDataSnapshot> {
  const [stats, collections, listingsResult, tradesResult] = await Promise.all([
    adminApi.getStats(),
    adminApi.getUserCollections({ limit: 200 }),
    adminApi.getListings({ page: 1 }),
    adminApi.getTrades({ page: 1 }),
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
    notes: [
      'totalUsers is an exact admin count at capture time.',
      'Collection figures are based on up to 200 collection profiles returned by the admin API and are not guaranteed platform-wide totals.',
      'Marketplace listings and trades are recent first-page samples, not platform-wide totals.',
      'Do not expose usernames, emails, user IDs or other personal data in generated marketing copy.',
    ],
  }
}
