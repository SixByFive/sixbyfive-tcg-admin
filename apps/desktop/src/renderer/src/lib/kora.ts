import {
  KoraApiClient,
  createKoraAuthApi,
  createKoraOrgsApi,
  createKoraHomesApi,
  createKoraUsersApi,
  createKoraHealthApi,
  createKoraDockerApi,
} from '@sixbyfive/kora-client'

const KORA_URL = import.meta.env.VITE_KORA_API_URL ?? 'http://localhost:3000'
const KORA_ADMIN_KEY = import.meta.env.VITE_KORA_ADMIN_KEY ?? ''

export const koraClient = new KoraApiClient(KORA_URL)
koraClient.setAdminKey(KORA_ADMIN_KEY || null)

export const koraAuthApi = createKoraAuthApi(koraClient)
export const koraOrgsApi = createKoraOrgsApi(koraClient)
export const koraHomesApi = createKoraHomesApi(koraClient)
export const koraUsersApi = createKoraUsersApi(koraClient)
export const koraHealthApi = createKoraHealthApi(koraClient)
export const koraDockerApi = createKoraDockerApi(koraClient)
