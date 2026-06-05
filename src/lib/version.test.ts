import { describe, it, expect } from 'vitest'
import {
  parseVersion,
  compareVersions,
  resolveVersion,
  activeVersionFromRelease,
  selectReleaseByTag,
} from './version'
import type { ReleaseData } from '#/lib/releases'

const makeRelease = (tag: string): ReleaseData => ({
  tag,
  name: tag,
  htmlUrl: '',
  publishedAt: '',
  assets: [],
})

describe('parseVersion', () => {
  it('parses a standard semver tag with leading v', () => {
    expect(parseVersion('v0.4.0')).toEqual([0, 4, 0])
  })

  it('parses a tag without leading v', () => {
    expect(parseVersion('1.2')).toEqual([1, 2])
  })

  it('returns [0] for empty string', () => {
    expect(parseVersion('')).toEqual([0])
  })

  it('returns [0] for bare v with no version segments', () => {
    expect(parseVersion('v')).toEqual([0])
  })

  it('strips leading whitespace and trailing whitespace', () => {
    expect(parseVersion('  v1.0 ')).toEqual([1, 0])
  })

  it('maps non-numeric segments to 0', () => {
    expect(parseVersion('va.b')).toEqual([0, 0])
  })

  it('strips uppercase V prefix', () => {
    expect(parseVersion('V2.0')).toEqual([2, 0])
  })
})

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('v0.4.0', 'v0.4.0')).toBe(0)
  })

  it('returns -1 when a < b', () => {
    expect(compareVersions('v0.4.0', 'v0.5.0')).toBe(-1)
  })

  it('returns 1 when a > b', () => {
    expect(compareVersions('v1.0.0', 'v0.9.9')).toBe(1)
  })

  it('returns 0 for different lengths representing equal versions', () => {
    expect(compareVersions('v1', 'v1.0.0')).toBe(0)
  })

  it('returns 1 when a has an extra non-zero patch segment', () => {
    expect(compareVersions('v1.0.1', 'v1.0')).toBe(1)
  })
})

describe('resolveVersion', () => {
  it('returns undefined for empty available list', () => {
    expect(resolveVersion([], 'v1.0.0')).toBeUndefined()
  })

  it('returns exact match when active is in available', () => {
    expect(resolveVersion(['v0.4.0', 'v0.5.0'], 'v0.4.0')).toBe('v0.4.0')
  })

  it('returns the greatest version <= active when multiple qualify', () => {
    expect(resolveVersion(['v0.3.0', 'v0.4.0', 'v0.5.0'], 'v0.4.5')).toBe('v0.4.0')
  })

  it('returns the minimum available when active is below all available versions', () => {
    expect(resolveVersion(['v0.4.0', 'v0.5.0'], 'v0.1.0')).toBe('v0.4.0')
  })

  it('returns the single element when available has one entry', () => {
    expect(resolveVersion(['v0.4.0'], 'v0.4.0')).toBe('v0.4.0')
  })

  it('returns single element even when active is below it', () => {
    expect(resolveVersion(['v0.4.0'], 'v0.1.0')).toBe('v0.4.0')
  })
})

describe('activeVersionFromRelease', () => {
  it('returns FALLBACK_RELEASE.tag when release is null', () => {
    expect(activeVersionFromRelease(null)).toBe('v0.4.0')
  })

  it('returns the release tag when a release object is provided', () => {
    expect(
      activeVersionFromRelease({
        tag: 'v0.5.0',
        name: '',
        htmlUrl: '',
        publishedAt: '',
        assets: [],
      }),
    ).toBe('v0.5.0')
  })
})

describe('selectReleaseByTag', () => {
  it('returns the matching release when v matches a tag', () => {
    const releases = [makeRelease('v0.5.0'), makeRelease('v0.4.0')]
    expect(selectReleaseByTag(releases, 'v0.4.0')).toBe(releases[1])
  })

  it('returns releases[0] when v is given but no tag matches', () => {
    const releases = [makeRelease('v0.5.0'), makeRelease('v0.4.0')]
    expect(selectReleaseByTag(releases, 'v0.9.9')).toBe(releases[0])
  })

  it('returns releases[0] when v is undefined', () => {
    const releases = [makeRelease('v0.5.0'), makeRelease('v0.4.0')]
    expect(selectReleaseByTag(releases, undefined)).toBe(releases[0])
  })

  it('returns null when releases array is empty', () => {
    expect(selectReleaseByTag([], 'v0.5.0')).toBeNull()
  })
})
