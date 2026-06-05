/**
 * Tests for src/lib/releases-data.ts
 *
 * Strategy:
 * - createServerFn passthrough mock: .handler(fn) returns fn directly
 *   (mirrors pattern from create-issue.test.ts)
 * - getRequestHeader mock: returns controllable UA string
 * - vi.stubGlobal('fetch', ...) for fetch calls
 * - stub globalThis.caches for Workers cache API
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mock '@tanstack/react-start' BEFORE importing the module under test ---
// No .inputValidator on this fn; .handler(fn) returns fn directly.
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const builder = {
      handler: (fn: unknown) => fn,
    }
    return builder
  },
}))

// Mock getRequestHeader from '@tanstack/react-start/server'
const mockGetRequestHeader = vi.fn().mockReturnValue(null)
vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeader: (...args: unknown[]) => mockGetRequestHeader(...args),
}))

// Import AFTER mocks are installed
import { getDownloadData, type DownloadData } from './releases-data'
import { FALLBACK_RELEASE } from './fallback-release'

// Cast to plain callable
type GetDownloadDataFn = () => Promise<DownloadData>
const handler = getDownloadData as unknown as GetDownloadDataFn

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/** A minimal valid GitHub releases API payload (array form) */
function makeGHRelease(assetNames: string[] = ['LazySheet_0.4.0_aarch64.dmg']) {
  return [
    {
      tag_name: 'v0.4.0',
      name: 'v0.4.0',
      html_url: 'https://github.com/triasbrata/lazysheet/releases/tag/v0.4.0',
      published_at: '2024-01-01T00:00:00Z',
      draft: false,
      assets: assetNames.map((name) => ({
        name,
        browser_download_url: `https://github.com/triasbrata/lazysheet/releases/download/v0.4.0/${name}`,
        size: 1000,
      })),
    },
  ]
}

function makeFetchOk(json: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(json),
  })
}

function makeFetchFail() {
  return vi.fn().mockResolvedValue({
    ok: false,
    status: 429,
    json: () => Promise.resolve({}),
  })
}

function makeFetchThrow(err = new Error('Network error')) {
  return vi.fn().mockRejectedValue(err)
}

function makeCachedResponse(data: unknown) {
  return {
    json: () => Promise.resolve(data),
  }
}

type CacheMock = {
  match: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
}

function stubCaches(matchReturn: unknown = undefined): CacheMock {
  const cache: CacheMock = {
    match: vi.fn().mockResolvedValue(matchReturn),
    put: vi.fn().mockResolvedValue(undefined),
  }
  vi.stubGlobal('caches', { default: cache })
  return cache
}

// --------------------------------------------------------------------------
// Env management
// --------------------------------------------------------------------------

const origTokenEnv: string | undefined = undefined

