import {
  KoraApiClient,
  createKoraAuthApi,
  createKoraOrgsApi,
  createKoraHomesApi,
  createKoraUsersApi,
  createKoraHealthApi,
  createKoraDockerApi,
} from '@sixbyfive/kora-client'

const KORA_URL = import.meta.env.VITE_KORA_API_URL ?? 'https://api.koraplatform.co.uk'
const KORA_ADMIN_KEY = import.meta.env.VITE_KORA_ADMIN_KEY ?? ''

// Route Kora API calls through the main process (IPC) so they bypass renderer
// CORS restrictions. In production, the renderer runs from file:// (null origin)
// which Chromium blocks even with webSecurity:false.
async function koraFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const proxy = (window as any).koraProxy
  if (proxy) {
    const url   = input instanceof Request ? input.url : String(input)
    const result = await proxy.fetch({
      url,
      method:  init?.method  ?? 'GET',
      headers: init?.headers as Record<string, string> | undefined,
      body:    init?.body    as string | undefined,
    })
    return new Response(result.text, { status: result.status })
  }
  return fetch(input, init)
}

export const koraClient = new KoraApiClient(KORA_URL)
koraClient.setFetch(koraFetch)
koraClient.setAdminKey(KORA_ADMIN_KEY || null)

export const koraAuthApi = createKoraAuthApi(koraClient)
export const koraOrgsApi = createKoraOrgsApi(koraClient)
export const koraHomesApi = createKoraHomesApi(koraClient)
export const koraUsersApi = createKoraUsersApi(koraClient)
export const koraHealthApi = createKoraHealthApi(koraClient)
export const koraDockerApi = createKoraDockerApi(koraClient)
