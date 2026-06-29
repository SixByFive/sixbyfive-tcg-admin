import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { apiClient, saveAdminApiKey } from '@/lib/api'

interface AdminKeyContextValue {
  /** True while the re-entry prompt is open, for callers that want to react to it. */
  isPrompting: boolean
}

const AdminKeyContext = createContext<AdminKeyContextValue>({ isPrompting: false })

export function useAdminKeyPrompt(): AdminKeyContextValue {
  return useContext(AdminKeyContext)
}

export function AdminKeyProvider({ children }: { children: ReactNode }): JSX.Element {
  const [isPrompting, setIsPrompting] = useState(false)
  const [value, setValue] = useState('')
  const resolveRef = useRef<((key: string | null) => void) | null>(null)

  useEffect(() => {
    apiClient.setAdminKeyRejectedCallback(() => {
      setValue('')
      setIsPrompting(true)
      return new Promise<string | null>((resolve) => {
        resolveRef.current = resolve
      })
    })
    return () => apiClient.setAdminKeyRejectedCallback(null)
  }, [])

  function finish(key: string | null): void {
    setIsPrompting(false)
    resolveRef.current?.(key)
    resolveRef.current = null
  }

  function submit(e: React.FormEvent): void {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    saveAdminApiKey(trimmed)
    finish(trimmed)
  }

  return (
    <AdminKeyContext.Provider value={{ isPrompting }}>
      {children}
      {isPrompting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg">
            <h2 className="text-sm font-semibold text-foreground">Admin key rejected</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The stored admin key was rejected by the server. Enter the current key to keep going —
              this isn't a login issue, just the shared admin key.
            </p>
            <form onSubmit={submit} className="mt-3 space-y-3">
              <input
                autoFocus
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Admin API key"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => finish(null)}
                  className="rounded-md bg-accent px-3 py-2 text-sm text-foreground hover:bg-accent/80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  Save & retry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminKeyContext.Provider>
  )
}