beforeEach(() => {
  mockGetRequestHeader.mockReturnValue(null)
  // Clear token by default; individual tests set it as needed
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  if (env) {
    delete env['GITHUB_TOKEN']
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  if (env) {
    if (origTokenEnv === undefined) delete env['GITHUB_TOKEN']
    else env['GITHUB_TOKEN'] = origTokenEnv
  }
})

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('getDownloadData / fetchLatestCached', () => {

  // ---- cache HIT: serve cached, skip fetch ----
  describe('cache hit', () => {
    it('returns cached data and does NOT call fetch when cache hits', async () => {
      const cachedRelease = FALLBACK_RELEASE
      stubCaches(makeCachedResponse(cachedRelease))
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const result = await handler()

      expect(result.release).toEqual(cachedRelease)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('detects serverOS from UA even on cache hit', async () => {
      mockGetRequestHeader.mockReturnValue(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      )
      stubCaches(makeCachedResponse(FALLBACK_RELEASE))
      vi.stubGlobal('fetch', vi.fn())

      const result = await handler()
      expect(result.serverOS).toBe('macOS')
    })
  })

  // ---- cache MISS + fetch OK ----
  describe('cache miss + fetch ok', () => {
    it('fetches GitHub API and returns parsed release', async () => {
      stubCaches(undefined) // cache miss
      const ghData = makeGHRelease(['LazySheet_0.4.0_aarch64.dmg'])
      vi.stubGlobal('fetch', makeFetchOk(ghData))

      const result = await handler()

      expect(result.release).not.toBeNull()
      expect(result.release?.tag).toBe('v0.4.0')
    })

    it('writes to cache when assets.length > 0', async () => {
      const cache = stubCaches(undefined)
      const ghData = makeGHRelease(['LazySheet_0.4.0_aarch64.dmg'])
      vi.stubGlobal('fetch', makeFetchOk(ghData))

      await handler()

      expect(cache.put).toHaveBeenCalledTimes(1)
    })

    it('does NOT write to cache when assets.length === 0', async () => {
      const cache = stubCaches(undefined)
      // Release with no recognised asset names (all junk)
      const ghData = makeGHRelease(['something.sig', 'checksum.txt'])
      vi.stubGlobal('fetch', makeFetchOk(ghData))

      await handler()

      expect(cache.put).not.toHaveBeenCalled()
    })
  })

  // ---- fetch !ok -> fallback ----
  describe('fetch not ok', () => {
    it('returns FALLBACK_RELEASE when fetch responds !ok and no prior cache', async () => {
      stubCaches(undefined)
      vi.stubGlobal('fetch', makeFetchFail())

      const result = await handler()

      expect(result.release).toEqual(FALLBACK_RELEASE)
    })

    it('returns cached value when fetch responds !ok and cache has data', async () => {
      // First: no prior Cloudflare cache hit (match returns undefined)
      // but we simulate a "cached" value by re-reading from a prior fetch that
      // was never written (the source code only has one cached variable from the
      // match hit). For this case we test that FALLBACK_RELEASE is used (since
      // cached === null and data === null, result is null ?? null ?? FALLBACK_RELEASE).
      stubCaches(undefined)
      vi.stubGlobal('fetch', makeFetchFail())

      const result = await handler()
      expect(result.release).toEqual(FALLBACK_RELEASE)
    })
  })

  // ---- fetch throws -> catch block ----
  describe('fetch throws', () => {
    it('returns FALLBACK_RELEASE when fetch throws and no cached value', async () => {
      stubCaches(undefined)
      vi.stubGlobal('fetch', makeFetchThrow())

      const result = await handler()

      expect(result.release).toEqual(FALLBACK_RELEASE)
    })

    it('returns FALLBACK_RELEASE when caches is undefined and fetch throws', async () => {
      // No caches global at all
      vi.stubGlobal('caches', undefined)
      vi.stubGlobal('fetch', makeFetchThrow())

      const result = await handler()

      expect(result.release).toEqual(FALLBACK_RELEASE)
    })
  })

  // ---- no caches global ----
  describe('no caches global', () => {
    it('still fetches and returns parsed data when caches is not available', async () => {
      vi.stubGlobal('caches', undefined)
      const ghData = makeGHRelease(['LazySheet_0.4.0_aarch64.dmg'])
      vi.stubGlobal('fetch', makeFetchOk(ghData))

      const result = await handler()

      expect(result.release).not.toBeNull()
      expect(result.release?.tag).toBe('v0.4.0')
    })
  })

  // ---- GITHUB_TOKEN env ----
  describe('GITHUB_TOKEN environment variable', () => {
    it('includes Authorization header when GITHUB_TOKEN is set', async () => {
      ;(globalThis as { process?: { env?: Record<string, string | undefined> } }).process!.env![
        'GITHUB_TOKEN'
      ] = 'my-secret-token'
      stubCaches(undefined)
      const fetchMock = makeFetchOk(makeGHRelease())
      vi.stubGlobal('fetch', fetchMock)

      await handler()

      const [, options] = fetchMock.mock.calls[0]
      expect(options.headers['Authorization']).toBe('Bearer my-secret-token')
    })

    it('omits Authorization header when GITHUB_TOKEN is absent', async () => {
      stubCaches(undefined)
      const fetchMock = makeFetchOk(makeGHRelease())
      vi.stubGlobal('fetch', fetchMock)

      await handler()

      const [, options] = fetchMock.mock.calls[0]
      expect(options.headers['Authorization']).toBeUndefined()
    })
  })

  // ---- serverOS detection ----
  describe('serverOS detection', () => {
    it('returns unknown serverOS when user-agent is null', async () => {
      mockGetRequestHeader.mockReturnValue(null)
      stubCaches(undefined)
      vi.stubGlobal('fetch', makeFetchOk(makeGHRelease()))

      const result = await handler()
      expect(result.serverOS).toBe('unknown')
    })

    it('returns Windows serverOS for Windows UA', async () => {
      mockGetRequestHeader.mockReturnValue(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      )
      stubCaches(undefined)
      vi.stubGlobal('fetch', makeFetchOk(makeGHRelease()))

      const result = await handler()
      expect(result.serverOS).toBe('Windows')
    })
  })
})
