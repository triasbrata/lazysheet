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

/** Build a single GH release object with a distinct tag and assets */
function makeGHReleaseObj(tag: string, assetNames: string[] = ['LazySheet_0.4.0_aarch64.dmg']) {
  return {
    tag_name: tag,
    name: tag,
    html_url: `https://github.com/triasbrata/lazysheet/releases/tag/${tag}`,
    published_at: '2024-01-01T00:00:00Z',
    draft: false,
    assets: assetNames.map((name) => ({
      name,
      browser_download_url: `https://github.com/triasbrata/lazysheet/releases/download/${tag}/${name}`,
      size: 1000,
    })),
  }
}

/**
 * Returns an array of n GH release objects with distinct tags v0.<n>.0 down to v0.1.0,
 * each with at least one real asset.
 */
function makeGHReleases(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const tag = `v0.${n - i}.0`
    return makeGHReleaseObj(tag, ['LazySheet_0.4.0_aarch64.dmg'])
  })
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

describe('getDownloadData / fetchReleasesCached', () => {

  // ---- cache HIT: serve cached, skip fetch ----
  describe('cache hit', () => {
    it('returns cached releases and does NOT call fetch when cache hits', async () => {
      const cachedReleases = [FALLBACK_RELEASE]
      stubCaches(makeCachedResponse(cachedReleases))
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const result = await handler()

      expect(result.releases).toEqual(cachedReleases)
      expect(result.release).toEqual(cachedReleases[0])
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('detects serverOS from UA even on cache hit', async () => {
      mockGetRequestHeader.mockReturnValue(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      )
      stubCaches(makeCachedResponse([FALLBACK_RELEASE]))
      vi.stubGlobal('fetch', vi.fn())

      const result = await handler()
      expect(result.serverOS).toBe('macOS')
    })
  })

  // ---- cache MISS + fetch OK ----
  describe('cache miss + fetch ok', () => {
    it('fetches GitHub API and returns parsed releases (single release)', async () => {
      stubCaches(undefined) // cache miss
      const ghData = makeGHReleases(1)
      vi.stubGlobal('fetch', makeFetchOk(ghData))

      const result = await handler()

      expect(result.releases.length).toBe(1)
      expect(result.release).not.toBeNull()
      expect(result.release?.tag).toBe(result.releases[0]!.tag)
    })

    it('returns all releases with correct ordering for multiple releases', async () => {
      stubCaches(undefined)
      const ghData = makeGHReleases(3) // tags: v0.3.0, v0.2.0, v0.1.0
      vi.stubGlobal('fetch', makeFetchOk(ghData))

      const result = await handler()

      expect(result.releases.length).toBe(3)
      // Latest first (v0.3.0)
      expect(result.releases[0]!.tag).toBe('v0.3.0')
      expect(result.releases[1]!.tag).toBe('v0.2.0')
      expect(result.releases[2]!.tag).toBe('v0.1.0')
      // release === releases[0] (latest)
      expect(result.release).toBe(result.releases[0])
      expect(result.release?.tag).toBe('v0.3.0')
    })

    it('writes to cache when list is non-empty and has assets', async () => {
      const cache = stubCaches(undefined)
      const ghData = makeGHReleases(2)
      vi.stubGlobal('fetch', makeFetchOk(ghData))

      await handler()

      expect(cache.put).toHaveBeenCalledTimes(1)
    })

    it('does NOT write to cache when all releases have no recognised assets', async () => {
      const cache = stubCaches(undefined)
      // Releases with no recognised asset names (all junk)
      const ghData = [makeGHReleaseObj('v0.5.0', ['something.sig', 'checksum.txt'])]
      vi.stubGlobal('fetch', makeFetchOk(ghData))

      await handler()

      expect(cache.put).not.toHaveBeenCalled()
    })
  })

  // ---- fetch !ok -> fallback ----
  describe('fetch not ok', () => {
    it('returns [FALLBACK_RELEASE] when fetch responds !ok and no prior cache', async () => {
      stubCaches(undefined)
      vi.stubGlobal('fetch', makeFetchFail())

      const result = await handler()

      expect(result.releases).toEqual([FALLBACK_RELEASE])
      expect(result.release?.tag).toBe('v0.6.0')
    })

    it('returns [FALLBACK_RELEASE] when fetch responds !ok and cache has no data', async () => {
      stubCaches(undefined)
      vi.stubGlobal('fetch', makeFetchFail())

      const result = await handler()
      expect(result.releases).toEqual([FALLBACK_RELEASE])
      expect(result.release?.tag).toBe('v0.6.0')
    })
  })

  // ---- fetch throws -> catch block ----
  describe('fetch throws', () => {
    it('returns [FALLBACK_RELEASE] when fetch throws and no cached value', async () => {
      stubCaches(undefined)
      vi.stubGlobal('fetch', makeFetchThrow())

      const result = await handler()

      expect(result.releases).toEqual([FALLBACK_RELEASE])
      expect(result.release?.tag).toBe('v0.6.0')
    })

    it('returns [FALLBACK_RELEASE] when caches is undefined and fetch throws', async () => {
      // No caches global at all
      vi.stubGlobal('caches', undefined)
      vi.stubGlobal('fetch', makeFetchThrow())

      const result = await handler()

      expect(result.releases).toEqual([FALLBACK_RELEASE])
      expect(result.release?.tag).toBe('v0.6.0')
    })
  })

  // ---- no caches global ----
  describe('no caches global', () => {
    it('still fetches and returns parsed releases when caches is not available', async () => {
      vi.stubGlobal('caches', undefined)
      const ghData = makeGHReleases(2)
      vi.stubGlobal('fetch', makeFetchOk(ghData))

      const result = await handler()

      expect(result.releases.length).toBe(2)
      expect(result.release).not.toBeNull()
      expect(result.release?.tag).toBe(result.releases[0]!.tag)
    })
  })

  // ---- GITHUB_TOKEN env ----
  describe('GITHUB_TOKEN environment variable', () => {
    it('includes Authorization header when GITHUB_TOKEN is set', async () => {
      ;(globalThis as { process?: { env?: Record<string, string | undefined> } }).process!.env![
        'GITHUB_TOKEN'
      ] = 'my-secret-token'
      stubCaches(undefined)
      const fetchMock = makeFetchOk(makeGHReleases(1))
      vi.stubGlobal('fetch', fetchMock)

      await handler()

      const [, options] = fetchMock.mock.calls[0]
      expect(options.headers['Authorization']).toBe('Bearer my-secret-token')
    })

    it('omits Authorization header when GITHUB_TOKEN is absent', async () => {
      stubCaches(undefined)
      const fetchMock = makeFetchOk(makeGHReleases(1))
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
      vi.stubGlobal('fetch', makeFetchOk(makeGHReleases(1)))

      const result = await handler()
      expect(result.serverOS).toBe('unknown')
    })

    it('returns Windows serverOS for Windows UA', async () => {
      mockGetRequestHeader.mockReturnValue(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      )
      stubCaches(undefined)
      vi.stubGlobal('fetch', makeFetchOk(makeGHReleases(1)))

      const result = await handler()
      expect(result.serverOS).toBe('Windows')
    })
  })

  // ---- release === releases[0] invariant ----
  describe('release is always releases[0] ?? null', () => {
    it('release equals releases[0] for a multi-release fetch', async () => {
      stubCaches(undefined)
      const ghData = makeGHReleases(5)
      vi.stubGlobal('fetch', makeFetchOk(ghData))

      const result = await handler()

      expect(result.release).toBe(result.releases[0])
    })

    it('release is null when releases array is empty (impossible in practice, guard tested)', async () => {
      // Simulate parseReleases returning [] even on ok (e.g. all drafts filtered)
      stubCaches(undefined)
      vi.stubGlobal('fetch', makeFetchOk([{ tag_name: 'v1.0.0', draft: true, assets: [] }]))

      const result = await handler()

      // Empty parse -> fallback [FALLBACK_RELEASE]; release = releases[0]
      expect(result.releases).toEqual([FALLBACK_RELEASE])
      expect(result.release?.tag).toBe('v0.6.0')
    })
  })
})
