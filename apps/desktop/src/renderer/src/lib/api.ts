import { ApiClient, createAuthApi, createAdminApi } from '@tcg-admin/api-client'

// Electron main process sets webSecurity: false in dev so the renderer can
// fetch the production API directly without CORS blocking.
// In production (file:// context) the gateway already allows null origins.
const API_URL = import.meta.env.VITE_API_URL ?? 'https://backendtcg.sixbyfive.com'

export const apiClient = new ApiClient(API_URL)

// Catalog-service admin key — forwarded as x-admin-key via the /catalog-admin gateway proxy.
// Priority: VITE_ADMIN_API_KEY env var → localStorage (saved by the admin UI at runtime).
const envAdminKey     = import.meta.env.VITE_ADMIN_API_KEY ?? ''
const storedAdminKey  = localStorage.getItem('adminApiKey') ?? ''
const resolvedAdminKey = envAdminKey || storedAdminKey
if (resolvedAdminKey) apiClient.setAdminApiKey(resolvedAdminKey)

/** Persist and immediately apply a new admin API key. */
export function saveAdminApiKey(key: string): void {
  const trimmed = key.trim()
  localStorage.setItem('adminApiKey', trimmed)
  apiClient.setAdminApiKey(trimmed)
}

export const authApi = createAuthApi(apiClient)
export const adminApi = createAdminApi(apiClient)
