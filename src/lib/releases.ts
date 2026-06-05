import type { OS, Arch } from './os'

export type AssetFormat =
  | 'dmg'
  | 'pkg'
  | 'msi'
  | 'exe'
  | 'deb'
  | 'rpm'
  | 'AppImage'
  | 'snap'
  | 'tar.gz'

export interface ReleaseAsset {
  name: string
  url: string
  size: number
  os: OS
  arch: Arch
  format: AssetFormat
}

export interface ReleaseData {
  tag: string
  name: string
  htmlUrl: string
  publishedAt: string
  assets: ReleaseAsset[]
}

export const REPO = 'triasbrata/lazysheet'
export const RELEASES_PAGE_URL = `https://github.com/${REPO}/releases`
export const LATEST_PAGE_URL = `${RELEASES_PAGE_URL}/latest`
export const GH_API_LATEST = `https://api.github.com/repos/${REPO}/releases?per_page=1`
export const GH_API_RELEASES = `https://api.github.com/repos/${REPO}/releases?per_page=30`

export function classifyAsset(
  name: string,
): { os: OS; arch: Arch; format: AssetFormat } | null {
  const n = name.toLowerCase()

  // Skip junk/metadata files
  if (/\.(sig|json|txt|sha256|sha512|blockmap|ya?ml|asc)$/.test(n)) return null

  // Detect OS + format (order matters)
  let os: OS
  let format: AssetFormat

  if (/\.dmg$/.test(n)) {
    os = 'macOS'
    format = 'dmg'
  } else if (/\.pkg$/.test(n)) {
    os = 'macOS'
    format = 'pkg'
  } else if (/\.app\.tar\.gz$/.test(n)) {
    os = 'macOS'
    format = 'tar.gz'
  } else if (/\.msi$/.test(n)) {
    os = 'Windows'
    format = 'msi'
  } else if (/\.exe$/.test(n)) {
    os = 'Windows'
    format = 'exe'
  } else if (/\.appimage$/.test(n)) {
    os = 'Linux'
    format = 'AppImage'
  } else if (/\.deb$/.test(n)) {
    os = 'Linux'
    format = 'deb'
  } else if (/\.rpm$/.test(n)) {
    os = 'Linux'
    format = 'rpm'
  } else if (/\.snap$/.test(n)) {
    os = 'Linux'
    format = 'snap'
  } else {
    // Generic .zip/.tar.gz ambiguous -> skip intentionally
    return null
  }

  // Detect arch
  let arch: Arch
  if (/(arm64|aarch64)/.test(n)) {
    arch = 'arm64'
  } else if (/(x64|amd64|x86_64|x86-64|win64)/.test(n)) {
    arch = 'x64'
  } else if (/universal/.test(n)) {
    arch = 'universal'
  } else {
    // Default: macOS -> universal, others -> x64
    arch = os === 'macOS' ? 'universal' : 'x64'
  }

  return { os, arch, format }
}

export function parseRelease(json: unknown): ReleaseData | null {
  try {
    // Accept array (?per_page=1) or object (/latest)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rel: any = Array.isArray(json)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (json as any[]).find((r: any) => r && !r.draft)
      : (json as Record<string, unknown>)

    if (!rel || typeof rel !== 'object' || rel.draft) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assets: ReleaseAsset[] = ((rel.assets ?? []) as any[])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((a: any) => {
        const c = classifyAsset(a.name)
        return c
          ? ({
              name: a.name,
              url: a.browser_download_url,
              size: a.size ?? 0,
              ...c,
            } as ReleaseAsset)
          : null
      })
      .filter((x): x is ReleaseAsset => x !== null)

    return {
      tag: rel.tag_name ?? '',
      name: rel.name ?? rel.tag_name ?? '',
      htmlUrl: rel.html_url ?? LATEST_PAGE_URL,
      publishedAt: rel.published_at ?? '',
      assets,
    }
  } catch {
    return null
  }
}

export function parseReleases(json: unknown): ReleaseData[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arr: any[] = Array.isArray(json) ? json : (json ? [json] : [])
  const result: ReleaseData[] = []
  for (const rel of arr) {
    if (!rel || rel.draft) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assets: ReleaseAsset[] = ((rel.assets ?? []) as any[])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((a: any) => {
        const c = classifyAsset(a.name)
        return c
          ? ({
              name: a.name,
              url: a.browser_download_url,
              size: a.size ?? 0,
              ...c,
            } as ReleaseAsset)
          : null
      })
      .filter((x): x is ReleaseAsset => x !== null)
    result.push({
      tag: rel.tag_name ?? '',
      name: rel.name ?? rel.tag_name ?? '',
      htmlUrl: rel.html_url ?? '',
      publishedAt: rel.published_at ?? '',
      assets,
    })
  }
  return result
}

export function groupByOS(
  assets: ReleaseAsset[],
): Record<'macOS' | 'Windows' | 'Linux', ReleaseAsset[]> {
  return {
    macOS: assets.filter((a) => a.os === 'macOS'),
    Windows: assets.filter((a) => a.os === 'Windows'),
    Linux: assets.filter((a) => a.os === 'Linux'),
  }
}

export function pickPrimaryAsset(
  assets: ReleaseAsset[],
  os: OS,
  arch: Arch | null,
): ReleaseAsset | null {
  const forOS = assets.filter((a) => a.os === os)
  if (!forOS.length) return null

  const fmtRank: Record<string, AssetFormat[]> = {
    macOS: ['dmg', 'pkg', 'tar.gz'],
    Windows: ['exe', 'msi'],
    Linux: ['AppImage', 'deb', 'rpm', 'snap'],
  }

  const archPref: Arch[] = arch ? [arch, 'universal', 'x64'] : ['universal', 'x64', 'arm64']

  for (const ar of archPref) {
    for (const fmt of fmtRank[os] ?? []) {
      const hit = forOS.find((a) => a.arch === ar && a.format === fmt)
      if (hit) return hit
    }
  }

  return forOS[0]!
}

export function osLabel(os: OS): string {
  switch (os) {
    case 'macOS':
      return 'macOS'
    case 'Windows':
      return 'Windows'
    case 'Linux':
      return 'Linux'
    default:
      return 'your OS'
  }
}

export function archBadge(a: ReleaseAsset): string {
  if (a.os === 'macOS' && a.arch === 'universal') return 'Intel + Apple Silicon'
  if (a.arch === 'arm64') return 'ARM64'
  if (a.arch === 'x64') return 'x64'
  if (a.arch === 'universal') return 'Universal'
  return ''
}

export function formatLabel(a: ReleaseAsset): string {
  switch (a.format) {
    case 'dmg':
      return 'DMG'
    case 'pkg':
      return 'PKG'
    case 'tar.gz':
      return 'tar.gz'
    case 'msi':
      return 'MSI Installer'
    case 'exe':
      return 'Installer (.exe)'
    case 'deb':
      return '.deb'
    case 'rpm':
      return '.rpm'
    case 'AppImage':
      return 'AppImage'
    case 'snap':
      return 'Snap'
  }
}
