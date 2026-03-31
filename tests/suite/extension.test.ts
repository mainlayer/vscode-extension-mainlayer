/**
 * VS Code Extension — Mainlayer Integration
 * Test suite (Mocha + @vscode/test-electron)
 *
 * Pattern: London-School TDD — dependencies are stubbed/mocked so tests run
 * without hitting the real Mainlayer API.
 */

import * as assert from 'assert'
import * as vscode from 'vscode'

// ── Minimal in-memory stubs ──────────────────────────────────────────────────

class FakeGlobalState implements Partial<vscode.Memento> {
  private store = new Map<string, unknown>()

  get<T>(key: string): T | undefined
  get<T>(key: string, defaultValue: T): T
  get<T>(key: string, defaultValue?: T): T | undefined {
    return (this.store.has(key) ? (this.store.get(key) as T) : defaultValue) as T | undefined
  }

  async update(key: string, value: unknown): Promise<void> {
    if (value === undefined) {
      this.store.delete(key)
    } else {
      this.store.set(key, value)
    }
  }

  keys(): readonly string[] {
    return [...this.store.keys()]
  }
}

function makeFakeContext(globalState?: FakeGlobalState): vscode.ExtensionContext {
  const state = globalState ?? new FakeGlobalState()
  return {
    subscriptions: [],
    globalState: state as unknown as vscode.Memento & { setKeysForSync(keys: readonly string[]): void },
  } as unknown as vscode.ExtensionContext
}

// ── Import units under test ──────────────────────────────────────────────────

// Dynamic imports keep this file portable when compiled alongside vscode types.
// We import after the stubs above so we can inject them.

import { MainlayerClient, MainlayerError } from '../../src/mainlayer'
import { EntitlementManager } from '../../src/entitlement'

// ── Helper to produce a mock client ─────────────────────────────────────────

function makeClient(entitled: boolean, throwError?: MainlayerError | Error): MainlayerClient {
  const client = Object.create(MainlayerClient.prototype) as MainlayerClient
  // Override the private `request` method via prototype shimming
  ;(client as unknown as Record<string, unknown>).checkEntitlement = async (
    _feature: string
  ) => {
    if (throwError) {
      throw throwError
    }
    return { entitled, feature: _feature, plan: entitled ? 'pro' : undefined }
  }
  ;(client as unknown as Record<string, unknown>).getPricingTiers = async () => []
  return client
}

// ── Tests ────────────────────────────────────────────────────────────────────

suite('MainlayerClient', function () {
  test('1. constructor throws when apiKey is empty', function () {
    assert.throws(
      () => new MainlayerClient(''),
      (err: Error) => err instanceof MainlayerError && /API key/i.test(err.message)
    )
  })

  test('2. constructor throws when apiKey is not a string', function () {
    assert.throws(
      () => new MainlayerClient(null as unknown as string),
      (err: Error) => err instanceof MainlayerError
    )
  })

  test('3. constructor succeeds with a valid API key', function () {
    assert.doesNotThrow(() => new MainlayerClient('ml_test_key'))
  })

  test('4. MainlayerError carries statusCode and code', function () {
    const err = new MainlayerError('Not found', 404, 'NOT_FOUND')
    assert.strictEqual(err.statusCode, 404)
    assert.strictEqual(err.code, 'NOT_FOUND')
    assert.strictEqual(err.name, 'MainlayerError')
  })

  test('5. MainlayerError is an instance of Error', function () {
    const err = new MainlayerError('oops')
    assert.ok(err instanceof Error)
    assert.ok(err instanceof MainlayerError)
  })
})

