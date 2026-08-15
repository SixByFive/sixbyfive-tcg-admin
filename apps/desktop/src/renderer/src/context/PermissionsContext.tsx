import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useAuth } from './AuthContext'

interface PermissionsContextValue {
  permissions:  string[]
  isLoaded:     boolean
  can:          (perm: string) => boolean
  canAny:       (...perms: string[]) => boolean
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null)

const api = (window as any).permissions as {
  forEmail: (email: string) => Promise<string[]>
}

// can('tcg.financial') → true if permissions includes 'tcg.financial' OR '*'
// Note: 'tcg' does NOT imply 'tcg.financial' — sub-permissions must be explicit.
// Always-on tools (status, vault, snippets, ssh, release) don't need a can() check.
function check(permissions: string[], perm: string): boolean {
  return permissions.includes('*') || permissions.includes(perm)
}

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState<string[]>(['*'])
  const [isLoaded, setIsLoaded]       = useState(false)

  useEffect(() => {
    if (!user?.email) {
      setPermissions(['*'])
      setIsLoaded(false)
      return
    }
    setIsLoaded(false)
    api.forEmail(user.email)
      .then(perms => setPermissions(Array.isArray(perms) ? perms : ['*']))
      .catch(() => setPermissions(['*']))
      .finally(() => setIsLoaded(true))
  }, [user?.email])

  return (
    <PermissionsContext.Provider value={{
      permissions,
      isLoaded,
      can:    (perm)    => check(permissions, perm),
      canAny: (...perms) => perms.some(p => check(permissions, p)),
    }}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext)
  if (!ctx) throw new Error('usePermissions must be used within PermissionsProvider')
  return ctx
}
