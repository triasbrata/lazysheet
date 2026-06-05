// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import React from 'react'

// GuideView pulls in <Nav> and <Link>s, which normally need a RouterProvider.
// Stub them with plain anchors so we can test the page in isolation —
// no router, no loader, no network.
// createFileRoute is also mocked so we can access Route.options.head.
// useParams is a vi.fn() (hoisted) so we can override it per-test.
const { mockUseParams } = vi.hoisted(() => ({
  mockUseParams: vi.fn(() => ({ locale: 'en' as string | undefined })),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
    useParams: (...args: unknown[]) => mockUseParams(...args),
    useNavigate: () => () => {},
    useLocation: () => ({ pathname: '/guide' }),
    createFileRoute: () => (opts: unknown) => ({
      options: opts,
      useParams: () => ({ locale: 'en' }),
    }),
  }
})

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

// Stub FeedbackDialog so it doesn't pull in createServerFn (server-only)
vi.mock('#/features/feedback/feedback-dialog', () => ({
  FeedbackDialog: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}))

// Stub GithubStars so it doesn't pull in the fetch hook
vi.mock('#/features/github/github-stars', () => ({
  GithubStars: () => null,
}))

import { GuideView, Route } from './guide'
import { renderWithI18n } from '#/test/i18n'
import { DEFAULT_LOCALE } from '#/i18n/config'

afterEach(() => {
  cleanup()
  mockUseParams.mockReset()
  mockUseParams.mockImplementation(() => ({ locale: 'en' }))
})

describe('Guide page — what the user sees', () => {
  it('shows the "How to use LazySheet" heading', () => {
    renderWithI18n(<GuideView />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'How to use LazySheet' }),
    ).toBeTruthy()
  })

  it('renders all 9 step titles', () => {
    renderWithI18n(<GuideView />)
    expect(screen.getByRole('heading', { level: 2, name: 'Open any file' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Browse instantly' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Filter columns' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Instant stats' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Group-by & aggregate' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Command palette' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Set the header row' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Copy in any format' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Drag out to any app' })).toBeTruthy()
  })

  it('renders 9 guide screenshot images', () => {
    renderWithI18n(<GuideView />)
    const imgs = screen
      .getAllByRole('img')
      .filter((img) => img.getAttribute('src')?.startsWith('/shots/guide/'))
    expect(imgs).toHaveLength(9)
  })

  it('each step image is a zoom trigger (closed by default, no dialog shown)', () => {
    renderWithI18n(<GuideView />)
    expect(
      screen.getByRole('button', { name: 'Set the header row' }),
    ).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('clicking a step image opens a zoom lightbox with its title and description', () => {
    renderWithI18n(<GuideView />)
    fireEvent.click(screen.getByRole('button', { name: 'Set the header row' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    // 80/20 lightbox: enlarged image + the step's description text
    expect(within(dialog).getByText(/Mark as header/)).toBeTruthy()
    expect(
      within(dialog).getByRole('heading', { name: 'Set the header row' }),
    ).toBeTruthy()
  })

  it('even-numbered step row swaps column order (md:order-2 / md:order-1)', () => {
    // Step 2 ("Browse instantly") is even → textCol gets md:order-2, imageCol gets md:order-1
    const { container } = renderWithI18n(<GuideView />)
    // Find the grid row that contains the "Browse instantly" heading
    const browseHeading = screen.getByRole('heading', { level: 2, name: 'Browse instantly' })
    // The text column wrapper should have md:order-2
    const textColWrapper = browseHeading.closest('[class*="order-2"]') as HTMLElement | null
    expect(textColWrapper).toBeTruthy()
    // And the sibling imageCol wrapper should have md:order-1
    const gridRow = textColWrapper?.parentElement
    const orderOneDiv = gridRow?.querySelector('[class*="order-1"]')
    expect(orderOneDiv).toBeTruthy()
    void container
  })
})

// ---------------------------------------------------------------------------
// Route.options.head — invalid locale fallback
// ---------------------------------------------------------------------------
describe('$locale/guide Route.head', () => {
  it('uses valid locale for head meta when locale is supported', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    const result = opts.head({ params: { locale: 'en' } })
    expect(result.meta).toBeTruthy()
    const titleEntry = result.meta.find((m: Record<string, string>) => 'title' in m)
    expect(titleEntry?.title).toBeTruthy()
  })

  it('falls back to DEFAULT_LOCALE for an invalid locale in head', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    // 'fr' is not a supported locale → should use DEFAULT_LOCALE
    const resultFallback = opts.head({ params: { locale: 'fr' } })
    const resultDefault = opts.head({ params: { locale: DEFAULT_LOCALE } })
    // Both should return the same title (the DEFAULT_LOCALE guide title)
    const titleFallback = resultFallback.meta.find((m: Record<string, string>) => 'title' in m)
    const titleDefault = resultDefault.meta.find((m: Record<string, string>) => 'title' in m)
    expect(titleFallback?.title).toBe(titleDefault?.title)
  })
})

// ---------------------------------------------------------------------------
// Guide wrapper (Route.options.component) — covers the unexported Guide fn
// ---------------------------------------------------------------------------
describe('Guide wrapper (Route.options.component)', () => {
  it('renders without crashing via the route component', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    const GuideWrapper = opts.component as React.ComponentType
    expect(() => renderWithI18n(React.createElement(GuideWrapper))).not.toThrow()
  })

  it('renders the guide heading when called via the route component', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    const GuideWrapper = opts.component as React.ComponentType
    renderWithI18n(React.createElement(GuideWrapper))
    expect(
      screen.getByRole('heading', { level: 1, name: 'How to use LazySheet' }),
    ).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// GuideView locale fallback branch — when params.locale is undefined
// ---------------------------------------------------------------------------
describe('GuideView locale fallback branch', () => {
  it('renders correctly when locale param is undefined (falls back to DEFAULT_LOCALE)', () => {
    // Override useParams to return undefined locale to hit the ?? '' branch
    mockUseParams.mockReturnValue({ locale: undefined })
    renderWithI18n(<GuideView />)
    // Should still render the guide heading using the default locale
    expect(
      screen.getByRole('heading', { level: 1, name: 'How to use LazySheet' }),
    ).toBeTruthy()
  })
})
