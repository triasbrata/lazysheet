// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor, cleanup, act } from '@testing-library/react'

import { formatStars, useGithubStars } from './use-github-stars'

const CACHE_KEY = 'lazysheet:gh-stars'
const TTL_MS = 3600_000
const NOW = 1_700_000_000_000

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

// ---------------------------------------------------------------------------
// formatStars
// ---------------------------------------------------------------------------

describe('formatStars', () => {
  it('returns string for values below 1000', () => {
    expect(formatStars(999)).toBe('999')
    expect(formatStars(0)).toBe('0')
  })

  it('formats 1000 as "1k" (strips trailing .0)', () => {
    expect(formatStars(1000)).toBe('1k')
  })

  it('formats 1500 as "1.5k"', () => {
    expect(formatStars(1500)).toBe('1.5k')
  })

  it('formats 2000 as "2k" (strips trailing .0)', () => {
    expect(formatStars(2000)).toBe('2k')
  })
})

// ---------------------------------------------------------------------------
// useGithubStars
// ---------------------------------------------------------------------------

describe('useGithubStars', () => {
  beforeEach(() => {
    localStorage.clear()
    // Spy on Date.now so we can control the current time without fake timers
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  function seedCache(value: number, ts: number) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ value, ts }))
  }

  function stubFetch(ok: boolean, stargazers_count?: number) {
    const mockFetch = vi.fn().mockResolvedValue({
      ok,
      json: async () => ({ stargazers_count }),
    })
    vi.stubGlobal('fetch', mockFetch)
    return mockFetch
  }

  function throwingFetch() {
    const mockFetch = vi.fn().mockRejectedValue(new Error('network error'))
    vi.stubGlobal('fetch', mockFetch)
    return mockFetch
  }

  it('returns cached value and does NOT fetch when cache is fresh', async () => {
    seedCache(77, NOW - 100) // well within TTL
    const mockFetch = stubFetch(true, 99)

    const { result } = renderHook(() => useGithubStars())

    // Cache hit: loading should immediately become false with cached value
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.stars).toBe(77)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches when no cache and resolves stars + writes to localStorage', async () => {
    stubFetch(true, 42)

    const { result } = renderHook(() => useGithubStars())

    await waitFor(() => expect(result.current.stars).toBe(42))
    expect(result.current.loading).toBe(false)

    const stored = JSON.parse(localStorage.getItem(CACHE_KEY)!)
    expect(stored.value).toBe(42)
    expect(stored.ts).toBe(NOW)
  })

  it('fetches again when cache is stale (older than TTL)', async () => {
    seedCache(55, NOW - TTL_MS - 1) // stale
    const mockFetch = stubFetch(true, 88)

    const { result } = renderHook(() => useGithubStars())

    await waitFor(() => expect(result.current.stars).toBe(88))
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('uses stale cached value when fetch returns !ok', async () => {
    seedCache(33, NOW - TTL_MS - 1) // stale but present
    stubFetch(false)

    const { result } = renderHook(() => useGithubStars())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.stars).toBe(33)
  })

  it('returns null when fetch returns !ok and no cache exists', async () => {
    stubFetch(false)

    const { result } = renderHook(() => useGithubStars())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.stars).toBe(null)
  })

  it('uses stale cached value when fetch throws', async () => {
    seedCache(22, NOW - TTL_MS - 1) // stale but present
    throwingFetch()

    const { result } = renderHook(() => useGithubStars())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.stars).toBe(22)
  })

  it('returns null when fetch throws and no cache exists', async () => {
    throwingFetch()

    const { result } = renderHook(() => useGithubStars())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.stars).toBe(null)
  })

  it('treats malformed cache entry (wrong types) as a cache miss and fetches', async () => {
    // Seed cache with wrong types so the type-guard branch false-arm is covered
    localStorage.setItem(CACHE_KEY, JSON.stringify({ value: 'not-a-number', ts: 'also-wrong' }))
    const mockFetch = stubFetch(true, 99)

    const { result } = renderHook(() => useGithubStars())

    await waitFor(() => expect(result.current.stars).toBe(99))
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('treats corrupt JSON in localStorage as a cache miss and fetches', async () => {
    // Seed cache with invalid JSON to trigger the parse-error catch branch
    localStorage.setItem(CACHE_KEY, '{invalid json}')
    const mockFetch = stubFetch(true, 55)

    const { result } = renderHook(() => useGithubStars())

    await waitFor(() => expect(result.current.stars).toBe(55))
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

})
