export class ApiClient {
  private accessToken: string | null = null
  private refreshCallback: (() => Promise<string | null>) | null = null

  constructor(private readonly baseUrl: string) {}

  setAccessToken(token: string | null): void {
    this.accessToken = token
  }

  setRefreshCallback(cb: (() => Promise<string | null>) | null): void {
    this.refreshCallback = cb
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.accessToken) h['Authorization'] = `Bearer ${this.accessToken}`
    return h
  }

  async gql<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.baseUrl}/graphql`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ query, variables }),
    })

    if (res.status === 401 && this.refreshCallback) {
      const newToken = await this.refreshCallback()
      if (newToken) {
        this.accessToken = newToken
        return this.gql<T>(query, variables)
      }
    }

    const json = await res.json()
    if (json.errors?.length) {
      throw new Error(json.errors[0].message)
    }
    return json.data as T
  }

  async rest<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...this.headers(), ...(options.headers as Record<string, string> || {}) },
    })

    if (res.status === 401 && this.refreshCallback) {
      const newToken = await this.refreshCallback()
      if (newToken) {
        this.accessToken = newToken
        return this.rest<T>(path, options)
      }
    }

    if (!res.ok) {
      const text = await res.text()
      let msg = `${res.status}`
      try { msg = JSON.parse(text)?.error ?? msg } catch { /* */ }
      throw new Error(msg)
    }

    const text = await res.text()
    if (!text) return null as T
    return JSON.parse(text) as T
  }
}
