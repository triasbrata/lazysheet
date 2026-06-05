import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { detectOSFromUA, type OS } from './os'
import { parseReleases, GH_API_RELEASES, type ReleaseData } from './releases'
import { FALLBACK_RELEASE } from './fallback-release'

export interface DownloadData {
  releases: ReleaseData[]
  release: ReleaseData | null
  serverOS: OS
}

export const getDownloadData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DownloadData> => {
    const ua = getRequestHeader('user-agent')
    const serverOS = detectOSFromUA(ua)
    const releases = await fetchReleasesCached()
    return { releases, release: releases[0] ?? null, serverOS }
  },
)

async function fetchReleasesCached(): Promise<ReleaseData[]> {
  const cacheKey = new Request('https://lazysheet.internal/releases-v1')

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
  let cached: ReleaseData[] | null = null
  if (cache) {
    const hit = await cache.match(cacheKey)
    if (hit) {
      cached = (await hit.json()) as ReleaseData[]
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

    const res = await fetch(GH_API_RELEASES, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'lazysheet-landing',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cf: { cacheTtl: 3600 },
    } as RequestInit & { cf?: Record<string, unknown> })

    const data: ReleaseData[] = res.ok ? parseReleases(await res.json()) : []

    // Only persist real releases with assets. Never poison the cache with
    // empty/failures — that would hide published releases until the entry expires.
    const hasAssets = data.length > 0 && data.some((r) => r.assets.length > 0)
    if (cache && hasAssets) {
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

    // On a failed/empty fetch, fall back to last-known-good, then to the
    // bundled snapshot. The page must always render direct download links so
    // users are never bounced to the GitHub releases page.
    return (data && data.length) ? data : (cached ?? [FALLBACK_RELEASE])
  } catch {
    return cached ?? [FALLBACK_RELEASE]
  }
}
