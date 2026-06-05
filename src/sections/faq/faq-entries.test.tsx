// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import type React from 'react'

import { useFaqEntries, type FaqEntry } from '#/sections/faq/faq-entries'
import { renderWithI18n } from '#/test/i18n'

afterEach(cleanup)

function Probe({ tag }: { tag: string }) {
  const entries: FaqEntry[] = useFaqEntries(tag)
  return (
    <div>
      <span data-testid="count">{entries.length}</span>
      {entries.map((e) => (
        <div key={e.id}>
          <span data-testid={`question-${e.id}`}>{e.question}</span>
          <div data-testid={`body-${e.id}`}>{e.body as React.ReactNode}</div>
        </div>
      ))}
    </div>
  )
}

describe('useFaqEntries — version filtering', () => {
  describe('activeTag v0.4.0 (exact match)', () => {
    it('returns 3 entries', () => {
      renderWithI18n(<Probe tag="v0.4.0" />)
      expect(screen.getByTestId('count').textContent).toBe('3')
    })

    it('unsigned question text is visible', () => {
      renderWithI18n(<Probe tag="v0.4.0" />)
      expect(
        screen.getByText(
          'macOS says LazySheet is "damaged" or from an "unidentified developer"',
        ),
      ).toBeTruthy()
    })

    it('deb question text is visible', () => {
      renderWithI18n(<Probe tag="v0.4.0" />)
      expect(
        screen.getByText('Installing the .deb on Linux fails with missing dependencies'),
      ).toBeTruthy()
    })

    it('appimage-egl question text is visible', () => {
      renderWithI18n(<Probe tag="v0.4.0" />)
      expect(
        screen.getByText('AppImage shows a blank window on Fedora or Arch?'),
      ).toBeTruthy()
    })

    it('xattr command appears in the unsigned answer body', () => {
      renderWithI18n(<Probe tag="v0.4.0" />)
      expect(
        screen.getByText('xattr -dr com.apple.quarantine "/Applications/LazySheet.app"'),
      ).toBeTruthy()
    })

    it('sudo apt install command appears in the deb answer body', () => {
      renderWithI18n(<Probe tag="v0.4.0" />)
      expect(
        screen.getByText(
          'sudo apt install -y libjavascriptcoregtk-4.1-0 libsoup-3.0-0 libsoup-3.0-common libwebkit2gtk-4.1-0',
        ),
      ).toBeTruthy()
    })

    it('appimage extract+prune command appears in the appimage-egl answer body', () => {
      renderWithI18n(<Probe tag="v0.4.0" />)
      expect(
        screen.getByText(
          './LazySheet_0.4.0_amd64.AppImage --appimage-extract && rm -f squashfs-root/usr/lib/libwayland-*.so* squashfs-root/usr/lib/libEGL*.so* && ./squashfs-root/AppRun',
        ),
      ).toBeTruthy()
    })

    it('appimage-egl entry has version v0.4.0', () => {
      renderWithI18n(<Probe tag="v0.4.0" />)
      // entry is rendered, confirming it is included at this version
      expect(screen.getByTestId('question-appimage-egl')).toBeTruthy()
    })
  })

  describe('activeTag v9.9.9 (far future — all entries <= active)', () => {
    it('returns 3 entries', () => {
      renderWithI18n(<Probe tag="v9.9.9" />)
      expect(screen.getByTestId('count').textContent).toBe('3')
    })

    it('all three question texts are visible', () => {
      renderWithI18n(<Probe tag="v9.9.9" />)
      expect(
        screen.getByText(
          'macOS says LazySheet is "damaged" or from an "unidentified developer"',
        ),
      ).toBeTruthy()
      expect(
        screen.getByText('Installing the .deb on Linux fails with missing dependencies'),
      ).toBeTruthy()
      expect(
        screen.getByText('AppImage shows a blank window on Fedora or Arch?'),
      ).toBeTruthy()
    })
  })

  describe('activeTag v0.0.1 (below all entry versions — cumulative filter excludes all)', () => {
    it('returns 0 entries', () => {
      renderWithI18n(<Probe tag="v0.0.1" />)
      expect(screen.getByTestId('count').textContent).toBe('0')
    })

    it('unsigned question text is NOT in the document', () => {
      renderWithI18n(<Probe tag="v0.0.1" />)
      expect(
        screen.queryByText(
          'macOS says LazySheet is "damaged" or from an "unidentified developer"',
        ),
      ).toBeNull()
    })

    it('deb question text is NOT in the document', () => {
      renderWithI18n(<Probe tag="v0.0.1" />)
      expect(
        screen.queryByText('Installing the .deb on Linux fails with missing dependencies'),
      ).toBeNull()
    })

    it('appimage-egl question text is NOT in the document', () => {
      renderWithI18n(<Probe tag="v0.0.1" />)
      expect(
        screen.queryByText('AppImage shows a blank window on Fedora or Arch?'),
      ).toBeNull()
    })
  })
})
