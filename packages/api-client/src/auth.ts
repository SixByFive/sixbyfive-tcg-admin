import type { ApiClient } from './client'
import type { AuthUser } from '@tcg-admin/types'

export interface LoginResponse {
  accessToken: string
  refreshToken: string
}

export function createAuthApi(client: ApiClient) {
  return {
    async login(email: string, password: string): Promise<LoginResponse> {
      return client.rest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
    },

    async refresh(refreshToken: string): Promise<LoginResponse> {
      return client.rest<LoginResponse>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      })
    },

    async me(): Promise<AuthUser> {
      return client.rest<AuthUser>('/auth/me')
    },

    async logout(): Promise<void> {
      await client.rest('/auth/logout', { method: 'POST' }).catch(() => { /* ignore */ })
    },
  }
}
