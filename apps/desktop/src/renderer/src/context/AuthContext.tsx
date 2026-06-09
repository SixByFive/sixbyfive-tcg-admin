import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { apiClient, authApi } from '@/lib/api'
import type { AuthUser } from '@tcg-admin/types'

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)
const REFRESH_KEY = 'tcga_refresh'

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  function doLogout() {
    apiClient.setAccessToken(null)
    apiClient.setRefreshCallback(null)
    localStorage.removeItem(REFRESH_KEY)
    setUser(null)
  }

  function installRefresh() {
    apiClient.setRefreshCallback(async () => {
      const stored = localStorage.getItem(REFRESH_KEY)
      if (!stored) return null
      try {
        const { accessToken, refreshToken: newRefresh } = await authApi.refresh(stored)
        localStorage.setItem(REFRESH_KEY, newRefresh)
        return accessToken
      } catch {
        doLogout()
        return null
      }
    })
  }

  useEffect(() => {
    const refreshToken = localStorage.getItem(REFRESH_KEY)
    if (!refreshToken) { setIsLoading(false); return }

    authApi.refresh(refreshToken)
      .then(({ accessToken, refreshToken: newRefresh, user: refreshUser }) => {
        apiClient.setAccessToken(accessToken)
        localStorage.setItem(REFRESH_KEY, newRefresh)
        installRefresh()
        // Use the user bundled in the refresh response, or fall back to /auth/me
        if (refreshUser) { setUser(refreshUser); return null }
        return authApi.me()
      })
      .then((me) => { if (me) setUser(me) })
      .catch(() => localStorage.removeItem(REFRESH_KEY))
      .finally(() => setIsLoading(false))
  }, [])

  async function login(email: string, password: string): Promise<void> {
    const { accessToken, refreshToken, user: loginUser } = await authApi.login(email, password)
    apiClient.setAccessToken(accessToken)
    localStorage.setItem(REFRESH_KEY, refreshToken)
    installRefresh()
    // auth-service bundles the user in the login response body (X-Client-Type: mobile),
    // so we skip a second /auth/me round-trip when possible.
    const me = loginUser ?? await authApi.me()
    if (!me.isAdmin && me.role !== 'ADMIN' && me.role !== 'admin') {
      doLogout()
      throw new Error('Admin access required.')
    }
    setUser(me)
  }

  function logout() { doLogout() }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

if (import.meta.hot) import.meta.hot.decline()
