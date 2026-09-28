export class ApiClient {
  private accessToken: string | null = null
  private adminApiKey: string | null = null
  private refreshCallback: (() => Promise<string | null>) | null = null
  // Called when an x-admin-key-only endpoint (docker-admin, mail-admin,
  // catalog-admin) gets a 401 — these never carry a JWT, so the normal
  // refresh-token flow can't fix them. Should resolve with a fresh key
  // (after re-prompting the user) or null to give up.
  private adminKeyRejectedCallback: (() => Promise<string | null>) | null = null

  constructor(private readonly baseUrl: string) {}

  setAdminApiKey(key: string | null): void {
    this.adminApiKey = key
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token
  }

  setRefreshCallback(cb: (() => Promise<string | null>) | null): void {
    this.refreshCallback = cb
  }

  setAdminKeyRejectedCallback(cb: (() => Promise<string | null>) | null): void {
    this.adminKeyRejectedCallback = cb
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      // Tells auth-service to return tokens in the response body (not HttpOnly
      // cookies) — same flag the mobile app uses. Without this the gateway proxy
      // returns only { user } and the admin never receives an accessToken.
      'X-Client-Type': 'mobile',
    }
    if (this.accessToken) h['Authorization'] = `Bearer ${this.accessToken}`
    return h
  }

  async gql<T = unknown>(query: string, variables?: Record<string, unknown>, _isRetry = false): Promise<T> {
    const extraHeaders: Record<string, string> = {}
    if (this.adminApiKey) extraHeaders['x-admin-key'] = this.adminApiKey
    const res = await fetch(`${this.baseUrl}/graphql`, {
      method: 'POST',
      headers: { ...this.headers(), ...extraHeaders },
      body: JSON.stringify({ query, variables }),
    })

    if (res.status === 401 && this.refreshCallback && !_isRetry) {
      const newToken = await this.refreshCallback()
      if (newToken) {
        this.accessToken = newToken
        return this.gql<T>(query, variables, true)
      }
    }

    const json = await res.json()
    if (json.errors?.length) {
      throw new Error(json.errors[0].message)
    }
    return json.data as T
  }

  async rest<T = unknown>(
    path: string,
    options: RequestInit & { skipAuthRefresh?: boolean; adminKeyOnly?: boolean; _adminKeyRetried?: boolean } = {}
  ): Promise<T> {
    const { skipAuthRefresh, adminKeyOnly, _adminKeyRetried, ...fetchOptions } = options
    const extraHeaders: Record<string, string> = {}
    if (this.adminApiKey) extraHeaders['x-admin-key'] = this.adminApiKey
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...fetchOptions,
      headers: { ...this.headers(), ...extraHeaders, ...(fetchOptions.headers as Record<string, string> || {}) },
    })

    if (res.status === 401 && this.refreshCallback && !skipAuthRefresh) {
      const newToken = await this.refreshCallback()
      if (newToken) {
        this.accessToken = newToken
        // Always skip auth refresh on the retry — if a fresh token still gets a
        // 401 the endpoint genuinely rejected the request (e.g. wrong admin key).
        return this.rest<T>(path, { ...options, skipAuthRefresh: true })
      }
    }

    // adminKeyOnly endpoints (docker-admin, mail-admin, catalog-admin) are
    // protected by x-admin-key, not a JWT — a 401 here means the admin key
    // itself was rejected, so re-prompt for it instead of leaving the user
    // stuck on a bare "Unauthorized". Gated on adminKeyOnly specifically
    // (not skipAuthRefresh) because auth.ts also uses skipAuthRefresh for
    // login/refresh/me/logout, where a 401 means something else entirely.
    if (res.status === 401 && adminKeyOnly && this.adminKeyRejectedCallback && !_adminKeyRetried) {
      const newKey = await this.adminKeyRejectedCallback()
      if (newKey) {
        this.adminApiKey = newKey
        return this.rest<T>(path, { ...options, _adminKeyRetried: true })
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

  async restBlob(path: string, _isRetry = false): Promise<Blob> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: this.headers(),
    })

    if (res.status === 401 && this.refreshCallback && !_isRetry) {
      const newToken = await this.refreshCallback()
      if (newToken) {
        this.accessToken = newToken
        return this.restBlob(path, true)
      }
    }

    if (!res.ok) throw new Error(`${res.status}`)
    return res.blob()
  }
}
