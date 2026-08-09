export interface KoraUser {
  id: string
  email: string
  firstName: string
  lastName: string
  isActive: boolean
  isPlatformAdmin: boolean
  createdAt: string
  updatedAt: string
}

export interface KoraLoginResponse {
  accessToken: string
  refreshToken: string
  user?: KoraUser
}

export interface KoraOrganisation {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  homes?: KoraHome[]
  userAccess?: KoraOrgMember[]
}

export interface KoraOrgMember {
  id: string
  userId: string
  role: string
  isActive: boolean
  createdAt: string
  user?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
}

export interface KoraHome {
  id: string
  name: string
  slug: string
  organisationId: string
  createdAt: string
  updatedAt: string
  tenantDatabase?: KoraTenantDbStatus
  organisation?: { id: string; name: string }
}

export interface KoraTenantDbStatus {
  id: string
  homeId: string
  databaseName: string
  provisioningStatus: string
  createdAt: string
  updatedAt: string
}

export interface KoraUserSummary {
  id: string
  email: string
  firstName: string
  lastName: string
  isActive: boolean
  isPlatformAdmin: boolean
  createdAt: string
}

export interface KoraDockerService {
  id: string
  name: string
  image: string
  state: string
  status: string
  health: string | null
}

export interface KoraDockerRestartResult {
  ok: boolean
  restarted: number
  failed: number
}

export interface KoraDbHealthStatus {
  homeId?: string
  databaseName?: string
  provisioningStatus?: string
  status: 'ok' | 'error' | 'skipped'
  message?: string
}

export interface KoraHealthResult {
  status: 'ok' | 'degraded'
  platform: { status: 'ok' | 'error'; message?: string }
  tenants: KoraDbHealthStatus[]
  checkedAt: string
}
