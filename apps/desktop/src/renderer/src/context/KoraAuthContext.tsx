import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { koraClient, koraAuthApi } from '@/lib/kora'
import type { KoraUser } from '@sixbyfive/kora-client'

interface KoraAuthContextValue {
  koraUser: KoraUser | null
  isKoraLoading: boolean
  koraError: string | null
  koraLogin: (email: string, password: string) => Promise<void>
  retryKoraAuth: () => Promise<void>
  koraLogout: () => void
}

const KoraAuthContext = createContext<KoraAuthContextValue | null>(null)
const REFRESH_KEY      = 'kora_refresh'
const VAULT_ID_KEY     = 'kora_vault_id'
const VAULT_EMAIL_KEY  = 'kora_email'

export function saveKoraServiceAccount(email: string, vaultId: string): void {
  localStorage.setItem(VAULT_EMAIL_KEY, email)
  localStorage.setItem(VAULT_ID_KEY, vaultId)
}

export function getKoraServiceAccount(): { email: string; vaultId: string } {
  return {
    email:   localStorage.getItem(VAULT_EMAIL_KEY) ?? '',
    vaultId: localStorage.getItem(VAULT_ID_KEY)    ?? '',
  }
}

export function KoraAuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [koraUser, setKoraUser] = useState<KoraUser | null>(null)
  const [isKoraLoading, setIsKoraLoading] = useState(true)
  const [koraError, setKoraError] = useState<string | null>(null)

  function doLogout() {
    const stored = localStorage.getItem(REFRESH_KEY)
    if (stored) koraAuthApi.logout(stored)
    koraClient.setAccessToken(null)
    koraClient.setRefreshCallback(null)
    localStorage.removeItem(REFRESH_KEY)
    setKoraUser(null)
  }

  function installRefresh() {
    koraClient.setRefreshCallback(async () => {
      const stored = localStorage.getItem(REFRESH_KEY)
      if (!stored) return null
      try {
        const { accessToken, refreshToken: newRefresh } = await koraAuthApi.refresh(stored)
        localStorage.setItem(REFRESH_KEY, newRefresh)
        return accessToken
      } catch {
        doLogout()
        return null
      }
    })
  }

  async function authenticateFromVault(): Promise<boolean> {
    const vaultAPI = (window as any).vault
    let vaultId = localStorage.getItem(VAULT_ID_KEY)
    let email   = localStorage.getItem(VAULT_EMAIL_KEY)

    const scan = async (): Promise<void> => {
      try {
        const entries: Array<{ id: string; name: string; username: string }> = await vaultAPI.list()
        const entry = entries?.find(e => e.name === 'Kora Service Account' || e.name === 'Kora')
        if (entry) { vaultId = entry.id; email = email || entry.username; saveKoraServiceAccount(email!, vaultId) }
      } catch { /* vault not ready */ }
    }

    if (!vaultId) await scan()
    if (!vaultId || !email) return false

    let password: string | undefined
    try { password = (await vaultAPI.getPassword(vaultId))?.password } catch { /* stale */ }
    if (!password) { await scan(); if (!vaultId) return false; try { password = (await vaultAPI.getPassword(vaultId))?.password } catch { return false } }
    if (!password) return false

    try {
      await koraLogin(email, password)
      return true
    } catch { return false }
  }

  async function attemptRefresh(): Promise<void> {
    const refreshToken = localStorage.getItem(REFRESH_KEY)
    if (refreshToken) {
      try {
        const { accessToken, refreshToken: newRefresh } = await koraAuthApi.refresh(refreshToken)
        koraClient.setAccessToken(accessToken)
        localStorage.setItem(REFRESH_KEY, newRefresh)
        installRefresh()
        const me = await koraAuthApi.me()
        if (!me.isPlatformAdmin) {
          doLogout()
          setKoraError('This account does not have Kora platform admin access.')
          return
        }
        setKoraUser(me)
        setKoraError(null)
        return
      } catch {
        localStorage.removeItem(REFRESH_KEY)
      }
    }
    // No valid refresh token — try vault service account
    await authenticateFromVault()
  }

  useEffect(() => {
    attemptRefresh().finally(() => setIsKoraLoading(false))
  }, [])

  async function koraLogin(email: string, password: string): Promise<void> {
    try {
      const { accessToken, refreshToken } = await koraAuthApi.login(email, password)
      koraClient.setAccessToken(accessToken)
      localStorage.setItem(REFRESH_KEY, refreshToken)
      installRefresh()
      const me = await koraAuthApi.me()
      if (!me.isPlatformAdmin) {
        doLogout()
        setKoraError('This account does not have Kora platform admin access.')
        throw new Error('Kora platform admin access required.')
      }
      setKoraUser(me)
      setKoraError(null)
    } catch (err) {
      const msg = (err as Error).message || 'Failed to connect to Kora.'
      setKoraError(msg)
      throw err
    }
  }

  async function retryKoraAuth(): Promise<void> {
    setIsKoraLoading(true)
    await attemptRefresh()
    setIsKoraLoading(false)
  }

  function koraLogout() { doLogout() }

  return (
    <KoraAuthContext.Provider value={{ koraUser, isKoraLoading, koraError, koraLogin, retryKoraAuth, koraLogout }}>
      {children}
    </KoraAuthContext.Provider>
  )
}

export function useKoraAuth(): KoraAuthContextValue {
  const ctx = useContext(KoraAuthContext)
  if (!ctx) throw new Error('useKoraAuth must be used within KoraAuthProvider')
  return ctx
}

