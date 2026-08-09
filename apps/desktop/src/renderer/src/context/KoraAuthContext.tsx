import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { koraClient, koraAuthApi } from '@/lib/kora'
import type { KoraUser } from '@sixbyfive/kora-client'

interface KoraAuthContextValue {
  koraUser: KoraUser | null
  isKoraLoading: boolean
  koraLogin: (email: string, password: string) => Promise<void>
  koraLogout: () => void
}

const KoraAuthContext = createContext<KoraAuthContextValue | null>(null)
const REFRESH_KEY = 'kora_refresh'

export function KoraAuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [koraUser, setKoraUser] = useState<KoraUser | null>(null)
  const [isKoraLoading, setIsKoraLoading] = useState(true)

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

  useEffect(() => {
    const refreshToken = localStorage.getItem(REFRESH_KEY)
    if (!refreshToken) { setIsKoraLoading(false); return }

    koraAuthApi.refresh(refreshToken)
      .then(({ accessToken, refreshToken: newRefresh }) => {
        koraClient.setAccessToken(accessToken)
        localStorage.setItem(REFRESH_KEY, newRefresh)
        installRefresh()
        return koraAuthApi.me()
      })
      .then((me) => {
        if (!me.isPlatformAdmin) { doLogout(); return }
        setKoraUser(me)
      })
      .catch(() => localStorage.removeItem(REFRESH_KEY))
      .finally(() => setIsKoraLoading(false))
  }, [])

  async function koraLogin(email: string, password: string): Promise<void> {
    const { accessToken, refreshToken } = await koraAuthApi.login(email, password)
    koraClient.setAccessToken(accessToken)
    localStorage.setItem(REFRESH_KEY, refreshToken)
    installRefresh()
    const me = await koraAuthApi.me()
    if (!me.isPlatformAdmin) {
      doLogout()
      throw new Error('Kora platform admin access required.')
    }
    setKoraUser(me)
  }

  function koraLogout() { doLogout() }

  return (
    <KoraAuthContext.Provider value={{ koraUser, isKoraLoading, koraLogin, koraLogout }}>
      {children}
    </KoraAuthContext.Provider>
  )
}

export function useKoraAuth(): KoraAuthContextValue {
  const ctx = useContext(KoraAuthContext)
  if (!ctx) throw new Error('useKoraAuth must be used within KoraAuthProvider')
  return ctx
}
