import * as vscode from 'vscode'
import { MainlayerClient, MainlayerError } from './mainlayer'

const CACHE_KEY_PREFIX = 'mainlayer.entitlement.'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CachedEntitlement {
  entitled: boolean
  cachedAt: number
  plan?: string
  expiresAt?: string
}

export class EntitlementManager {
  private readonly client: MainlayerClient
  private readonly context: vscode.ExtensionContext
  /** In-memory cache used within the same session to avoid redundant calls. */
  private readonly sessionCache = new Map<string, CachedEntitlement>()

  constructor(client: MainlayerClient, context: vscode.ExtensionContext) {
    this.client = client
    this.context = context
  }

  /**
   * Returns true when the user is entitled to `feature`.
   *
   * Cache hierarchy:
   *  1. In-memory session cache (fastest, wiped on window reload)
   *  2. `ExtensionContext.globalState` (persists across sessions, 5-min TTL)
   *  3. Mainlayer API (live check, updates both caches)
   */
  async check(feature: string): Promise<boolean> {
    const sessionHit = this.getFromSessionCache(feature)
    if (sessionHit !== undefined) {
      return sessionHit
    }

    const globalHit = this.getFromGlobalState(feature)
    if (globalHit !== undefined) {
      this.sessionCache.set(feature, globalHit)
      return globalHit.entitled
    }

    return this.fetchAndCache(feature)
  }

  /**
   * Force a fresh check against the API, bypassing all caches.
   * Useful after the user completes a purchase.
   */
  async refresh(feature: string): Promise<boolean> {
    this.sessionCache.delete(feature)
    await this.clearGlobalState(feature)
    return this.fetchAndCache(feature)
  }

  /**
   * Clear all cached entitlements (e.g. when the user logs out).
   */
  async clearAll(): Promise<void> {
    this.sessionCache.clear()
    const keys = this.context.globalState.keys().filter((k) => k.startsWith(CACHE_KEY_PREFIX))
    await Promise.all(keys.map((k) => this.context.globalState.update(k, undefined)))
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async fetchAndCache(feature: string): Promise<boolean> {
    try {
      const response = await this.client.checkEntitlement(feature)
      const entry: CachedEntitlement = {
        entitled: response.entitled,
        cachedAt: Date.now(),
        plan: response.plan,
        expiresAt: response.expiresAt,
      }
      this.sessionCache.set(feature, entry)
      await this.context.globalState.update(this.globalStateKey(feature), entry)
      return response.entitled
    } catch (err) {
      if (err instanceof MainlayerError && err.statusCode === 401) {
        // Bad API key — surface a clear error and deny access
        void vscode.window.showErrorMessage(
          'Mainlayer: Invalid or missing API key. Please set myExtension.mainlayerApiKey in your settings.'
        )
        return false
      }
      // Network failures: fall back to a previously-stored global state value
      // even if it is expired, so offline users are not unnecessarily locked out.
      const stale = this.getFromGlobalState(feature, /* ignoreExpiry */ true)
      if (stale !== undefined) {
        return stale.entitled
      }
      // No stale data — deny access conservatively
      return false
    }
  }

  private getFromSessionCache(feature: string): boolean | undefined {
    const entry = this.sessionCache.get(feature)
    if (entry === undefined) {
      return undefined
    }
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      this.sessionCache.delete(feature)
      return undefined
    }
    return entry.entitled
  }

  private getFromGlobalState(
    feature: string,
    ignoreExpiry = false
  ): CachedEntitlement | undefined {
    const entry = this.context.globalState.get<CachedEntitlement>(this.globalStateKey(feature))
    if (entry === undefined) {
      return undefined
    }
    if (!ignoreExpiry && Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      return undefined
    }
    return entry
  }

  private async clearGlobalState(feature: string): Promise<void> {
    await this.context.globalState.update(this.globalStateKey(feature), undefined)
  }

  private globalStateKey(feature: string): string {
    return `${CACHE_KEY_PREFIX}${feature}`
  }
}
