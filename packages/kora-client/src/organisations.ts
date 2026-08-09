import type { KoraApiClient } from './client'
import type { KoraOrganisation } from './types'

export function createKoraOrgsApi(client: KoraApiClient) {
  return {
    // For platform admins, GET /organisations/my returns all organisations.
    async list(): Promise<KoraOrganisation[]> {
      return client.rest<KoraOrganisation[]>('/organisations/my')
    },

    async get(orgId: string): Promise<KoraOrganisation> {
      const [orgs, members] = await Promise.all([
        client.rest<KoraOrganisation[]>('/organisations/my'),
        client.rest<KoraOrganisation['userAccess']>(`/organisations/${orgId}/members`),
      ])
      const org = orgs.find((o) => o.id === orgId)
      if (!org) throw new Error('Organisation not found')
      return { ...org, userAccess: members }
    },
  }
}
