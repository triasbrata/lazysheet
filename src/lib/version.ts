import type { ReleaseData } from '#/lib/releases'
import { FALLBACK_RELEASE } from '#/lib/fallback-release'

export function parseVersion(tag: string): number[] {
  let s = tag.trim()
  if (s.startsWith('v') || s.startsWith('V')) s = s.slice(1)
  if (s === '') return [0]
  return s.split('.').map((seg) => {
    const n = Number(seg)
    return Number.isFinite(n) ? n : 0
  })
}

export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x < y) return -1
    if (x > y) return 1
  }
  return 0
}

export function resolveVersion(available: string[], active: string): string | undefined {
  if (available.length === 0) return undefined
  const lte = available.filter((v) => compareVersions(v, active) <= 0)
  if (lte.length > 0) {
    return lte.reduce((best, v) => (compareVersions(v, best) > 0 ? v : best))
  }
  return available.reduce((min, v) => (compareVersions(v, min) < 0 ? v : min))
}

export function activeVersionFromRelease(release: ReleaseData | null): string {
  return release?.tag ?? FALLBACK_RELEASE.tag
}

export function selectReleaseByTag(releases: ReleaseData[], v: string | undefined): ReleaseData | null {
  if (v) {
    const found = releases.find((r) => r.tag === v)
    if (found) return found
  }
  return releases[0] ?? null
}
