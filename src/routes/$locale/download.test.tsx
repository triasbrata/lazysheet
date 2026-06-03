// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { screen } from '@testing-library/react'

// DownloadView pulls in <Nav>, which renders TanStack <Link>s.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
    useParams: () => ({ locale: 'en' }),
    useNavigate: () => () => {},
    useLocation: () => ({ pathname: '/en/download' }),
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

import { DownloadView } from '#/routes/$locale/download'
import { RELEASES_PAGE_URL, type ReleaseData } from '#/lib/releases'
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

afterEach(cleanup)

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
