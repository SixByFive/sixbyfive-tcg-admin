import type { KoraApiClient } from './client'
import type { KoraHome } from './types'

export function createKoraHomesApi(client: KoraApiClient) {
  return {
    // For platform admins, GET /homes/my returns all homes.
    async list(): Promise<KoraHome[]> {
      return client.rest<KoraHome[]>('/homes/my')
    },

    async get(homeId: string): Promise<KoraHome> {
      return client.rest<KoraHome>(`/homes/${homeId}`)
    },
  }
}
