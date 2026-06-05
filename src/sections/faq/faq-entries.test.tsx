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
    it('returns 2 entries', () => {
      renderWithI18n(<Probe tag="v0.4.0" />)
      expect(screen.getByTestId('count').textContent).toBe('2')
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
  })

  describe('activeTag v9.9.9 (far future — both entries <= active)', () => {
    it('returns 2 entries', () => {
      renderWithI18n(<Probe tag="v9.9.9" />)
      expect(screen.getByTestId('count').textContent).toBe('2')
    })

    it('both question texts are visible', () => {
      renderWithI18n(<Probe tag="v9.9.9" />)
      expect(
        screen.getByText(
          'macOS says LazySheet is "damaged" or from an "unidentified developer"',
        ),
      ).toBeTruthy()
      expect(
        screen.getByText('Installing the .deb on Linux fails with missing dependencies'),
      ).toBeTruthy()
    })
  })

  describe('activeTag v0.0.1 (below all entry versions — cumulative filter excludes both)', () => {
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
  })
})
