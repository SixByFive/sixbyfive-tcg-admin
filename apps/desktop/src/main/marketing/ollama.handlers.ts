import { ipcMain } from 'electron'

const OLLAMA_BASE_URL = 'http://127.0.0.1:11434'

interface OllamaModel {
  name: string
  model?: string
  size?: number
  details?: {
    parameter_size?: string
    quantization_level?: string
  }
}

interface GenerateCampaignArgs {
  model: string
  goal: 'registrations' | 'collection' | 'trading' | 'marketplace'
  brief?: string
}

interface GeneratedPlatformPost {
  platform: 'Facebook' | 'Instagram' | 'LinkedIn' | 'Discord'
  content: string
}

interface OllamaChatResponse {
  message?: {
    content?: string
  }
}

const campaignSchema = {
  type: 'object',
  properties: {
    posts: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: {
        type: 'object',
        properties: {
          platform: { type: 'string', enum: ['Facebook', 'Instagram', 'LinkedIn', 'Discord'] },
          content: { type: 'string' },
        },
        required: ['platform', 'content'],
      },
    },
  },
  required: ['posts'],
} as const

function goalDescription(goal: GenerateCampaignArgs['goal']): string {
  switch (goal) {
    case 'collection':
      return 'get Pokémon collectors to create an account and start tracking their collection, binders and wishlist'
    case 'trading':
      return 'get Pokémon collectors to create an account and use SixByFive TCG trading to find useful trades for duplicates and wanted cards'
    case 'marketplace':
      return 'get Pokémon collectors to create an account and use the SixByFive TCG marketplace to discover, buy or sell cards'
    default:
      return 'get Pokémon collectors to create a free SixByFive TCG account and become active users'
  }
}

function systemPrompt(): string {
  return [
    'You are the acquisition copywriter for SixByFive TCG, a UK-focused Pokémon TCG collection, trading and marketplace platform.',
    'Your job is to acquire real users, not generate generic engagement bait.',
    'Write like a collector or product builder speaking naturally to collectors.',
    'Never invent prices, statistics, user counts, partnerships, offers, card data or features.',
    'Do not claim anything beyond the supplied product facts.',
    'Avoid generic phrases such as "calling all collectors", "game changer", "revolutionary", or excessive emoji.',
    'Each platform post must be meaningfully adapted to that platform rather than copied verbatim.',
    'Facebook: conversational collector-focused copy with a clear reason to click.',
    'Instagram: concise, visual-first wording; light emoji is acceptable but not required.',
    'LinkedIn: founder/building-product angle while still giving readers a reason to try the product.',
    'Discord: direct, informal community language; do not sound like an advert bot.',
    'Do not include URLs. The application adds tracked campaign links itself.',
    'Return only data matching the supplied JSON schema.',
  ].join('\n')
}

async function listModels(): Promise<{ ok: boolean; models: OllamaModel[]; error?: string }> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`)
    const body = await response.json() as { models?: OllamaModel[] }
    return { ok: true, models: body.models ?? [] }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      models: [],
      error: `Could not connect to local Ollama at ${OLLAMA_BASE_URL}. Make sure Ollama is installed and running. ${message}`,
    }
  }
}

async function generateCampaign(args: GenerateCampaignArgs): Promise<{ ok: boolean; posts?: GeneratedPlatformPost[]; error?: string }> {
  if (!args?.model?.trim()) return { ok: false, error: 'Choose an Ollama model first.' }

  const brief = args.brief?.trim()
  const userPrompt = [
    `Campaign objective: ${goalDescription(args.goal)}.`,
    '',
    'Known SixByFive TCG product facts:',
    '- Users can track Pokémon TCG cards in a collection.',
    '- Users can organise cards into digital binders.',
    '- Users can maintain a wishlist.',
    '- Trading is available.',
    '- A marketplace is available.',
    '- The campaign should prioritise sign-up and meaningful product use over likes or reactions.',
    brief ? `\nCampaign brief supplied by the admin:\n${brief}` : '',
    '',
    'Create exactly one post for Facebook, Instagram, LinkedIn and Discord.',
  ].filter(Boolean).join('\n')

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(120000),
      body: JSON.stringify({
        model: args.model.trim(),
        stream: false,
        format: campaignSchema,
        messages: [
          { role: 'system', content: systemPrompt() },
          { role: 'user', content: userPrompt },
        ],
        options: {
          temperature: 0.8,
        },
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`Ollama returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`)
    }

    const body = await response.json() as OllamaChatResponse
    const raw = body.message?.content
    if (!raw) throw new Error('Ollama returned an empty response.')

    const parsed = JSON.parse(raw) as { posts?: GeneratedPlatformPost[] }
    const expected = ['Facebook', 'Instagram', 'LinkedIn', 'Discord']
    const posts = parsed.posts?.filter(post => expected.includes(post.platform) && typeof post.content === 'string' && post.content.trim()) ?? []

    if (posts.length !== 4 || new Set(posts.map(post => post.platform)).size !== 4) {
      throw new Error('Ollama did not return one valid post for each platform.')
    }

    return { ok: true, posts }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: message }
  }
}

export function registerMarketingIpcHandlers(): void {
  ipcMain.handle('marketing:ollama:listModels', listModels)
  ipcMain.handle('marketing:ollama:generateCampaign', (_event, args: GenerateCampaignArgs) => generateCampaign(args))
}
