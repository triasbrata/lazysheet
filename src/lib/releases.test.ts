import { describe, it, expect } from 'vitest'
import {
  classifyAsset,
  parseRelease,
  groupByOS,
  pickPrimaryAsset,
  osLabel,
  archBadge,
  formatLabel,
  LATEST_PAGE_URL,
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

// ---------------------------------------------------------------------------
// osLabel
// ---------------------------------------------------------------------------

describe('osLabel', () => {
  it("'macOS' -> 'macOS'", () => {
    expect(osLabel('macOS')).toBe('macOS')
  })

  it("'Windows' -> 'Windows'", () => {
    expect(osLabel('Windows')).toBe('Windows')
  })

  it("'Linux' -> 'Linux'", () => {
    expect(osLabel('Linux')).toBe('Linux')
  })

  it("'unknown' -> 'your OS'", () => {
    expect(osLabel('unknown')).toBe('your OS')
  })
})

// ---------------------------------------------------------------------------
// archBadge
// ---------------------------------------------------------------------------

function makeAsset(
  overrides: Partial<ReleaseAsset> & Pick<ReleaseAsset, 'os' | 'arch'>,
): ReleaseAsset {
  return {
    name: 'test-asset',
    url: 'https://example.com/test',
    size: 1000,
    format: 'dmg',
    ...overrides,
  }
}

describe('archBadge', () => {
  it('macOS + universal -> "Intel + Apple Silicon"', () => {
    const a = makeAsset({ os: 'macOS', arch: 'universal', format: 'dmg' })
    expect(archBadge(a)).toBe('Intel + Apple Silicon')
  })

  it('non-macOS + arm64 -> "ARM64"', () => {
    const a = makeAsset({ os: 'Linux', arch: 'arm64', format: 'AppImage' })
    expect(archBadge(a)).toBe('ARM64')
  })

  it('macOS + arm64 -> "ARM64" (not macOS+universal path)', () => {
    const a = makeAsset({ os: 'macOS', arch: 'arm64', format: 'dmg' })
    expect(archBadge(a)).toBe('ARM64')
  })

  it('any OS + x64 -> "x64"', () => {
    const a = makeAsset({ os: 'Windows', arch: 'x64', format: 'exe' })
    expect(archBadge(a)).toBe('x64')
  })

  it('non-macOS + universal -> "Universal"', () => {
    // Windows with a hypothetical universal arch (not a real Tauri scenario but exercises the branch)
    const a = makeAsset({ os: 'Windows', arch: 'universal', format: 'exe' })
    expect(archBadge(a)).toBe('Universal')
  })
})

// ---------------------------------------------------------------------------
// formatLabel
// ---------------------------------------------------------------------------

describe('formatLabel', () => {
  it('dmg -> "DMG"', () => {
    const a = makeAsset({ os: 'macOS', arch: 'universal', format: 'dmg' })
    expect(formatLabel(a)).toBe('DMG')
  })

  it('pkg -> "PKG"', () => {
    const a = makeAsset({ os: 'macOS', arch: 'universal', format: 'pkg' })
    expect(formatLabel(a)).toBe('PKG')
  })

  it('tar.gz -> "tar.gz"', () => {
    const a = makeAsset({ os: 'macOS', arch: 'universal', format: 'tar.gz' })
    expect(formatLabel(a)).toBe('tar.gz')
  })

  it('msi -> "MSI Installer"', () => {
    const a = makeAsset({ os: 'Windows', arch: 'x64', format: 'msi' })
    expect(formatLabel(a)).toBe('MSI Installer')
  })

  it('exe -> "Installer (.exe)"', () => {
    const a = makeAsset({ os: 'Windows', arch: 'x64', format: 'exe' })
    expect(formatLabel(a)).toBe('Installer (.exe)')
  })

  it('deb -> ".deb"', () => {
    const a = makeAsset({ os: 'Linux', arch: 'x64', format: 'deb' })
    expect(formatLabel(a)).toBe('.deb')
  })

  it('rpm -> ".rpm"', () => {
    const a = makeAsset({ os: 'Linux', arch: 'x64', format: 'rpm' })
    expect(formatLabel(a)).toBe('.rpm')
  })

  it('AppImage -> "AppImage"', () => {
    const a = makeAsset({ os: 'Linux', arch: 'x64', format: 'AppImage' })
    expect(formatLabel(a)).toBe('AppImage')
  })

  it('snap -> "Snap"', () => {
    const a = makeAsset({ os: 'Linux', arch: 'x64', format: 'snap' })
    expect(formatLabel(a)).toBe('Snap')
  })
})

// ---------------------------------------------------------------------------
// classifyAsset — additional format/arch branches
// ---------------------------------------------------------------------------

describe('classifyAsset (extra formats and arch keywords)', () => {
  it('.pkg -> macOS/universal/pkg', () => {
    expect(classifyAsset('LazySheet_1.0.0_universal.pkg')).toEqual({
      os: 'macOS',
      arch: 'universal',
      format: 'pkg',
    })
  })

  it('.app.tar.gz -> macOS/universal/tar.gz (defaults to universal)', () => {
    expect(classifyAsset('LazySheet_1.0.0.app.tar.gz')).toEqual({
      os: 'macOS',
      arch: 'universal',
      format: 'tar.gz',
    })
  })

  it('.msi -> Windows/x64/msi', () => {
    expect(classifyAsset('LazySheet_1.0.0_x64_en-US.msi')).toEqual({
      os: 'Windows',
      arch: 'x64',
      format: 'msi',
    })
  })

  it('.snap -> Linux/x64/snap (defaults to x64)', () => {
    expect(classifyAsset('LazySheet_1.0.0.snap')).toEqual({
      os: 'Linux',
      arch: 'x64',
      format: 'snap',
    })
  })

  it('win64 keyword in exe -> x64', () => {
    expect(classifyAsset('LazySheet-win64.exe')).toEqual({
      os: 'Windows',
      arch: 'x64',
      format: 'exe',
    })
  })

  it('x86-64 keyword in deb -> x64', () => {
    expect(classifyAsset('lazysheet-1.0.0-x86-64.deb')).toEqual({
      os: 'Linux',
      arch: 'x64',
      format: 'deb',
    })
  })

  it('.asc -> null (junk)', () => {
    expect(classifyAsset('LazySheet_1.0.0_x64.exe.asc')).toBeNull()
  })

  it('.sha512 -> null (junk)', () => {
    expect(classifyAsset('LazySheet_1.0.0_x64.msi.sha512')).toBeNull()
  })

  it('.yaml -> null (junk)', () => {
    expect(classifyAsset('latest.yaml')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// parseRelease — additional branches
// ---------------------------------------------------------------------------

describe('parseRelease (additional branches)', () => {
  it('object with tag_name but no name -> name falls back to tag_name', () => {
    const rel = {
      tag_name: 'v2.0.0',
      // name is absent
      html_url: 'https://github.com/triasbrata/lazysheet/releases/tag/v2.0.0',
      published_at: '2026-06-01T00:00:00Z',
      draft: false,
      assets: [],
    }
    const result = parseRelease(rel)
    expect(result).not.toBeNull()
    expect((result as ReleaseData).name).toBe('v2.0.0')
    expect((result as ReleaseData).tag).toBe('v2.0.0')
  })

  it('object missing html_url -> uses LATEST_PAGE_URL', () => {
    const rel = {
      tag_name: 'v2.0.0',
      name: 'LazySheet 2.0.0',
      // html_url absent
      published_at: '2026-06-01T00:00:00Z',
      draft: false,
      assets: [],
    }
    const result = parseRelease(rel)
    expect(result).not.toBeNull()
    expect((result as ReleaseData).htmlUrl).toBe(LATEST_PAGE_URL)
  })

  it('object missing published_at -> publishedAt is empty string', () => {
    const rel = {
      tag_name: 'v2.0.0',
      name: 'LazySheet 2.0.0',
      html_url: 'https://github.com/triasbrata/lazysheet/releases/tag/v2.0.0',
      // published_at absent
      draft: false,
      assets: [],
    }
    const result = parseRelease(rel)
    expect(result).not.toBeNull()
    expect((result as ReleaseData).publishedAt).toBe('')
  })

  it('asset with missing size -> size defaults to 0', () => {
    const rel = {
      tag_name: 'v2.0.0',
      name: 'LazySheet 2.0.0',
      html_url: 'https://github.com/triasbrata/lazysheet/releases/tag/v2.0.0',
      published_at: '2026-06-01T00:00:00Z',
      draft: false,
      assets: [
        {
          name: 'LazySheet_2.0.0_universal.dmg',
          browser_download_url: 'https://example.com/LazySheet_2.0.0_universal.dmg',
          // size absent
        },
      ],
    }
    const result = parseRelease(rel)
    expect(result).not.toBeNull()
    const assets = (result as ReleaseData).assets
    expect(assets).toHaveLength(1)
    expect(assets[0]!.size).toBe(0)
  })

  it('non-array object with draft:true -> null', () => {
    const rel = {
      tag_name: 'v2.0.0',
      name: 'LazySheet 2.0.0',
      html_url: 'https://github.com/triasbrata/lazysheet/releases/tag/v2.0.0',
      published_at: '2026-06-01T00:00:00Z',
      draft: true,
      assets: [],
    }
    expect(parseRelease(rel)).toBeNull()
  })

  it('object whose assets getter throws -> catch returns null', () => {
    // Triggers the catch{} block by providing an assets property that throws on access
    const rel = Object.defineProperty(
      {
        tag_name: 'v2.0.0',
        name: 'LazySheet 2.0.0',
        html_url: 'https://github.com/triasbrata/lazysheet/releases/tag/v2.0.0',
        published_at: '2026-06-01T00:00:00Z',
        draft: false,
      },
      'assets',
      {
        get() {
          throw new Error('simulated fetch error')
        },
      },
    )
    expect(parseRelease(rel)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// pickPrimaryAsset — forOS[0] last-resort fallback
// ---------------------------------------------------------------------------

describe('pickPrimaryAsset (last-resort fallback)', () => {
  it('when no asset matches arch or format rank, returns first asset of that OS', () => {
    // Craft a Linux asset whose arch+format combo is not in fmtRank for any archPref step.
    // archPref for arch=null is ['universal','x64','arm64']
    // fmtRank for Linux is ['AppImage','deb','rpm','snap']
    // We need an asset whose (arch, format) is never hit.
    // Use arch='x64' but a format not in fmtRank... but Linux formats in fmtRank cover all.
    // Instead: use arch='universal' + format='AppImage' — that WOULD be found.
    // Trick: provide ONLY an arm64 snap asset but request arch='x64'.
    // archPref for arch='x64' is ['x64','universal','x64'... wait, it's [arch, 'universal', 'x64'] = ['x64','universal','x64']
    // So arm64 snap won't match x64 or universal -> falls through to forOS[0]
    const fallbackAsset: ReleaseAsset = {
      name: 'lazysheet-1.0.0-arm64.snap',
      url: 'https://example.com/arm64.snap',
      size: 50000,
      os: 'Linux',
      arch: 'arm64',
      format: 'snap',
    }
    const result = pickPrimaryAsset([fallbackAsset], 'Linux', 'x64')
    // snap with arm64 is not matched by x64/universal prefs, falls back to forOS[0]
    expect(result).toBe(fallbackAsset)
  })
})
