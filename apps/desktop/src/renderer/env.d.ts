/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_ADMIN_API_KEY: string
  readonly VITE_NTFY_TOPIC: string
  readonly VITE_NTFY_SERVER: string
}

interface Window {
  electron: {
    ipcRenderer: {
      invoke(channel: string, ...args: unknown[]): Promise<unknown>
      on(channel: string, func: (...args: unknown[]) => void): () => void
      once(channel: string, func: (...args: unknown[]) => void): void
      send(channel: string, ...args: unknown[]): void
      removeListener(channel: string, func: (...args: unknown[]) => void): void
      removeAllListeners(channel: string): void
    }
  }
}
