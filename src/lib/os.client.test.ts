// @vitest-environment happy-dom
/**
 * Tests for detectClientOSArch (client-side, requires navigator).
 * Uses happy-dom so navigator is available; the node-env detectOSFromUA
 * tests remain in os.test.ts untouched.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { detectClientOSArch } from './os'

// --------------------------------------------------------------------------
// Helpers to control navigator.userAgentData
// --------------------------------------------------------------------------

type UADataValues = { platform?: string; architecture?: string; bitness?: string }

function stubUserAgentData(values: UADataValues, ua = 'test-ua') {
  Object.defineProperty(globalThis.navigator, 'userAgent', {
    value: ua,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(globalThis.navigator, 'userAgentData', {
    value: {
      platform: values.platform ?? '',
      getHighEntropyValues: vi.fn().mockResolvedValue(values),
    },
    writable: true,
    configurable: true,
  })
}

function clearUserAgentData() {
  Object.defineProperty(globalThis.navigator, 'userAgentData', {
    value: undefined,
    writable: true,
    configurable: true,
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// --------------------------------------------------------------------------
// detectClientOSArch - navigator.userAgentData path
// --------------------------------------------------------------------------

describe('detectClientOSArch — userAgentData path', () => {
  describe('platform detection', () => {
    it('returns macOS for platform "macOS"', async () => {
      stubUserAgentData({ platform: 'macOS', architecture: 'arm', bitness: '64' })
      const result = await detectClientOSArch()
      expect(result.os).toBe('macOS')
      expect(result.arch).toBe('arm64')
    })

    it('returns Windows for platform "Windows"', async () => {
      stubUserAgentData({ platform: 'Windows', architecture: 'x86', bitness: '64' })
      const result = await detectClientOSArch()
      expect(result.os).toBe('Windows')
      expect(result.arch).toBe('x64')
    })

    it('returns Linux for platform "Linux"', async () => {
      stubUserAgentData({ platform: 'Linux', architecture: 'x86', bitness: '64' })
      const result = await detectClientOSArch()
      expect(result.os).toBe('Linux')
    })

    it('returns unknown for platform "Android"', async () => {
      stubUserAgentData({ platform: 'Android', architecture: 'arm', bitness: '64' })
      const result = await detectClientOSArch()
      expect(result.os).toBe('unknown')
    })

    it('falls back to detectOSFromUA when platform is unrecognised', async () => {
      // Unknown platform -> falls back to navigator.userAgent
      stubUserAgentData(
        { platform: 'ChromeOS', architecture: 'x86', bitness: '64' },
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      )
      const result = await detectClientOSArch()
      expect(result.os).toBe('macOS')
    })

    it('uses nav.userAgentData.platform when high.platform is undefined', async () => {
      // getHighEntropyValues returns no platform field -> falls through to nav.userAgentData.platform
      Object.defineProperty(globalThis.navigator, 'userAgent', {
        value: 'test-ua',
        writable: true,
        configurable: true,
      })
      Object.defineProperty(globalThis.navigator, 'userAgentData', {
        value: {
          platform: 'macOS', // set on the object itself
          getHighEntropyValues: vi.fn().mockResolvedValue({
            architecture: 'arm',
            bitness: '64',
            // platform deliberately omitted -> high.platform is undefined
          }),
        },
        writable: true,
        configurable: true,
      })
      const result = await detectClientOSArch()
      expect(result.os).toBe('macOS')
      expect(result.arch).toBe('arm64')
    })

    it('falls back to empty string when both high.platform and nav.userAgentData.platform are undefined', async () => {
      // Both platform fields absent -> platformStr = '' -> falls through to detectOSFromUA(navigator.userAgent)
      Object.defineProperty(globalThis.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        writable: true,
        configurable: true,
      })
      Object.defineProperty(globalThis.navigator, 'userAgentData', {
        value: {
          platform: undefined, // explicitly undefined
          getHighEntropyValues: vi.fn().mockResolvedValue({
            architecture: 'x86',
            bitness: '64',
            // platform deliberately omitted
          }),
        },
        writable: true,
        configurable: true,
      })
      const result = await detectClientOSArch()
      // platformStr = '' -> regex tests fail -> falls back to detectOSFromUA(navigator.userAgent)
      expect(result.os).toBe('Windows')
    })
  })

  describe('architecture detection', () => {
    it('returns arm64 for architecture "arm"', async () => {
      stubUserAgentData({ platform: 'macOS', architecture: 'arm', bitness: '' })
      const result = await detectClientOSArch()
      expect(result.arch).toBe('arm64')
    })

    it('returns x64 for architecture "x86" + bitness "64"', async () => {
      stubUserAgentData({ platform: 'Windows', architecture: 'x86', bitness: '64' })
      const result = await detectClientOSArch()
      expect(result.arch).toBe('x64')
    })

    it('returns null for architecture "x86" + bitness "32" (32-bit)', async () => {
      stubUserAgentData({ platform: 'Windows', architecture: 'x86', bitness: '32' })
      const result = await detectClientOSArch()
      expect(result.arch).toBeNull()
    })

    it('returns null when architecture is absent', async () => {
      stubUserAgentData({ platform: 'Linux' })
      const result = await detectClientOSArch()
      expect(result.arch).toBeNull()
    })
  })
})

// --------------------------------------------------------------------------
// detectClientOSArch - no userAgentData (UA-string fallback)
// --------------------------------------------------------------------------

describe('detectClientOSArch — no userAgentData (UA fallback)', () => {
  beforeEach(() => clearUserAgentData())

  it('falls back to UA-string and returns arch null', async () => {
    Object.defineProperty(globalThis.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      writable: true,
      configurable: true,
    })
    const result = await detectClientOSArch()
    expect(result.os).toBe('macOS')
    expect(result.arch).toBeNull()
  })

  it('returns unknown + null arch for unrecognised UA', async () => {
    Object.defineProperty(globalThis.navigator, 'userAgent', {
      value: 'curl/8.6.0',
      writable: true,
      configurable: true,
    })
    const result = await detectClientOSArch()
    expect(result.os).toBe('unknown')
    expect(result.arch).toBeNull()
  })
})

// --------------------------------------------------------------------------
// detectClientOSArch - getHighEntropyValues throws (catch block)
// --------------------------------------------------------------------------

describe('detectClientOSArch — getHighEntropyValues throws', () => {
  it('returns os from UA fallback and arch null on rejection', async () => {
    Object.defineProperty(globalThis.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      writable: true,
      configurable: true,
    })
    Object.defineProperty(globalThis.navigator, 'userAgentData', {
      value: {
        platform: 'Windows',
        getHighEntropyValues: vi.fn().mockRejectedValue(new Error('Permission denied')),
      },
      writable: true,
      configurable: true,
    })
    const result = await detectClientOSArch()
    expect(result.os).toBe('Windows')
    expect(result.arch).toBeNull()
  })

  it('returns unknown + null arch when catch fires and navigator is gone', async () => {
    // Stub navigator away inside the catch path by making getHighEntropyValues throw
    // and simultaneously having userAgent return an unrecognised string
    Object.defineProperty(globalThis.navigator, 'userAgent', {
      value: 'some-unknown-bot',
      writable: true,
      configurable: true,
    })
    Object.defineProperty(globalThis.navigator, 'userAgentData', {
      value: {
        platform: '',
        getHighEntropyValues: vi.fn().mockRejectedValue(new Error('fail')),
      },
      writable: true,
      configurable: true,
    })
    const result = await detectClientOSArch()
    expect(result.os).toBe('unknown')
    expect(result.arch).toBeNull()
  })
})

// --------------------------------------------------------------------------
// detectClientOSArch - SSR / navigator undefined guard
// --------------------------------------------------------------------------

describe('detectClientOSArch — SSR guard (navigator undefined)', () => {
  it('returns {os:"unknown", arch:null} when navigator is not defined', async () => {
    // Save original navigator
    const originalNavigator = globalThis.navigator
    // Delete navigator to simulate SSR
    // @ts-expect-error intentionally removing navigator
    delete globalThis.navigator
    try {
      const result = await detectClientOSArch()
      expect(result).toEqual({ os: 'unknown', arch: null })
    } finally {
      // Restore navigator
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true,
      })
    }
  })
})
