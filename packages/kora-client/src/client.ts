export class KoraApiClient {
  private accessToken: string | null = null
  private adminKey: string | null = null
  private refreshCallback: (() => Promise<string | null>) | null = null

  constructor(private baseUrl: string) {}

  setBaseUrl(url: string): void {
    this.baseUrl = url
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token
  }

  setAdminKey(key: string | null): void {
    this.adminKey = key
  }

  setRefreshCallback(cb: (() => Promise<string | null>) | null): void {
    this.refreshCallback = cb
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.accessToken) h['Authorization'] = `Bearer ${this.accessToken}`
    return h
  }

  async adminRest<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.adminKey) headers['x-admin-key'] = this.adminKey
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
    })
    if (!res.ok) {
      const text = await res.text()
      let msg = `${res.status}`
      try { msg = JSON.parse(text)?.message ?? msg } catch { /* */ }
      throw new Error(msg)
    }
    const text = await res.text()
    if (!text) return null as T
    return JSON.parse(text) as T
  }

  async rest<T = unknown>(
    path: string,
    options: RequestInit & { skipAuthRefresh?: boolean } = {}
  ): Promise<T> {
    const { skipAuthRefresh, ...fetchOptions } = options
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...fetchOptions,
      headers: { ...this.headers(), ...(fetchOptions.headers as Record<string, string> || {}) },
    })

    if (res.status === 401 && this.refreshCallback && !skipAuthRefresh) {
      const newToken = await this.refreshCallback()
      if (newToken) {
        this.accessToken = newToken
        return this.rest<T>(path, { ...options, skipAuthRefresh: true })
      }
    }

    if (!res.ok) {
      const text = await res.text()
      let msg = `${res.status}`
      try { msg = JSON.parse(text)?.message ?? msg } catch { /* */ }
      throw new Error(msg)
    }

    const text = await res.text()
    if (!text) return null as T
    return JSON.parse(text) as T
  }
}
