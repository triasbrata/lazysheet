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

    it('v0.5.0-only entries are NOT present at v0.4.0', () => {
      renderWithI18n(<Probe tag="v0.4.0" />)
      expect(screen.queryByTestId('question-sql-export')).toBeNull()
      expect(screen.queryByTestId('question-auto-update')).toBeNull()
      expect(screen.queryByTestId('question-appimage-v5')).toBeNull()
      expect(screen.queryByTestId('question-formulas')).toBeNull()
    })
  })

  describe('activeTag v9.9.9 (far future — all entries <= active)', () => {
    it('returns 7 entries', () => {
      renderWithI18n(<Probe tag="v9.9.9" />)
      expect(screen.getByTestId('count').textContent).toBe('7')
    })

    it('all three original question texts are visible', () => {
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

  describe('activeTag v0.5.0', () => {
    it('returns 7 entries', () => {
      renderWithI18n(<Probe tag="v0.5.0" />)
      expect(screen.getByTestId('count').textContent).toBe('7')
    })

    it('question-auto-update is present', () => {
      renderWithI18n(<Probe tag="v0.5.0" />)
      expect(screen.getByTestId('question-auto-update')).toBeTruthy()
    })

    it('question-appimage-v5 is present', () => {
      renderWithI18n(<Probe tag="v0.5.0" />)
      expect(screen.getByTestId('question-appimage-v5')).toBeTruthy()
    })

    it('question-sql-export is present', () => {
      renderWithI18n(<Probe tag="v0.5.0" />)
      expect(screen.getByTestId('question-sql-export')).toBeTruthy()
    })

    it('question-formulas is present', () => {
      renderWithI18n(<Probe tag="v0.5.0" />)
      expect(screen.getByTestId('question-formulas')).toBeTruthy()
    })

    it('auto-update question text matches', () => {
      renderWithI18n(<Probe tag="v0.5.0" />)
      expect(screen.getByText('How do updates work?')).toBeTruthy()
    })

    it('appimage-v5 question text matches', () => {
      renderWithI18n(<Probe tag="v0.5.0" />)
      expect(screen.getByText('AppImage shows a blank window on Linux (v0.5.0)?')).toBeTruthy()
    })

    it('sql-export question text matches', () => {
      renderWithI18n(<Probe tag="v0.5.0" />)
      expect(screen.getByText('How do I export my sheet to SQL?')).toBeTruthy()
    })

    it('formulas question text matches', () => {
      renderWithI18n(<Probe tag="v0.5.0" />)
      expect(screen.getByText('Can I use formulas in cells?')).toBeTruthy()
    })

    it('appimage-v5 CopyCommand contains LazySheet_0.5.0_amd64.AppImage', () => {
      renderWithI18n(<Probe tag="v0.5.0" />)
      expect(
        screen.getByText(
          './LazySheet_0.5.0_amd64.AppImage --appimage-extract && rm -f squashfs-root/usr/lib/libwayland-*.so* squashfs-root/usr/lib/libEGL*.so* && ./squashfs-root/AppRun',
        ),
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
