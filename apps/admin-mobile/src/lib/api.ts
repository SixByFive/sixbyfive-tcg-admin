import { ApiClient, createAdminApi, createAuthApi } from '@tcg-admin/api-client'

const API_URL   = process.env.EXPO_PUBLIC_API_URL   ?? 'https://backendtcg.sixbyfive.com'
const ADMIN_KEY = process.env.EXPO_PUBLIC_ADMIN_API_KEY ?? ''

export const apiClient = new ApiClient(API_URL)
apiClient.setAdminApiKey(ADMIN_KEY)

export const authApi  = createAuthApi(apiClient)
export const adminApi = createAdminApi(apiClient)
