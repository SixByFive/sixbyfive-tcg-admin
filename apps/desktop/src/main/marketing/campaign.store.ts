import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

export type CampaignPlatform = 'Facebook' | 'Instagram' | 'LinkedIn' | 'Discord'
export type CampaignGoal = 'registrations' | 'collection' | 'trading' | 'marketplace'
export type CampaignStatus = 'draft' | 'approved'

export interface StoredCampaignPost {
  id: number
  platform: CampaignPlatform
  content: string
  status: CampaignStatus
}

export interface StoredCampaign {
  id: string
  createdAt: string
  updatedAt: string
  model: string
  goal: CampaignGoal
  brief: string
  posts: StoredCampaignPost[]
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
  const next: StoredCampaign = { ...input, updatedAt: now }
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
