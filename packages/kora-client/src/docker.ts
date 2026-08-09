import type { KoraApiClient } from './client'
import type { KoraDockerService, KoraDockerRestartResult } from './types'

export function createKoraDockerApi(client: KoraApiClient) {
  return {
    async listServices(): Promise<KoraDockerService[]> {
      return client.adminRest<KoraDockerService[]>('/docker/services')
    },

    async action(name: string, act: 'start' | 'stop' | 'restart'): Promise<{ ok: boolean; name: string; action: string }> {
      return client.adminRest(`/docker/services/${encodeURIComponent(name)}/${act}`, { method: 'POST' })
    },

    async restartAll(): Promise<KoraDockerRestartResult> {
      return client.adminRest<KoraDockerRestartResult>('/docker/services/restart-all', { method: 'POST' })
    },

    async getLogs(name: string, tail: number): Promise<{ name: string; logs: string }> {
      return client.adminRest<{ name: string; logs: string }>(
        `/docker/services/${encodeURIComponent(name)}/logs?tail=${tail}`,
      )
    },
  }
}
