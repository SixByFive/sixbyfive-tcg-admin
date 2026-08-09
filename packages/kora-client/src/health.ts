import type { KoraApiClient } from './client'
import type { KoraHealthResult } from './types'

export function createKoraHealthApi(client: KoraApiClient) {
  return {
    async check(): Promise<KoraHealthResult> {
      return client.adminRest<KoraHealthResult>('/health')
    },
  }
}
