// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { screen, cleanup } from '@testing-library/react'

// Pin client OS/arch detection to "unknown" so serverOS stays authoritative.
// (happy-dom's userAgent contains "Linux", which would otherwise override it.)
vi.mock('#/lib/os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#/lib/os')>()
  return {
    ...actual,
    detectClientOSArch: () => Promise.resolve({ os: 'unknown', arch: null }),
  }
})

afterEach(cleanup)
import { DownloadButton } from './download-button'
import { LATEST_PAGE_URL, type ReleaseData } from '#/lib/releases'
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
    { name: 'LazySheet_1.0.0_amd64.AppImage', url: 'https://dl/linux.AppImage', size: 1, os: 'Linux', arch: 'x64', format: 'AppImage' },
  ],
}

describe('DownloadButton', () => {
  it('points at the macOS asset URL when serverOS is macOS', async () => {
    const data: DownloadData = { release, serverOS: 'macOS' }
    renderWithI18n(<DownloadButton data={data} />)
    const link = await screen.findByRole('link')
    expect(link.getAttribute('href')).toBe('https://dl/mac.dmg')
    expect(link.textContent).toMatch(/macOS/)
  })

  it('points at the Windows asset URL when serverOS is Windows', async () => {
    const data: DownloadData = { release, serverOS: 'Windows' }
    renderWithI18n(<DownloadButton data={data} />)
    const link = await screen.findByRole('link')
    expect(link.getAttribute('href')).toBe('https://dl/win.exe')
    expect(link.textContent).toMatch(/Windows/)
  })

  it('falls back to the releases page when there is no release', async () => {
    const data: DownloadData = { release: null, serverOS: 'unknown' }
    renderWithI18n(<DownloadButton data={data} />)
    const link = await screen.findByRole('link')
    expect(link.getAttribute('href')).toBe(LATEST_PAGE_URL)
    expect(link.textContent).toMatch(/Download/)
  })

  it('renders LinuxMark icon and Linux label when serverOS is Linux', async () => {
    const data: DownloadData = { release, serverOS: 'Linux' }
    renderWithI18n(<DownloadButton data={data} />)
    const link = await screen.findByRole('link')
    expect(link.getAttribute('href')).toBe('https://dl/linux.AppImage')
    expect(link.textContent).toMatch(/Linux/)
  })
})
