// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { screen } from '@testing-library/react'
import React from 'react'

// DownloadView pulls in <Nav>, which renders TanStack <Link>s.
// createFileRoute is also mocked so Route.useLoaderData can be controlled.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
    useParams: () => ({ locale: 'en' }),
    useNavigate: () => () => {},
    useLocation: () => ({ pathname: '/en/download' }),
    createFileRoute: () => (opts: unknown) => ({
      options: opts,
      useLoaderData: () => mockDownloadLoaderData,
      useParams: () => ({ locale: 'en' }),
    }),
  }
})

// Stub FeedbackDialog so it doesn't pull in createServerFn (server-only)
vi.mock('#/features/feedback/feedback-dialog', () => ({
  FeedbackDialog: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}))

// Stub GithubStars so it doesn't pull in the fetch hook
vi.mock('#/features/github/github-stars', () => ({
  GithubStars: () => null,
}))

// Stub getDownloadData (a createServerFn) so the Route loader can be invoked
// without a server runtime ("No Start context") error.
vi.mock('#/lib/releases-data', () => ({
  getDownloadData: vi.fn(() =>
    Promise.resolve({ release: null, serverOS: 'unknown' }),
  ),
}))

// motion/react mock — Nav uses useScroll and useMotionValueEvent
vi.mock('motion/react', () => {
  const motion = new Proxy(
    {},
    {
      get(_target, tag: string) {
        return function MotionEl({ children, ...rest }: React.HTMLAttributes<HTMLElement> & { [key: string]: unknown }) {
          return React.createElement(tag as string, rest, children)
        }
      },
    },
  )
  return {
    motion,
    useScroll: () => ({ scrollY: { get: () => 0 }, scrollYProgress: { get: () => 0 } }),
    useTransform: (_mv: unknown, _in: unknown, out: unknown[]) => ({
      get: () => (Array.isArray(out) ? out[0] : 0),
    }),
    useMotionValue: (v: number) => ({ get: () => v, set: vi.fn() }),
    useSpring: (mv: unknown) => mv,
    useReducedMotion: () => false,
    useMotionValueEvent: vi.fn(),
  }
})

// Pin client OS detection so the "recommended" highlight is deterministic.
vi.mock('#/lib/os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#/lib/os')>()
  return {
    ...actual,
    detectClientOSArch: () => Promise.resolve({ os: 'unknown', arch: null }),
  }
})

import { DownloadView, Route } from '#/routes/$locale/download'
import { RELEASES_PAGE_URL, type ReleaseData, type ReleaseAsset } from '#/lib/releases'
import type { DownloadData } from '#/lib/releases-data'
import { renderWithI18n } from '#/test/i18n'

const release: ReleaseData = {
  tag: 'v1.0.0',
  name: 'v1.0.0',
  htmlUrl: 'https://github.com/triasbrata/lazysheet/releases/tag/v1.0.0',
  publishedAt: '2026-05-30T00:00:00Z',
  assets: [
    { name: 'LazySheet_1.0.0_universal.dmg', url: 'https://dl/mac.dmg', size: 1, os: 'macOS', arch: 'universal', format: 'dmg' },
    { name: 'LazySheet_1.0.0_x64-setup.exe', url: 'https://dl/win.exe', size: 1, os: 'Windows', arch: 'x64', format: 'exe' },
  ],
}

// Mutable loader data for the Download wrapper tests
let mockDownloadLoaderData: DownloadData = { release, serverOS: 'macOS' }

afterEach(() => {
  cleanup()
  mockDownloadLoaderData = { release, serverOS: 'macOS' }
})

