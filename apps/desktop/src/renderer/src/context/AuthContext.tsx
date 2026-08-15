import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { AuthUser } from '@tcg-admin/types'
import { supabase } from '@/lib/supabase'
import { apiClient, authApi } from '@/lib/api'

interface AuthContextValue {
  user:      AuthUser | null
  isLoading: boolean
  login:     (email: string, password: string) => Promise<void>
  logout:    () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const TCG_REFRESH_KEY = 'tcga_tcg_refresh'

// Keys for the optional vault-based service account (used as a fallback)
const TCG_VAULT_ID_KEY = 'tcga_tcg_vault_id'
const TCG_EMAIL_KEY    = 'tcga_tcg_email'

function setupRefreshCallback(): void {
  apiClient.setRefreshCallback(async () => {
    const stored = localStorage.getItem(TCG_REFRESH_KEY)
    if (!stored) return null
    try {
      const { accessToken, refreshToken } = await authApi.refresh(stored)
      localStorage.setItem(TCG_REFRESH_KEY, refreshToken)
      return accessToken
    } catch {
      localStorage.removeItem(TCG_REFRESH_KEY)
      return null
    }
  })
}

async function loginTcgDirect(email: string, password: string): Promise<void> {
  const { accessToken, refreshToken } = await authApi.login(email, password)
  apiClient.setAccessToken(accessToken)
  localStorage.setItem(TCG_REFRESH_KEY, refreshToken)
  setupRefreshCallback()
}

// Fallback: authenticate via saved vault service-account credentials.
// Looks up by stored vault ID first; if not set, scans vault for the
// "TCG Service Account" entry so manual vault setup also works.
export async function authenticateTcg(): Promise<void> {
  let vaultId = localStorage.getItem(TCG_VAULT_ID_KEY)
  let email   = localStorage.getItem(TCG_EMAIL_KEY)

  if (!vaultId) {
    try {
      const vaultAPI = (window as any).vault
      const entries: Array<{ id: string; name: string; username: string }> = await vaultAPI.list()
      const entry = entries?.find(e => e.name === 'TCG Service Account')
      if (entry) {
        vaultId = entry.id
        email   = email || entry.username
        saveTcgServiceAccount(email!, vaultId)
      }
    } catch { /* vault not ready */ }
  }

  if (!vaultId || !email) return

  try {
    const vaultAPI = (window as any).vault
    const { password } = await vaultAPI.getPassword(vaultId)
    if (!password) return
    await loginTcgDirect(email, password)
  } catch (err) {
    console.warn('[auth] TCG service account login failed:', err)
  }
}

async function restoreTcgSession(): Promise<void> {
  const stored = localStorage.getItem(TCG_REFRESH_KEY)
  if (stored) {
    try {
      const { accessToken, refreshToken } = await authApi.refresh(stored)
      apiClient.setAccessToken(accessToken)
      localStorage.setItem(TCG_REFRESH_KEY, refreshToken)
      setupRefreshCallback()
      return
    } catch {
      localStorage.removeItem(TCG_REFRESH_KEY)
    }
  }
  // No stored token — try vault service account
  await authenticateTcg()
}

function mapSupabaseUser(sbUser: { id: string; email?: string; user_metadata?: Record<string, string> }): AuthUser {
  return {
    id:       sbUser.id,
    email:    sbUser.email ?? '',
    username: sbUser.user_metadata?.username ?? sbUser.email ?? '',
  }
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser]           = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(mapSupabaseUser(session.user))
        await restoreTcgSession()
      }
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null)
        apiClient.setAccessToken(null)
        apiClient.setRefreshCallback(null)
        localStorage.removeItem(TCG_REFRESH_KEY)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function login(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)

    // Authenticate with TCG backend using the same credentials
    try {
      await loginTcgDirect(email, password)
    } catch {
      // TCG password differs from Supabase — fall back to vault service account
      await authenticateTcg()
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    apiClient.setAccessToken(null)
    apiClient.setRefreshCallback(null)
    localStorage.removeItem(TCG_REFRESH_KEY)
  }

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

export function saveTcgServiceAccount(email: string, vaultId: string): void {
  localStorage.setItem(TCG_EMAIL_KEY, email)
  localStorage.setItem(TCG_VAULT_ID_KEY, vaultId)
}

export function getTcgServiceAccount(): { email: string; vaultId: string } {
  return {
    email:   localStorage.getItem(TCG_EMAIL_KEY)    ?? '',
    vaultId: localStorage.getItem(TCG_VAULT_ID_KEY) ?? '',
  }
}

if (import.meta.hot) import.meta.hot.decline()
