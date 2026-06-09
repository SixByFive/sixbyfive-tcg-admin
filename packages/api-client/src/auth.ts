import type { ApiClient } from './client'
import type { AuthUser } from '@tcg-admin/types'

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  // auth-service returns the user in the login/refresh body when X-Client-Type: mobile
  user?: AuthUser
}

export function createAuthApi(client: ApiClient) {
  return {
    async login(email: string, password: string): Promise<LoginResponse> {
      return client.rest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuthRefresh: true,
      })
    },

    async refresh(refreshToken: string): Promise<LoginResponse> {
      // Must skip the refresh callback — calling refresh() from inside the
      // refresh callback would cause infinite recursion and trigger doLogout().
      return client.rest<LoginResponse>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
        skipAuthRefresh: true,
      })
    },

    async me(): Promise<AuthUser> {
      // auth-service returns { user: {...} } — unwrap the envelope
      const raw = await client.rest<{ user: AuthUser } | AuthUser>('/auth/me', { skipAuthRefresh: true })
      return (raw as { user: AuthUser }).user ?? (raw as AuthUser)
    },

    async logout(): Promise<void> {
      await client.rest('/auth/logout', { method: 'POST', skipAuthRefresh: true }).catch(() => { /* ignore */ })
    },
  }
}
