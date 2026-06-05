// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, cleanup, act } from '@testing-library/react'

// Hoisted handlers so individual tests can control when the promise settles or rejects
const mockDetect = vi.hoisted(() => ({
  resolve: null as ((v: { os: string; arch: string | null }) => void) | null,
  reject: null as ((e: unknown) => void) | null,
  makePromise: () =>
    new Promise<{ os: string; arch: string | null }>((res, rej) => {
      mockDetect.resolve = res
      mockDetect.reject = rej
    }),
}))

// Mock detectClientOSArch with a controllable promise
vi.mock('#/lib/os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#/lib/os')>()
  return {
    ...actual,
    detectClientOSArch: () => mockDetect.makePromise(),
  }
})

import { useClientOSArch } from '#/features/download/use-os-arch'

afterEach(cleanup)

describe('useClientOSArch', () => {
  it('returns the initial value synchronously', async () => {
    const { result } = renderHook(() =>
      useClientOSArch({ os: 'macOS', arch: 'universal' }),
    )
    expect(result.current.os).toBe('macOS')
    expect(result.current.arch).toBe('universal')
    // Resolve to avoid open promise leak
    act(() => { mockDetect.resolve?.({ os: 'unknown', arch: null }) })
  })

  it('updates to the detected OS/arch when detectClientOSArch resolves with a non-unknown result (setValue fires)', async () => {
    const { result } = renderHook(() =>
      useClientOSArch({ os: 'unknown', arch: null }),
    )

    // Initially the initial value
    expect(result.current.os).toBe('unknown')

    // Resolve the promise with a non-unknown OS — triggers setValue
    act(() => { mockDetect.resolve?.({ os: 'Windows', arch: 'x64' }) })

    // Wait for the state to update
    await waitFor(() => {
      expect(result.current.os).toBe('Windows')
    })
    expect(result.current.arch).toBe('x64')
  })

  it('does not update when detected os/arch matches the initial value (prev returned)', async () => {
    // detectClientOSArch returns Windows/x64 but initial is also Windows/x64
    const { result } = renderHook(() =>
      useClientOSArch({ os: 'Windows', arch: 'x64' }),
    )

    expect(result.current.os).toBe('Windows')
    expect(result.current.arch).toBe('x64')

    // Resolve with same values — setState callback returns prev, no re-render
    act(() => { mockDetect.resolve?.({ os: 'Windows', arch: 'x64' }) })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(result.current.os).toBe('Windows')
    expect(result.current.arch).toBe('x64')
  })

  it('does not update state after unmount (cancelled=true branch)', async () => {
    const { unmount } = renderHook(() =>
      useClientOSArch({ os: 'unknown', arch: null }),
    )

    // Unmount before the promise resolves — sets cancelled=true inside the effect
    unmount()

    // Now resolve the promise — the `if (cancelled) return` branch should be taken
    act(() => { mockDetect.resolve?.({ os: 'Windows', arch: 'x64' }) })

    // Allow any pending microtasks to settle — no state update error should occur
    await new Promise((resolve) => setTimeout(resolve, 20))
  })

  it('handles detectClientOSArch rejection gracefully (.catch branch)', async () => {
    const { result } = renderHook(() =>
      useClientOSArch({ os: 'macOS', arch: 'universal' }),
    )

    // Initial value unchanged
    expect(result.current.os).toBe('macOS')

    // Reject the promise — hits the `.catch(() => {})` branch in the hook
    act(() => { mockDetect.reject?.(new Error('detection failed')) })

    // Allow microtasks to settle — state should remain unchanged
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(result.current.os).toBe('macOS')
    expect(result.current.arch).toBe('universal')
  })
})
