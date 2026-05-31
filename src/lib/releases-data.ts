import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { detectOSFromUA, type OS } from './os'
import { parseRelease, GH_API_LATEST, type ReleaseData } from './releases'

export interface DownloadData {
  release: ReleaseData | null
  serverOS: OS
}

export const getDownloadData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DownloadData> => {
    const ua = getRequestHeader('user-agent')
    const serverOS = detectOSFromUA(ua)
    const release = await fetchLatestCached()
    return { release, serverOS }
  },
)

async function fetchLatestCached(): Promise<ReleaseData | null> {
  // v2: bump to invalidate entries poisoned with `null` by the old code path.
  const cacheKey = new Request('https://lazysheet.internal/latest-release-v2')

  // Guard: `caches` is a Workers/browser global; undefined in dev (Node.js)
  const g = globalThis as unknown as {
    caches?: {
      default: {
        match(r: Request): Promise<Response | undefined>
        put(r: Request, res: Response): Promise<void>
      }
    }
  }
  const cache = g.caches?.default

  // Last-known-good cache. Only successful parses are ever written here, so a
  // hit is always usable. We still re-fetch below to refresh, but the cached
  // value is the fallback if GitHub is rate-limiting or down.
  let cached: ReleaseData | null = null
  if (cache) {
    const hit = await cache.match(cacheKey)
    if (hit) {
      cached = (await hit.json()) as ReleaseData | null
      // Fresh hit (within max-age): serve as-is, skip the network.
      return cached
    }
  }

  try {
    // GitHub rate-limits unauthenticated requests per egress IP; Workers share
    // IPs, so an optional token keeps us under the limit. Do NOT cacheEverything
    // — that would edge-cache 403/429 errors for an hour.
    const token =
      (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
        ?.GITHUB_TOKEN

    const res = await fetch(GH_API_LATEST, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'lazysheet-landing',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cf: { cacheTtl: 3600 },
    } as RequestInit & { cf?: Record<string, unknown> })

    const data: ReleaseData | null = res.ok ? parseRelease(await res.json()) : null

    // Only persist real releases. Never poison the cache with null/failures —
    // that would hide a published release until the entry expires.
    if (cache && data && data.assets.length > 0) {
      await cache.put(
        cacheKey,
        new Response(JSON.stringify(data), {
          headers: {
            'content-type': 'application/json',
            'cache-control': 'public, max-age=3600',
          },
        }),
      )
    }

    // On a failed/empty fetch, fall back to last-known-good (null if none).
    return data ?? cached
  } catch {
    return cached
  }
}
