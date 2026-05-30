export type OS = 'macOS' | 'Windows' | 'Linux' | 'unknown'
export type Arch = 'arm64' | 'x64' | 'universal'

// Server + client safe (pure string parse). Order matters: mobile before desktop.
export function detectOSFromUA(ua: string | null | undefined): OS {
  if (!ua) return 'unknown'
  if (/android/i.test(ua)) return 'unknown'
  if (/iphone|ipad|ipod/i.test(ua)) return 'unknown'
  if (/windows/i.test(ua)) return 'Windows'
  if (/mac os x|macintosh/i.test(ua)) return 'macOS'
  if (/linux|x11/i.test(ua)) return 'Linux'
  return 'unknown'
}

// Minimal local types for userAgentData (NOT in TS DOM lib)
interface UADataValues {
  architecture?: string
  bitness?: string
  platform?: string
}
interface NavigatorUAData {
  platform?: string
  getHighEntropyValues(hints: string[]): Promise<UADataValues>
}

// Client-only. Guards `navigator` (returns {os:'unknown',arch:null} if absent / SSR).
// Uses navigator.userAgentData when present (Chromium), else falls back to UA-string.
export async function detectClientOSArch(): Promise<{ os: OS; arch: Arch | null }> {
  try {
    if (typeof navigator === 'undefined') {
      return { os: 'unknown', arch: null }
    }

    const nav = navigator as Navigator & { userAgentData?: NavigatorUAData }

    if (nav.userAgentData) {
      const high = await nav.userAgentData.getHighEntropyValues([
        'architecture',
        'bitness',
        'platform',
      ])

      const platformStr = high.platform ?? nav.userAgentData.platform ?? ''
      let os: OS
      if (/mac/i.test(platformStr)) {
        os = 'macOS'
      } else if (/win/i.test(platformStr)) {
        os = 'Windows'
      } else if (/linux/i.test(platformStr)) {
        os = 'Linux'
      } else if (/android/i.test(platformStr)) {
        os = 'unknown'
      } else {
        os = detectOSFromUA(navigator.userAgent)
      }

      let arch: Arch | null = null
      if (high.architecture === 'arm') {
        arch = 'arm64'
      } else if (high.architecture === 'x86' && high.bitness === '64') {
        arch = 'x64'
      }

      return { os, arch }
    }

    // Fallback: UA-string only, no arch info
    return { os: detectOSFromUA(navigator.userAgent), arch: null }
  } catch {
    return {
      os: typeof navigator !== 'undefined' ? detectOSFromUA(navigator.userAgent) : 'unknown',
      arch: null,
    }
  }
}
