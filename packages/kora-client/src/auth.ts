import type { KoraApiClient } from './client'
import type { KoraLoginResponse, KoraUser } from './types'

export function createKoraAuthApi(client: KoraApiClient) {
  return {
    async login(email: string, password: string): Promise<KoraLoginResponse> {
      return client.rest<KoraLoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuthRefresh: true,
      })
    },

    async refresh(refreshToken: string): Promise<KoraLoginResponse> {
      return client.rest<KoraLoginResponse>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
        skipAuthRefresh: true,
      })
    },

    async me(): Promise<KoraUser> {
      return client.rest<KoraUser>('/auth/me', { skipAuthRefresh: true })
    },

    async logout(refreshToken: string): Promise<void> {
      await client.rest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
        skipAuthRefresh: true,
      }).catch(() => { /* ignore */ })
    },
  }
}
