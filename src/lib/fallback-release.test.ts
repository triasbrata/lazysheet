import { describe, it, expect } from 'vitest'
import { FALLBACK_RELEASE } from './fallback-release'
import { groupByOS } from './releases'

describe('FALLBACK_RELEASE', () => {
  it('has a tag and all 5 assets classify', () => {
    expect(FALLBACK_RELEASE.tag).toBe('v0.6.0')
    expect(FALLBACK_RELEASE.assets).toHaveLength(5)
  })

  it('every asset has a direct download URL (not the releases page)', () => {
    for (const a of FALLBACK_RELEASE.assets) {
      expect(a.url).toMatch(
        /^https:\/\/github\.com\/triasbrata\/lazysheet\/releases\/download\/v0\.6\.0\//,
      )
      expect(a.url.endsWith(a.name)).toBe(true)
    }
  })

  it('macOS asset is the aarch64 dmg with the exact direct URL', () => {
    const mac = FALLBACK_RELEASE.assets.find((a) => a.os === 'macOS')
    expect(mac).toBeDefined()
    expect(mac).toMatchObject({ os: 'macOS', arch: 'arm64', format: 'dmg' })
    expect(mac!.url).toBe(
      'https://github.com/triasbrata/lazysheet/releases/download/v0.6.0/LazySheet_0.6.0_aarch64.dmg',
    )
  })

  it('covers all three OSes so no card falls back to a GitHub page link', () => {
    const groups = groupByOS(FALLBACK_RELEASE.assets)
    expect(groups.macOS.length).toBeGreaterThan(0)
    expect(groups.Windows.length).toBeGreaterThan(0)
    expect(groups.Linux.length).toBeGreaterThan(0)
  })
})
