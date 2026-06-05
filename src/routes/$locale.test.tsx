// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import React from 'react'

// Stub createFileRoute so Route.options holds the raw options object,
// and Route.useParams delegates to our per-test mutable variable.
// We keep the real redirect, isLocale, DEFAULT_LOCALE, etc. intact.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (opts: unknown) => ({
      options: opts,
      useParams: () => mockLocaleParams,
    }),
    // Outlet — used inside LocaleLayout; stub as passthrough
    Outlet: () => null,
    // useParams hook (also used directly in some components)
    useParams: () => mockLocaleParams,
  }
})

// i18n-related stubs — no need for the actual i18next instance here
vi.mock('#/i18n/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#/i18n/config')>()
  return {
    ...actual,
    createI18nInstance: vi.fn(() => ({
      language: 'en',
      use: vi.fn().mockReturnThis(),
      init: vi.fn(),
      t: (k: string) => k,
      on: vi.fn(),
      off: vi.fn(),
      isInitialized: true,
      store: { data: {} },
    })),
  }
})

// Suppress I18nextProvider's requirement for a real i18n instance
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    I18nextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

// Route.useParams is driven by this mutable reference
let mockLocaleParams: { locale: string } = { locale: 'en' }

// Import AFTER mocks are established
import { Route } from '#/routes/$locale'
import { getSeoMeta, getHreflangLinks } from '#/i18n/seo'
import { DEFAULT_LOCALE } from '#/i18n/config'
import { render } from '@testing-library/react'

afterEach(() => {
  cleanup()
  mockLocaleParams = { locale: 'en' }
})

// ---------------------------------------------------------------------------
// beforeLoad
// ---------------------------------------------------------------------------
describe('$locale Route.beforeLoad', () => {
  it('does NOT throw for a valid locale ("en")', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    expect(() => opts.beforeLoad({ params: { locale: 'en' } })).not.toThrow()
  })

  it('does NOT throw for all supported locales', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    for (const locale of ['en', 'id', 'zh', 'es']) {
      expect(() => opts.beforeLoad({ params: { locale } })).not.toThrow()
    }
  })

  it('throws a redirect to /$locale with DEFAULT_LOCALE for an invalid locale', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    try {
      opts.beforeLoad({ params: { locale: 'fr' } })
      throw new Error('expected beforeLoad to throw')
    } catch (thrown: unknown) {
      // TanStack redirect throws a Response-like object
      const r = thrown as { options?: { to?: string; params?: { locale?: string } } }
      expect(r.options?.to).toBe('/$locale')
      expect(r.options?.params?.locale).toBe(DEFAULT_LOCALE)
    }
  })

  it('throws a redirect for an empty-string locale', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    let threw = false
    try {
      opts.beforeLoad({ params: { locale: '' } })
    } catch {
      threw = true
    }
    expect(threw).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// head
// ---------------------------------------------------------------------------
describe('$locale Route.head', () => {
  it('returns the expected meta and links shape for a valid locale ("en")', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    const result = opts.head({ params: { locale: 'en' } })
    const expectedMeta = getSeoMeta('en')
    const expectedLinks = getHreflangLinks('en')
    expect(result).toEqual({ meta: expectedMeta, links: expectedLinks })
  })

  it('falls back to DEFAULT_LOCALE for an invalid locale ("fr")', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    const result = opts.head({ params: { locale: 'fr' } })
    const expectedMeta = getSeoMeta(DEFAULT_LOCALE)
    const expectedLinks = getHreflangLinks(DEFAULT_LOCALE)
    expect(result).toEqual({ meta: expectedMeta, links: expectedLinks })
  })

  it('returns a non-empty meta array with a title entry', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    const { meta } = opts.head({ params: { locale: 'en' } })
    expect(Array.isArray(meta)).toBe(true)
    expect(meta.length).toBeGreaterThan(0)
    const titleEntry = meta.find((m: Record<string, string>) => 'title' in m)
    expect(titleEntry).toBeTruthy()
  })

  it('returns links with hreflang entries', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    const { links } = opts.head({ params: { locale: 'en' } })
    expect(Array.isArray(links)).toBe(true)
    expect(links.every((l: Record<string, string>) => l.rel === 'alternate')).toBe(true)
    const xDefault = links.find((l: Record<string, string>) => l.hreflang === 'x-default')
    expect(xDefault).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// LocaleLayout component (Route.options.component)
// ---------------------------------------------------------------------------
describe('LocaleLayout component', () => {
  it('renders children (Outlet) for a valid locale "en"', () => {
    mockLocaleParams = { locale: 'en' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    const LocaleLayout = opts.component as React.ComponentType
    const { container } = render(
      React.createElement(LocaleLayout),
    )
    // I18nextProvider is mocked to pass-through; Outlet is stubbed to null → renders without error
    expect(container).toBeTruthy()
  })

  it('renders without crashing for an invalid locale "fr" (falls back to DEFAULT_LOCALE)', () => {
    mockLocaleParams = { locale: 'fr' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    const LocaleLayout = opts.component as React.ComponentType
    expect(() => render(React.createElement(LocaleLayout))).not.toThrow()
  })

  it('renders the Outlet for all supported locales', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    const LocaleLayout = opts.component as React.ComponentType
    for (const locale of ['en', 'id', 'zh', 'es']) {
      cleanup()
      mockLocaleParams = { locale }
      expect(() => render(React.createElement(LocaleLayout))).not.toThrow()
    }
  })
})
