import { useState, useEffect } from 'react'

const REPO = 'triasbrata/lazysheet'
const CACHE_KEY = 'lazysheet:gh-stars'
const TTL_MS = 3600_000

interface CacheEntry {
  value: number
  ts: number
}

export interface GithubStarsState {
  stars: number | null
  loading: boolean
}

export function formatStars(n: number): string {
  if (n >= 1000) {
    const formatted = (n / 1000).toFixed(1)
    return formatted.replace(/\.0$/, '') + 'k'
  }
  return String(n)
}

export function useGithubStars(): GithubStarsState {
  const [stars, setStars] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    let cached: CacheEntry | null = null

    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as CacheEntry
        if (typeof parsed.value === 'number' && typeof parsed.ts === 'number') {
          cached = parsed
          if (Date.now() - parsed.ts < TTL_MS) {
            setStars(parsed.value)
            setLoading(false)
            return
          }
        }
      }
    } catch {
      // ignore parse errors
    }

    const fetchStars = async () => {
      try {
        const res = await fetch(`https://api.github.com/repos/${REPO}`, {
          headers: { Accept: 'application/vnd.github+json' },
        })

        if (!res.ok) {
          setStars(cached ? cached.value : null)
          setLoading(false)
          return
        }

        const json = await res.json()
        const n = json.stargazers_count as number
        setStars(n)

        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ value: n, ts: Date.now() }))
        } catch {
          // ignore storage errors
        }
      } catch {
        setStars(cached ? cached.value : null)
      } finally {
        setLoading(false)
      }
    }

    void fetchStars()
  }, [])

  return { stars, loading }
}
