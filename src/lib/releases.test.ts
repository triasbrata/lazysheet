import { describe, it, expect } from 'vitest'
import {
  classifyAsset,
  parseRelease,
  groupByOS,
  pickPrimaryAsset,
  type ReleaseAsset,
  type ReleaseData,
} from './releases'

// ---------------------------------------------------------------------------
// classifyAsset
// ---------------------------------------------------------------------------
describe('classifyAsset', () => {
  // --- Tauri-style names ---
  it('Tauri universal dmg -> macOS/universal/dmg', () => {
    const r = classifyAsset('LazySheet_1.0.0_universal.dmg')
    expect(r).toEqual({ os: 'macOS', arch: 'universal', format: 'dmg' })
  })

  it('Tauri x64 setup exe -> Windows/x64/exe', () => {
    const r = classifyAsset('LazySheet_1.0.0_x64-setup.exe')
    expect(r).toEqual({ os: 'Windows', arch: 'x64', format: 'exe' })
  })

  it('Tauri amd64 deb -> Linux/x64/deb', () => {
    const r = classifyAsset('LazySheet_1.0.0_amd64.deb')
    expect(r).toEqual({ os: 'Linux', arch: 'x64', format: 'deb' })
  })

  it('Tauri aarch64 rpm -> Linux/arm64/rpm', () => {
    const r = classifyAsset('lazysheet_1.0.0_aarch64.rpm')
    expect(r).toEqual({ os: 'Linux', arch: 'arm64', format: 'rpm' })
  })

  it('AppImage with no arch keyword defaults to x64', () => {
    const r = classifyAsset('lazysheet-1.0.0.AppImage')
    expect(r).toEqual({ os: 'Linux', arch: 'x64', format: 'AppImage' })
  })

  it('Tauri arm64 dmg -> macOS/arm64/dmg', () => {
    const r = classifyAsset('LazySheet_1.0.0_arm64.dmg')
    expect(r).toEqual({ os: 'macOS', arch: 'arm64', format: 'dmg' })
  })

  // --- Electron-style names ---
  it('Electron arm64 dmg -> macOS/arm64/dmg', () => {
    const r = classifyAsset('LazySheet-1.0.0-arm64.dmg')
    expect(r).toEqual({ os: 'macOS', arch: 'arm64', format: 'dmg' })
  })

  it('Electron Setup exe -> Windows/x64/exe (defaults to x64)', () => {
    const r = classifyAsset('LazySheet.Setup.1.0.0.exe')
    expect(r).toEqual({ os: 'Windows', arch: 'x64', format: 'exe' })
  })

  it('dmg with no arch keyword defaults to universal for macOS', () => {
    const r = classifyAsset('LazySheet-1.0.0.dmg')
    expect(r).toEqual({ os: 'macOS', arch: 'universal', format: 'dmg' })
  })

  it('x86_64 deb -> Linux/x64/deb', () => {
    const r = classifyAsset('lazysheet_1.0.0_x86_64.deb')
    expect(r).toEqual({ os: 'Linux', arch: 'x64', format: 'deb' })
  })

  // --- Junk files -> null ---
  it('latest.json -> null', () => {
    expect(classifyAsset('latest.json')).toBeNull()
  })

  it('.exe.sig -> null', () => {
    expect(classifyAsset('LazySheet_1.0.0_x64.exe.sig')).toBeNull()
  })

  it('checksums.txt -> null', () => {
    expect(classifyAsset('checksums.txt')).toBeNull()
  })

  it('generic .zip -> null (ambiguous OS)', () => {
    expect(classifyAsset('LazySheet-1.0.0.zip')).toBeNull()
  })

  it('.sha256 -> null', () => {
    expect(classifyAsset('LazySheet_1.0.0_x64.msi.sha256')).toBeNull()
  })

  it('.blockmap -> null', () => {
    expect(classifyAsset('LazySheet-1.0.0.dmg.blockmap')).toBeNull()
  })

  it('.yaml -> null', () => {
    expect(classifyAsset('latest-mac.yml')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// parseRelease
// ---------------------------------------------------------------------------

const mockAssets = [
  {
    name: 'LazySheet_1.0.0_universal.dmg',
    browser_download_url: 'https://example.com/LazySheet_1.0.0_universal.dmg',
    size: 100000,
  },
  {
    name: 'LazySheet_1.0.0_x64-setup.exe',
    browser_download_url: 'https://example.com/LazySheet_1.0.0_x64-setup.exe',
    size: 80000,
  },
  {
    name: 'LazySheet_1.0.0_amd64.deb',
    browser_download_url: 'https://example.com/LazySheet_1.0.0_amd64.deb',
    size: 90000,
  },
  // Junk that should be filtered
  {
    name: 'latest.json',
    browser_download_url: 'https://example.com/latest.json',
    size: 500,
  },
  {
    name: 'LazySheet_1.0.0_x64.exe.sig',
    browser_download_url: 'https://example.com/LazySheet_1.0.0_x64.exe.sig',
    size: 100,
  },
]

const mockRelease = {
  tag_name: 'v1.0.0',
  name: 'LazySheet 1.0.0',
  html_url: 'https://github.com/triasbrata/lazysheet/releases/tag/v1.0.0',
  published_at: '2026-01-01T00:00:00Z',
  draft: false,
  assets: mockAssets,
}

describe('parseRelease', () => {
  it('empty array -> null', () => {
    expect(parseRelease([])).toBeNull()
  })

  it('array with one non-draft release -> ReleaseData with classified assets only', () => {
    const result = parseRelease([mockRelease])
    expect(result).not.toBeNull()
    const data = result as ReleaseData
    expect(data.tag).toBe('v1.0.0')
    expect(data.name).toBe('LazySheet 1.0.0')
    expect(data.htmlUrl).toBe(
      'https://github.com/triasbrata/lazysheet/releases/tag/v1.0.0',
    )
    expect(data.publishedAt).toBe('2026-01-01T00:00:00Z')
    // Only the 3 valid assets, junk filtered out
    expect(data.assets).toHaveLength(3)
    expect(data.assets.map((a) => a.name)).toContain('LazySheet_1.0.0_universal.dmg')
    expect(data.assets.map((a) => a.name)).toContain('LazySheet_1.0.0_x64-setup.exe')
    expect(data.assets.map((a) => a.name)).toContain('LazySheet_1.0.0_amd64.deb')
    // Junk should not be included
    expect(data.assets.map((a) => a.name)).not.toContain('latest.json')
    expect(data.assets.map((a) => a.name)).not.toContain('LazySheet_1.0.0_x64.exe.sig')
  })

  it('draft release -> null', () => {
    const draftRelease = { ...mockRelease, draft: true }
    expect(parseRelease([draftRelease])).toBeNull()
  })

  it('array with draft first, then valid -> picks valid', () => {
    const draftRelease = { ...mockRelease, draft: true, tag_name: 'v0.9.0-draft' }
    const result = parseRelease([draftRelease, mockRelease])
    expect(result).not.toBeNull()
    expect((result as ReleaseData).tag).toBe('v1.0.0')
  })

  it('null input -> null', () => {
    expect(parseRelease(null)).toBeNull()
  })

  it('garbage input -> null', () => {
    expect(parseRelease('not json')).toBeNull()
  })

  it('object (single release, not array) -> ReleaseData', () => {
    const result = parseRelease(mockRelease)
    expect(result).not.toBeNull()
    expect((result as ReleaseData).tag).toBe('v1.0.0')
  })

  it('release with no assets -> ReleaseData with empty assets array', () => {
    const releaseNoAssets = { ...mockRelease, assets: [] }
    const result = parseRelease([releaseNoAssets])
    expect(result).not.toBeNull()
    expect((result as ReleaseData).assets).toHaveLength(0)
  })

  it('release with only junk assets -> ReleaseData with empty assets array', () => {
    const releaseJunkAssets = {
      ...mockRelease,
      assets: [
        { name: 'latest.json', browser_download_url: 'https://example.com/latest.json', size: 100 },
        {
          name: 'checksums.txt',
          browser_download_url: 'https://example.com/checksums.txt',
          size: 200,
        },
      ],
    }
    const result = parseRelease([releaseJunkAssets])
    expect(result).not.toBeNull()
    expect((result as ReleaseData).assets).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// pickPrimaryAsset
// ---------------------------------------------------------------------------

const allAssets: ReleaseAsset[] = [
  {
    name: 'LazySheet_1.0.0_universal.dmg',
    url: 'https://example.com/universal.dmg',
    size: 100000,
    os: 'macOS',
    arch: 'universal',
    format: 'dmg',
  },
  {
    name: 'LazySheet_1.0.0_arm64.dmg',
    url: 'https://example.com/arm64.dmg',
    size: 90000,
    os: 'macOS',
    arch: 'arm64',
    format: 'dmg',
  },
  {
    name: 'LazySheet_1.0.0_x64-setup.exe',
    url: 'https://example.com/x64.exe',
    size: 80000,
    os: 'Windows',
    arch: 'x64',
    format: 'exe',
  },
  {
    name: 'LazySheet_1.0.0_arm64.exe',
    url: 'https://example.com/arm64.exe',
    size: 75000,
    os: 'Windows',
    arch: 'arm64',
    format: 'exe',
  },
  {
    name: 'LazySheet_1.0.0_amd64.deb',
    url: 'https://example.com/x64.deb',
    size: 70000,
    os: 'Linux',
    arch: 'x64',
    format: 'deb',
  },
  {
    name: 'LazySheet_1.0.0_aarch64.AppImage',
    url: 'https://example.com/arm64.AppImage',
    size: 65000,
    os: 'Linux',
    arch: 'arm64',
    format: 'AppImage',
  },
]

describe('pickPrimaryAsset', () => {
  it('Windows + arch=arm64 picks arm64 exe over x64 exe', () => {
    const result = pickPrimaryAsset(allAssets, 'Windows', 'arm64')
    expect(result?.arch).toBe('arm64')
    expect(result?.format).toBe('exe')
  })

  it('macOS + arch=null picks universal dmg (default pref)', () => {
    const result = pickPrimaryAsset(allAssets, 'macOS', null)
    expect(result?.arch).toBe('universal')
    expect(result?.format).toBe('dmg')
  })

  it('macOS + arch=arm64 picks arm64 dmg', () => {
    const result = pickPrimaryAsset(allAssets, 'macOS', 'arm64')
    expect(result?.arch).toBe('arm64')
    expect(result?.format).toBe('dmg')
  })

  it('Linux + arch=arm64 picks arm64 AppImage (best format for arm64)', () => {
    const result = pickPrimaryAsset(allAssets, 'Linux', 'arm64')
    expect(result?.arch).toBe('arm64')
    expect(result?.format).toBe('AppImage')
  })

  it('Linux + arch=null picks x64 AppImage when available (x64 before arm64 in default pref)', () => {
    const assetsWithX64AppImage: ReleaseAsset[] = [
      {
        name: 'lazysheet-1.0.0.AppImage',
        url: 'https://example.com/x64.AppImage',
        size: 65000,
        os: 'Linux',
        arch: 'x64',
        format: 'AppImage',
      },
      ...allAssets.filter((a) => a.os === 'Linux'),
    ]
    const result = pickPrimaryAsset(assetsWithX64AppImage, 'Linux', null)
    expect(result?.arch).toBe('x64')
    expect(result?.format).toBe('AppImage')
  })

  it('OS with no assets -> null', () => {
    const macOnlyAssets = allAssets.filter((a) => a.os === 'macOS')
    expect(pickPrimaryAsset(macOnlyAssets, 'Windows', null)).toBeNull()
  })

  it('unknown OS -> null (no assets for that OS)', () => {
    expect(pickPrimaryAsset(allAssets, 'unknown', null)).toBeNull()
  })

  it('Windows + arch=x64 picks x64 exe', () => {
    const result = pickPrimaryAsset(allAssets, 'Windows', 'x64')
    expect(result?.arch).toBe('x64')
    expect(result?.format).toBe('exe')
  })
})

// ---------------------------------------------------------------------------
// groupByOS
// ---------------------------------------------------------------------------

describe('groupByOS', () => {
  it('buckets assets into the correct OS groups', () => {
    const groups = groupByOS(allAssets)
    expect(groups.macOS).toHaveLength(2)
    expect(groups.Windows).toHaveLength(2)
    expect(groups.Linux).toHaveLength(2)
    expect(groups.macOS.every((a) => a.os === 'macOS')).toBe(true)
    expect(groups.Windows.every((a) => a.os === 'Windows')).toBe(true)
    expect(groups.Linux.every((a) => a.os === 'Linux')).toBe(true)
  })

  it('returns empty arrays for OS with no assets', () => {
    const macOnlyAssets = allAssets.filter((a) => a.os === 'macOS')
    const groups = groupByOS(macOnlyAssets)
    expect(groups.macOS).toHaveLength(2)
    expect(groups.Windows).toHaveLength(0)
    expect(groups.Linux).toHaveLength(0)
  })

  it('returns all empty arrays for empty input', () => {
    const groups = groupByOS([])
    expect(groups.macOS).toHaveLength(0)
    expect(groups.Windows).toHaveLength(0)
    expect(groups.Linux).toHaveLength(0)
  })
})
