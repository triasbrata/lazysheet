// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useMediaQuery } from './use-media-query'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useMediaQuery', () => {
  it('returns false when window.matchMedia is undefined', () => {
    // Remove matchMedia from window
    const original = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useMediaQuery('(min-width: 1280px)'))
    expect(result.current).toBe(false)

    // Restore
    Object.defineProperty(window, 'matchMedia', {
      value: original,
      writable: true,
      configurable: true,
    })
  })

  it('returns initial mql.matches = true', () => {
    let capturedHandler: ((e: MediaQueryListEvent) => void) | null = null

    const mql = {
      matches: true,
      addEventListener: vi.fn((_event: string, handler: (e: MediaQueryListEvent) => void) => {
        capturedHandler = handler
      }),
      removeEventListener: vi.fn(),
    }

    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn(() => mql),
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useMediaQuery('(min-width: 1280px)'))
    expect(result.current).toBe(true)
    // Suppress unused warning — capturedHandler is captured for next test
    void capturedHandler
  })

  it('updates matches when change event fires', () => {
    let capturedHandler: ((e: MediaQueryListEvent) => void) | null = null

    const mql = {
      matches: false,
      addEventListener: vi.fn((_event: string, handler: (e: MediaQueryListEvent) => void) => {
        capturedHandler = handler
      }),
      removeEventListener: vi.fn(),
    }

    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn(() => mql),
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useMediaQuery('(min-width: 1280px)'))
    expect(result.current).toBe(false)

    // Fire the change event
    act(() => {
      capturedHandler?.({ matches: true } as MediaQueryListEvent)
    })
    expect(result.current).toBe(true)

    // Fire again back to false
    act(() => {
      capturedHandler?.({ matches: false } as MediaQueryListEvent)
    })
    expect(result.current).toBe(false)
  })

  it('removes event listener on unmount', () => {
    const removeEventListener = vi.fn()
    const mql = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener,
    }

    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn(() => mql),
      writable: true,
      configurable: true,
    })

    const { unmount } = renderHook(() => useMediaQuery('(min-width: 1280px)'))
    expect(removeEventListener).not.toHaveBeenCalled()

    unmount()
    expect(removeEventListener).toHaveBeenCalledTimes(1)
  })
})