describe('Download page — what the user sees', () => {
  it('shows the "Download" heading', () => {
    renderWithI18n(<DownloadView data={{ release, serverOS: 'macOS' }} />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Download' }),
    ).toBeTruthy()
  })

  it('groups available builds by OS', () => {
    renderWithI18n(<DownloadView data={{ release, serverOS: 'macOS' }} />)
    expect(screen.getByRole('heading', { name: 'macOS' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Windows' })).toBeTruthy()
  })

  it('lists each downloadable asset with format and arch', () => {
    renderWithI18n(<DownloadView data={{ release, serverOS: 'macOS' }} />)

    const dmg = screen.getByText('DMG').closest('a')
    expect(dmg?.getAttribute('href')).toBe('https://dl/mac.dmg')
    expect(screen.getByText('Intel + Apple Silicon')).toBeTruthy()

    const exe = screen.getByText('Installer (.exe)').closest('a')
    expect(exe?.getAttribute('href')).toBe('https://dl/win.exe')
    expect(screen.getByText('x64')).toBeTruthy()
  })

  it('shows an empty state with a releases link when no builds are published', () => {
    renderWithI18n(<DownloadView data={{ release: null, serverOS: 'unknown' }} />)

    expect(screen.getByText(/Builds aren't published yet/i)).toBeTruthy()
    const link = screen.getByText('View Releases on GitHub')
    expect(link.getAttribute('href')).toBe(RELEASES_PAGE_URL)
  })
})

// ---------------------------------------------------------------------------
// DownloadRow — tested via DownloadView which renders it for each asset
// ---------------------------------------------------------------------------
describe('DownloadRow — via DownloadView', () => {
  const dmgAsset: ReleaseAsset = {
    name: 'LazySheet_1.0.0_universal.dmg',
    url: 'https://dl/mac.dmg',
    size: 12345,
    os: 'macOS',
    arch: 'universal',
    format: 'dmg',
  }

  const debAsset: ReleaseAsset = {
    name: 'LazySheet_1.0.0_amd64.deb',
    url: 'https://dl/linux.deb',
    size: 5678,
    os: 'Linux',
    arch: 'x64',
    format: 'deb',
  }

  it('renders the label and arch badge for a DMG asset', () => {
    const singleRelease: ReleaseData = {
      tag: 'v2.0.0',
      name: 'v2.0.0',
      htmlUrl: '',
      publishedAt: '',
      assets: [dmgAsset],
    }
    renderWithI18n(<DownloadView data={{ release: singleRelease, serverOS: 'macOS' }} />)
    expect(screen.getByText('DMG')).toBeTruthy()
    expect(screen.getByText('Intel + Apple Silicon')).toBeTruthy()
    const link = screen.getByText('DMG').closest('a')
    expect(link?.getAttribute('href')).toBe('https://dl/mac.dmg')
  })

  it('renders the label and arch badge for a .deb asset', () => {
    const linuxRelease: ReleaseData = {
      tag: 'v2.0.0',
      name: 'v2.0.0',
      htmlUrl: '',
      publishedAt: '',
      assets: [debAsset],
    }
    renderWithI18n(<DownloadView data={{ release: linuxRelease, serverOS: 'Linux' }} />)
    expect(screen.getByText('.deb')).toBeTruthy()
    expect(screen.getByText('x64')).toBeTruthy()
    const link = screen.getByText('.deb').closest('a')
    expect(link?.getAttribute('href')).toBe('https://dl/linux.deb')
  })
})

// ---------------------------------------------------------------------------
// Download wrapper — renders via Route.options.component with mocked loader
// ---------------------------------------------------------------------------
describe('Download wrapper (Route.options.component)', () => {
  it('renders the heading when called via the route component', () => {
    mockDownloadLoaderData = { release, serverOS: 'macOS' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    const DownloadWrapper = opts.component as React.ComponentType
    renderWithI18n(React.createElement(DownloadWrapper))
    expect(screen.getByRole('heading', { level: 1, name: 'Download' })).toBeTruthy()
  })

  it('renders OS sections for each platform when release has assets', () => {
    mockDownloadLoaderData = { release, serverOS: 'macOS' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    const DownloadWrapper = opts.component as React.ComponentType
    renderWithI18n(React.createElement(DownloadWrapper))
    expect(screen.getByRole('heading', { name: 'macOS' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Windows' })).toBeTruthy()
  })

  it('renders empty state when release is null', () => {
    mockDownloadLoaderData = { release: null, serverOS: 'unknown' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    const DownloadWrapper = opts.component as React.ComponentType
    renderWithI18n(React.createElement(DownloadWrapper))
    expect(screen.getByText(/Builds aren't published yet/i)).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Route.options.loader — covers the loader function (line 18)
// ---------------------------------------------------------------------------
describe('Route.options.loader', () => {
  it('is a function that returns a thenable (getDownloadData result)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    expect(typeof opts.loader).toBe('function')
    // getDownloadData is mocked above; await so no rejection escapes the test.
    await expect(opts.loader()).resolves.toEqual({
      release: null,
      serverOS: 'unknown',
    })
  })
})
