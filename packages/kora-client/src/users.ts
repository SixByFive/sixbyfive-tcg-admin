import type { KoraApiClient } from './client'
import type { KoraUserSummary } from './types'

export function createKoraUsersApi(client: KoraApiClient) {
  return {
    async search(email: string): Promise<KoraUserSummary[]> {
      const params = new URLSearchParams({ email })
      return client.rest<KoraUserSummary[]>(`/users/search?${params}`)
    },
  }
}
