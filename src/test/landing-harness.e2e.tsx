/**
 * Landing page harness for browser-mode e2e tests.
 *
 * Composes the real sections (Nav, Hero, Formats, Faq, BentoGrid, Footer)
 * inside an English I18nextProvider. Router and server deps are mocked via
 * vi.mock at the TEST FILE level (mocks are hoisted to top of test file).
 *
 * renderLanding() → render(<LandingHarness/>) using vitest-browser-react.
 */

import React from 'react'
import { render } from 'vitest-browser-react'
import { I18nextProvider } from 'react-i18next'
import { enInstance } from '#/test/i18n'
import { Nav } from '#/components/site/nav'
import { Footer } from '#/components/site/footer'
import { Hero, Formats, Faq } from '#/routes/$locale/index'
import { BentoGrid } from '#/sections/bento/BentoGrid'
import { useBentoTiles } from '#/sections/bento/features'
import type { DownloadData } from '#/lib/releases-data'

// Minimal fixture — satisfies DownloadData + Hero/DownloadButton requirements
// without triggering any server fn calls.
export const FIXTURE: DownloadData = {
  serverOS: 'macOS',
  releases: [],
  release: null,
}

/** Inner component so hooks (useBentoTiles) run inside a component tree. */
function BentoSection() {
  const tiles = useBentoTiles('v0.5.0')
  return (
    <section>
      <BentoGrid tiles={tiles} />
    </section>
  )
}

/** Composed landing harness — real sections, mocked router + server deps. */
export function LandingHarness() {
  return (
    <I18nextProvider i18n={enInstance}>
      <div>
        <Nav overHero />
        <main>
          <Hero data={FIXTURE} />
          <Formats />
          <BentoSection />
          <Faq activeTag="v0.5.0" />
        </main>
        <Footer />
      </div>
    </I18nextProvider>
  )
}

/** Render the full landing harness in the browser iframe. */
export function renderLanding() {
  return render(<LandingHarness />)
}
