import { ipcMain } from 'electron'
import { getDecryptedPassword, listEntries, saveEntry } from '../vault/vault.service.js'
import {
  listBufferPublications,
  recordPublication,
  updatePublicationMetrics,
  type StoredPostMetric,
} from './campaign.store.js'

const BUFFER_API_URL = 'https://api.buffer.com'
const BUFFER_VAULT_NAME = 'SixByFive Marketing - Buffer API'

type BufferChannel = {
  id: string
  name: string
  service: string
  organizationId: string
}

type PublishArgs = {
  campaignId?: string
  postId?: number
  channelId: string
  channelName?: string
  service?: string
  text: string
  mode?: 'shareNow' | 'addToQueue'
}

function findBufferVaultEntry() {
  return listEntries().find((entry: any) => entry.name === BUFFER_VAULT_NAME) ?? null
}

function getBufferToken(): string | null {
  const entry = findBufferVaultEntry()
  if (!entry?.id) return null
  return getDecryptedPassword(entry.id)
}

function gqlString(value: string): string {
  return JSON.stringify(value)
}

async function bufferGraphql(token: string, query: string) {
  const response = await fetch(BUFFER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(20000),
  })

  const body = await response.json() as { data?: any; errors?: Array<{ message?: string }> }
  if (!response.ok) throw new Error(`Buffer returned HTTP ${response.status}`)
  if (body.errors?.length) throw new Error(body.errors.map(error => error.message || 'Buffer API error').join('; '))
  return body.data
}

async function fetchChannels(token: string): Promise<BufferChannel[]> {
  const accountData = await bufferGraphql(token, `
    query MarketingOrganizations {
      account {
        organizations { id name }
      }
    }
  `)

  const organizations = accountData?.account?.organizations ?? []
  const channels: BufferChannel[] = []

  for (const organization of organizations) {
    const data = await bufferGraphql(token, `
      query MarketingChannels {
        channels(input: { organizationId: ${gqlString(String(organization.id))} }) {
          id
          name
          service
        }
      }
    `)

    for (const channel of data?.channels ?? []) {
      channels.push({
        id: channel.id,
        name: channel.name,
        service: String(channel.service || '').toLowerCase(),
        organizationId: organization.id,
      })
    }
  }

  return channels
}

async function getBufferConnection() {
  const token = getBufferToken()
  if (!token) return { ok: true, connected: false, channels: [] as BufferChannel[] }

  try {
    const channels = await fetchChannels(token)
    return { ok: true, connected: true, channels }
  } catch (error) {
    return {
      ok: false,
      connected: false,
      channels: [] as BufferChannel[],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function connectBuffer(_event: unknown, { apiKey }: { apiKey?: string }) {
  const token = apiKey?.trim()
  if (!token) return { ok: false, error: 'Enter a Buffer API key.' }

  try {
    const channels = await fetchChannels(token)
    const existing = findBufferVaultEntry()
    const saved = saveEntry({
      id: existing?.id,
      name: BUFFER_VAULT_NAME,
      url: 'https://buffer.com',
      username: 'Buffer API',
      password: token,
      category: 'service',
      notes: 'Used by TCG Marketing for connected social channels and publishing.',
    })

    if (!saved?.ok) return saved
    return { ok: true, connected: true, channels }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function publishBufferPost(_event: unknown, args: PublishArgs) {
  const token = getBufferToken()
  if (!token) return { ok: false, error: 'Buffer is not connected.' }
  if (!args?.channelId || !args?.text?.trim()) return { ok: false, error: 'A channel and post text are required.' }

  const mode = args.mode === 'addToQueue' ? 'addToQueue' : 'shareNow'

  try {
    const data = await bufferGraphql(token, `
      mutation PublishMarketingPost {
        createPost(input: {
          text: ${gqlString(args.text.trim())}
          channelId: ${gqlString(args.channelId)}
          schedulingType: automatic
          mode: ${mode}
        }) {
          ... on PostActionSuccess {
            post {
              id
              text
              dueAt
              channelId
              externalLink
            }
          }
          ... on MutationError { message }
        }
      }
    `)

    const result = data?.createPost
    if (result?.message) return { ok: false, error: result.message }
    if (!result?.post?.id) return { ok: false, error: 'Buffer did not return a created post.' }

    if (args.campaignId && Number.isFinite(args.postId)) {
      recordPublication(args.campaignId, Number(args.postId), {
        provider: 'buffer',
        providerPostId: String(result.post.id),
        channelId: args.channelId,
        channelName: args.channelName,
        service: args.service,
        mode,
        createdAt: new Date().toISOString(),
        dueAt: result.post.dueAt ?? null,
        externalLink: result.post.externalLink ?? null,
      })
    }

    return { ok: true, post: result.post }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function syncBufferMetrics() {
  const token = getBufferToken()
  if (!token) return { ok: false, error: 'Buffer is not connected.', synced: 0 }

  const publications = listBufferPublications()
  let synced = 0
  const errors: string[] = []

  for (const publication of publications) {
    try {
      const data = await bufferGraphql(token, `
        query MarketingPostMetrics {
          post(input: { id: ${gqlString(publication.providerPostId)} }) {
            id
            externalLink
            metrics {
              type
              name
              value
              unit
            }
            metricsUpdatedAt
          }
        }
      `)
      const post = data?.post
      if (!post?.id) continue

      const metrics: StoredPostMetric[] = Array.isArray(post.metrics)
        ? post.metrics.map((metric: any) => ({
            type: String(metric.type ?? ''),
            name: String(metric.name ?? metric.type ?? ''),
            value: Number(metric.value ?? 0),
            unit: metric.unit == null ? null : String(metric.unit),
          }))
        : []

      updatePublicationMetrics(publication.providerPostId, {
        metrics,
        metricsUpdatedAt: post.metricsUpdatedAt ?? null,
        lastMetricsSyncAt: new Date().toISOString(),
        externalLink: post.externalLink ?? publication.externalLink ?? null,
      })
      synced += 1
    } catch (error) {
      errors.push(`${publication.providerPostId}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return { ok: errors.length === 0, synced, errors }
}

export function registerBufferIpcHandlers(): void {
  ipcMain.handle('marketing:buffer:getConnection', getBufferConnection)
  ipcMain.handle('marketing:buffer:connect', connectBuffer)
  ipcMain.handle('marketing:buffer:publish', publishBufferPost)
  ipcMain.handle('marketing:buffer:syncMetrics', syncBufferMetrics)
}
