import { ApiClient, createAuthApi, createAdminApi } from '@tcg-admin/api-client'

const API_URL = import.meta.env.VITE_API_URL ?? 'https://api.yourdomain.com'

export const apiClient = new ApiClient(API_URL)
export const authApi = createAuthApi(apiClient)
export const adminApi = createAdminApi(apiClient)
