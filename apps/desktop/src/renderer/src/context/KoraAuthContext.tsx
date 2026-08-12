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
const REFRESH_KEY = 'kora_refresh'

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

  async function attemptRefresh(): Promise<void> {
    const refreshToken = localStorage.getItem(REFRESH_KEY)
    if (!refreshToken) return
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
    } catch (err) {
      localStorage.removeItem(REFRESH_KEY)
      setKoraError((err as Error).message || 'Failed to connect to Kora.')
    }
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

