import { describe, expect, it, vi, beforeEach } from 'vitest'

// Sentinel router returned by our createTanStackRouter spy
const SENTINEL_ROUTER = { __sentinel: true } as const

// Mock @tanstack/react-router so createRouter (aliased createTanStackRouter
// in router.tsx) is a spy returning the sentinel.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createRouter: vi.fn(() => SENTINEL_ROUTER),
  }
})

// The routeTree.gen module just needs to export a routeTree symbol
vi.mock('./routeTree.gen', () => ({
  routeTree: { __routeTree: true },
}))

import { getRouter } from '#/router'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'

beforeEach(() => {
  vi.mocked(createTanStackRouter).mockClear()
})

describe('getRouter', () => {
  it('calls createTanStackRouter exactly once', () => {
    getRouter()
    expect(createTanStackRouter).toHaveBeenCalledTimes(1)
  })

  it('passes the routeTree to createTanStackRouter', () => {
    getRouter()
    const [options] = vi.mocked(createTanStackRouter).mock.calls[0]!
    expect(options).toMatchObject({ routeTree: { __routeTree: true } })
  })

  it('passes defaultPreload: "intent"', () => {
    getRouter()
    const [options] = vi.mocked(createTanStackRouter).mock.calls[0]!
    expect(options).toMatchObject({ defaultPreload: 'intent' })
  })

  it('passes scrollRestoration: true', () => {
    getRouter()
    const [options] = vi.mocked(createTanStackRouter).mock.calls[0]!
    expect(options).toMatchObject({ scrollRestoration: true })
  })

  it('passes defaultPreloadStaleTime: 0', () => {
    getRouter()
    const [options] = vi.mocked(createTanStackRouter).mock.calls[0]!
    expect(options).toMatchObject({ defaultPreloadStaleTime: 0 })
  })

  it('returns the router created by createTanStackRouter', () => {
    const router = getRouter()
    expect(router).toBe(SENTINEL_ROUTER)
  })
})
