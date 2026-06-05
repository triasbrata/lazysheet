// @vitest-environment node
// Tests the SSR guard branch: typeof window === 'undefined'
// In node environment, window is not defined, so we test the hook
// using mocked React hooks that call effects synchronously.
import { describe, expect, it, vi, afterEach } from 'vitest'

afterEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
})

describe('useGithubStars — SSR guard (typeof window === "undefined")', () => {
  it('returns initial state when window is undefined (effect exits early)', async () => {
    // Simulate hook execution by mocking useEffect to run the callback immediately
    const mockSetState = vi.fn()
    const useStateMock = vi.fn()
      .mockReturnValueOnce([null, mockSetState])  // stars
      .mockReturnValueOnce([true, mockSetState])   // loading

    let effectCallback: (() => void) | undefined
    const useEffectMock = vi.fn().mockImplementation((cb: () => void) => {
      effectCallback = cb
    })

    vi.doMock('react', async (importOriginal) => {
      const actual = await importOriginal<typeof import('react')>()
      return {
        ...actual,
        useState: useStateMock,
        useEffect: useEffectMock,
      }
    })

    const { useGithubStars } = await import('./use-github-stars')

    // Call the hook (in node environment, window is undefined)
    const result = useGithubStars()

    // Should return initial state
    expect(result.stars).toBe(null)
    expect(result.loading).toBe(true)

    // Manually invoke the captured effect callback
    expect(effectCallback).toBeDefined()
    effectCallback?.()

    // In node environment, typeof window === 'undefined', so effect exits early
    // setStars and setLoading should NOT be called
    expect(mockSetState).not.toHaveBeenCalled()
  })
})
