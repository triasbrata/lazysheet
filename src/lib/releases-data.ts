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
  const cacheKey = new Request('https://lazysheet.internal/latest-release')

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

  if (cache) {
    const hit = await cache.match(cacheKey)
    if (hit) return (await hit.json()) as ReleaseData | null
  }

  try {
    const res = await fetch(GH_API_LATEST, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'lazysheet-landing',
      },
      cf: { cacheTtl: 3600, cacheEverything: true },
    } as RequestInit & { cf?: Record<string, unknown> })

    const data: ReleaseData | null = res.ok ? parseRelease(await res.json()) : null

    if (cache) {
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

    return data
  } catch {
    return null
  }
}