suite('EntitlementManager', function () {
  test('6. check() returns true when API reports entitled', async function () {
    const client = makeClient(true)
    const mgr = new EntitlementManager(client, makeFakeContext())
    const result = await mgr.check('premium')
    assert.strictEqual(result, true)
  })

  test('7. check() returns false when API reports not entitled', async function () {
    const client = makeClient(false)
    const mgr = new EntitlementManager(client, makeFakeContext())
    const result = await mgr.check('premium')
    assert.strictEqual(result, false)
  })

  test('8. check() uses in-memory session cache on second call', async function () {
    let callCount = 0
    const client = makeClient(true)
    const originalCheck = (client as unknown as Record<string, unknown>).checkEntitlement as Function
    ;(client as unknown as Record<string, unknown>).checkEntitlement = async (f: string) => {
      callCount++
      return originalCheck(f)
    }

    const mgr = new EntitlementManager(client, makeFakeContext())
    await mgr.check('premium')
    await mgr.check('premium')

    assert.strictEqual(callCount, 1, 'Second call should hit session cache, not the API')
  })

  test('9. check() persists result to globalState', async function () {
    const globalState = new FakeGlobalState()
    const client = makeClient(true)
    const mgr = new EntitlementManager(client, makeFakeContext(globalState))
    await mgr.check('premium')

    const keys = globalState.keys()
    assert.ok(
      keys.some((k) => k.includes('premium')),
      'Expected a globalState key containing "premium"'
    )
  })

  test('10. refresh() bypasses session cache and re-fetches', async function () {
    let callCount = 0
    const client = makeClient(true)
    ;(client as unknown as Record<string, unknown>).checkEntitlement = async (f: string) => {
      callCount++
      return { entitled: true, feature: f }
    }

    const mgr = new EntitlementManager(client, makeFakeContext())
    await mgr.check('premium')   // populates cache
    await mgr.refresh('premium') // should bypass cache

    assert.strictEqual(callCount, 2)
  })

  test('11. clearAll() removes all cached data', async function () {
    const globalState = new FakeGlobalState()
    const client = makeClient(true)
    const mgr = new EntitlementManager(client, makeFakeContext(globalState))
    await mgr.check('premium')
    await mgr.clearAll()

    const keys = globalState.keys()
    assert.strictEqual(keys.length, 0, 'globalState should be empty after clearAll()')
  })

  test('12. check() returns false when API throws a non-401 error and no stale data exists', async function () {
    const client = makeClient(false, new MainlayerError('Service unavailable', 503))
    const mgr = new EntitlementManager(client, makeFakeContext())
    const result = await mgr.check('premium')
    assert.strictEqual(result, false)
  })

  test('13. check() falls back to stale globalState data on network error', async function () {
    const globalState = new FakeGlobalState()
    // Seed stale data manually (cachedAt = 0 to simulate expiry)
    await globalState.update('mainlayer.entitlement.premium', {
      entitled: true,
      cachedAt: 0,
    })

    const client = makeClient(false, new MainlayerError('Network error', 503))
    const mgr = new EntitlementManager(client, makeFakeContext(globalState))
    const result = await mgr.check('premium')

    // Should return stale `true` rather than false
    assert.strictEqual(result, true)
  })

  test('14. check() for different features are cached independently', async function () {
    let callCount = 0
    const client = makeClient(true)
    ;(client as unknown as Record<string, unknown>).checkEntitlement = async (f: string) => {
      callCount++
      return { entitled: true, feature: f }
    }

    const mgr = new EntitlementManager(client, makeFakeContext())
    await mgr.check('featureA')
    await mgr.check('featureB')
    await mgr.check('featureA') // cache hit

    assert.strictEqual(callCount, 2, 'featureA and featureB should be cached separately')
  })

  test('15. refresh() updates globalState with new value', async function () {
    const globalState = new FakeGlobalState()
    let entitled = true
    const client = makeClient(entitled)
    ;(client as unknown as Record<string, unknown>).checkEntitlement = async (f: string) => ({
      entitled,
      feature: f,
    })

    const mgr = new EntitlementManager(client, makeFakeContext(globalState))
    await mgr.check('premium') // entitled = true

    entitled = false
    await mgr.refresh('premium') // should store false

    const stored = globalState.get<{ entitled: boolean }>('mainlayer.entitlement.premium')
    assert.strictEqual(stored?.entitled, false)
  })

  test('16. multiple clearAll() calls do not throw', async function () {
    const mgr = new EntitlementManager(makeClient(true), makeFakeContext())
    await mgr.clearAll()
    await assert.doesNotReject(async () => mgr.clearAll())
  })

  test('17. check() with 401 error returns false without throwing', async function () {
    const err = new MainlayerError('Unauthorized', 401)
    const client = makeClient(false, err)
    const mgr = new EntitlementManager(client, makeFakeContext())
    const result = await mgr.check('premium')
    assert.strictEqual(result, false)
  })
})
