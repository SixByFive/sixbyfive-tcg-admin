import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

export type CampaignPlatform = 'Facebook' | 'Instagram' | 'LinkedIn' | 'Discord'
export type CampaignGoal = 'registrations' | 'collection' | 'trading' | 'marketplace'
export type CampaignStatus = 'draft' | 'approved'

export interface StoredPostMetric {
  type: string
  name: string
  value: number
  unit?: string | null
}

export interface StoredPublication {
  provider: 'buffer'
  providerPostId: string
  channelId: string
  channelName?: string
  service?: string
  mode: 'shareNow' | 'addToQueue'
  createdAt: string
  dueAt?: string | null
  externalLink?: string | null
  metrics?: StoredPostMetric[]
  metricsUpdatedAt?: string | null
  lastMetricsSyncAt?: string | null
}

export interface StoredCampaignPost {
  id: number
  platform: CampaignPlatform
  content: string
  status: CampaignStatus
  publications?: StoredPublication[]
}

export interface StoredCampaign {
  id: string
  createdAt: string
  updatedAt: string
  model: string
  goal: CampaignGoal
  brief: string
  posts: StoredCampaignPost[]
  liveDataSnapshot?: Record<string, unknown>
}

interface CampaignStoreFile {
  campaigns: StoredCampaign[]
  activeCampaignId?: string
}

function getStorePath(): string {
  return path.join(app.getPath('userData'), 'marketing-campaigns.json')
}

function readStore(): CampaignStoreFile {
  try {
    const filePath = getStorePath()
    if (!fs.existsSync(filePath)) return { campaigns: [] }
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as CampaignStoreFile
    return {
      campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
      activeCampaignId: parsed.activeCampaignId,
    }
  } catch {
    return { campaigns: [] }
  }
}

function writeStore(store: CampaignStoreFile): void {
  const filePath = getStorePath()
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8')
}

export function getActiveCampaign(): StoredCampaign | null {
  const store = readStore()
  if (!store.campaigns.length) return null

  const active = store.activeCampaignId
    ? store.campaigns.find(campaign => campaign.id === store.activeCampaignId)
    : null

  return active ?? store.campaigns[0] ?? null
}

export function saveCampaign(input: Omit<StoredCampaign, 'updatedAt'>): StoredCampaign {
  const store = readStore()
  const now = new Date().toISOString()
  const existing = store.campaigns.find(campaign => campaign.id === input.id)

  // Renderer saves should never erase publication/metrics metadata that was
  // written by the main-process publishing integration.
  const posts = input.posts.map(post => {
    const previous = existing?.posts.find(item => item.id === post.id)
    return {
      ...post,
      publications: post.publications ?? previous?.publications,
    }
  })

  const next: StoredCampaign = {
    ...input,
    posts,
    liveDataSnapshot: input.liveDataSnapshot ?? existing?.liveDataSnapshot,
    updatedAt: now,
  }
  const index = store.campaigns.findIndex(campaign => campaign.id === input.id)

  if (index >= 0) store.campaigns[index] = next
  else store.campaigns.unshift(next)

  store.activeCampaignId = next.id
  writeStore(store)
  return next
}

export function listCampaigns(): StoredCampaign[] {
  return readStore().campaigns
}

export function recordPublication(
  campaignId: string,
  postId: number,
  publication: StoredPublication,
): StoredCampaign | null {
  const store = readStore()
  const campaign = store.campaigns.find(item => item.id === campaignId)
  if (!campaign) return null
  const post = campaign.posts.find(item => item.id === postId)
  if (!post) return null

  const existing = post.publications ?? []
  post.publications = [publication, ...existing.filter(item => item.providerPostId !== publication.providerPostId)]
  campaign.updatedAt = new Date().toISOString()
  writeStore(store)
  return campaign
}

export function updatePublicationMetrics(
  providerPostId: string,
  update: Pick<StoredPublication, 'metrics' | 'metricsUpdatedAt' | 'lastMetricsSyncAt' | 'externalLink'>,
): boolean {
  const store = readStore()
  let changed = false

  for (const campaign of store.campaigns) {
    for (const post of campaign.posts) {
      const publication = post.publications?.find(item => item.providerPostId === providerPostId)
      if (!publication) continue
      publication.metrics = update.metrics
      publication.metricsUpdatedAt = update.metricsUpdatedAt
      publication.lastMetricsSyncAt = update.lastMetricsSyncAt
      publication.externalLink = update.externalLink ?? publication.externalLink
      campaign.updatedAt = new Date().toISOString()
      changed = true
    }
  }

  if (changed) writeStore(store)
  return changed
}

export function listBufferPublications(): StoredPublication[] {
  return readStore().campaigns.flatMap(campaign =>
    campaign.posts.flatMap(post => post.publications ?? [])
  ).filter(publication => publication.provider === 'buffer')
}

export function deleteCampaign(id: string): boolean {
  const store = readStore()
  const before = store.campaigns.length
  store.campaigns = store.campaigns.filter(campaign => campaign.id !== id)

  if (store.activeCampaignId === id) {
    store.activeCampaignId = store.campaigns[0]?.id
  }

  if (store.campaigns.length === before) return false
  writeStore(store)
  return true
}
