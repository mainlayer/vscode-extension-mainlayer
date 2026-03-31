import * as https from 'https'
import * as http from 'http'

export interface EntitlementResponse {
  entitled: boolean
  feature: string
  plan?: string
  expiresAt?: string
}

export interface CheckoutSession {
  sessionId: string
  checkoutUrl: string
  feature: string
}

export interface PricingTier {
  id: string
  name: string
  price: number
  currency: string
  interval: 'month' | 'year' | 'one_time'
  features: string[]
}

export interface MainlayerClientOptions {
  baseUrl?: string
  timeoutMs?: number
}

export class MainlayerError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'MainlayerError'
  }
}

export class MainlayerClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(apiKey: string, options: MainlayerClientOptions = {}) {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new MainlayerError('A valid Mainlayer API key is required')
    }
    this.apiKey = apiKey
    this.baseUrl = options.baseUrl ?? 'https://api.mainlayer.xyz'
    this.timeoutMs = options.timeoutMs ?? 10_000
  }

  /**
   * Check whether the current API key is entitled to a given feature.
   */
  async checkEntitlement(feature: string): Promise<EntitlementResponse> {
    if (!feature || typeof feature !== 'string') {
      throw new MainlayerError('Feature name must be a non-empty string')
    }

    const data = await this.request<EntitlementResponse>(
      'GET',
      `/v1/entitlements/check?feature=${encodeURIComponent(feature)}`
    )
    return data
  }

  /**
   * Create a checkout session so the user can purchase access.
   */
  async createCheckoutSession(
    feature: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<CheckoutSession> {
    if (!feature) {
      throw new MainlayerError('Feature name is required')
    }

    const data = await this.request<CheckoutSession>('POST', '/v1/checkout/sessions', {
      feature,
      success_url: successUrl,
      cancel_url: cancelUrl,
    })
    return data
  }

  /**
   * Retrieve available pricing tiers for the extension.
   */
  async getPricingTiers(): Promise<PricingTier[]> {
    const data = await this.request<{ tiers: PricingTier[] }>('GET', '/v1/pricing/tiers')
    return data.tiers ?? []
  }

  /**
   * Validate that the provided API key is well-formed and active.
   */
  async validateApiKey(): Promise<{ valid: boolean; message?: string }> {
    try {
      await this.request<unknown>('GET', '/v1/auth/validate')
      return { valid: true }
    } catch (err) {
      if (err instanceof MainlayerError && err.statusCode === 401) {
        return { valid: false, message: 'Invalid or expired API key' }
      }
      throw err
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private request<T>(method: string, path: string, body?: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const url = new URL(path, this.baseUrl)
      const isHttps = url.protocol === 'https:'
      const transport = isHttps ? https : http

      const bodyJson = body !== undefined ? JSON.stringify(body) : undefined
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      }
      if (bodyJson !== undefined) {
        headers['Content-Type'] = 'application/json'
        headers['Content-Length'] = String(Buffer.byteLength(bodyJson))
      }

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
        timeout: this.timeoutMs,
      }

      const req = transport.request(options, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          let parsed: unknown
          try {
            parsed = JSON.parse(raw)
          } catch {
            reject(
              new MainlayerError(
                `Non-JSON response from Mainlayer API (status ${res.statusCode})`
              )
            )
            return
          }

          const status = res.statusCode ?? 0
          if (status >= 200 && status < 300) {
            resolve(parsed as T)
          } else {
            const msg =
              (parsed as Record<string, unknown>)?.message ??
              (parsed as Record<string, unknown>)?.error ??
              `Request failed with status ${status}`
            reject(new MainlayerError(String(msg), status))
          }
        })
        res.on('error', reject)
      })

      req.on('timeout', () => {
        req.destroy()
        reject(new MainlayerError(`Request timed out after ${this.timeoutMs}ms`))
      })
      req.on('error', (err) => reject(new MainlayerError(err.message)))

      if (bodyJson !== undefined) {
        req.write(bodyJson)
      }
      req.end()
    })
  }
}
