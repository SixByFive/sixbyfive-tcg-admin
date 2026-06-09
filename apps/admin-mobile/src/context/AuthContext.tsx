import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useContext, useEffect, useState } from 'react'
import { apiClient, authApi } from '../lib/api'
import type { AuthUser } from '@tcg-admin/types'

const KEYS = { access: 'auth:accessToken', refresh: 'auth:refreshToken' }

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]         = useState<AuthUser | null>(null)
  const [isLoading, setLoading] = useState(true)

  const doLogout = async () => {
    await authApi.logout().catch(() => {})
    await AsyncStorage.multiRemove([KEYS.access, KEYS.refresh])
    apiClient.setAccessToken(null)
    apiClient.setRefreshCallback(null)
    setUser(null)
  }

  const setupRefresh = (refreshToken: string) => {
    apiClient.setRefreshCallback(async () => {
      try {
        const res = await authApi.refresh(refreshToken)
        await AsyncStorage.setItem(KEYS.access, res.accessToken)
        if (res.refreshToken) {
          await AsyncStorage.setItem(KEYS.refresh, res.refreshToken)
          setupRefresh(res.refreshToken)
        }
        apiClient.setAccessToken(res.accessToken)
        return res.accessToken
      } catch {
        await doLogout()
        return null
      }
    })
  }

  // Restore session on startup
  useEffect(() => {
    const restore = async () => {
      try {
        const [accessToken, refreshToken] = await AsyncStorage.multiGet([KEYS.access, KEYS.refresh])
        const at = accessToken[1]
        const rt = refreshToken[1]
        if (!at || !rt) return
        apiClient.setAccessToken(at)
        setupRefresh(rt)
        const me = await authApi.me()
        setUser(me)
      } catch {
        await doLogout()
      } finally {
        setLoading(false)
      }
    }
    restore()
  }, [])

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password)
    await AsyncStorage.setItem(KEYS.access, res.accessToken)
    await AsyncStorage.setItem(KEYS.refresh, res.refreshToken)
    apiClient.setAccessToken(res.accessToken)
    setupRefresh(res.refreshToken)
    const me = res.user ?? await authApi.me()
    setUser(me)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout: doLogout }}>
      {children}
    </AuthContext.Provider>
  )
}
