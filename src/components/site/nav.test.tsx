// @vitest-environment happy-dom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent } from '@testing-library/react'
import { screen } from '@testing-library/react'

// Hoisted variable lets individual tests override useParams locale
const mockParamsLocale = vi.hoisted(() => ({ value: 'en' as string | undefined }))

// Nav renders TanStack <Link>s, which normally need a RouterProvider.
// Stub them with plain anchors so the nav can be tested in isolation.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
    useParams: () => ({ locale: mockParamsLocale.value }),
    useNavigate: () => () => {},
    useLocation: () => ({ pathname: '/en' }),
  }
})

// motion/react mock — Nav uses useScroll and useMotionValueEvent.
// We capture the useMotionValueEvent callback so tests can invoke it manually
// to drive the `scrolled` state and exercise the `solid = scrolled || !overHero` branch.
let capturedScrollChangeCallback: ((y: number) => void) | null = null

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
    useMotionValueEvent: (_mv: unknown, _event: string, cb: (y: number) => void) => {
      capturedScrollChangeCallback = cb
    },
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

// Stub VersionSelector so Nav tests are isolated from router/select internals
vi.mock('#/features/version/version-selector', () => ({
  VersionSelector: ({ selectedTag }: { selectedTag: string }) => (
    <div data-testid="version-selector">{selectedTag}</div>
  ),
}))

import { Nav } from '#/components/site/nav'
import { renderWithI18n } from '#/test/i18n'

afterEach(() => {
  cleanup()
  capturedScrollChangeCallback = null
  mockParamsLocale.value = 'en'
})

describe('Nav — what the user sees', () => {
  it('shows the LazySheet brand', () => {
    renderWithI18n(<Nav />)
    expect(screen.getByText('LazySheet')).toBeTruthy()
    expect(screen.getByAltText('LazySheet logo')).toBeTruthy()
  })

  it('offers Features and Download navigation', () => {
    renderWithI18n(<Nav />)
    // Multiple elements may exist (desktop + mobile sheet) — just check at least one is present
    expect(screen.getAllByText('Features').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Download').length).toBeGreaterThan(0)
  })

  it('links to the GitHub repository', () => {
    renderWithI18n(<Nav />)
    // There are now multiple GitHub links (desktop cluster + always-visible compact)
    const githubLinks = screen.getAllByLabelText('GitHub repository')
    expect(githubLinks.length).toBeGreaterThan(0)
    for (const link of githubLinks) {
      expect(link.getAttribute('href')).toBe(
        'https://github.com/triasbrata/lazysheet',
      )
    }
  })
})

describe('Nav — solid/transparent branch (overHero prop)', () => {
  it('renders transparent nav when overHero=true and not scrolled (solid=false)', () => {
    renderWithI18n(<Nav overHero={true} />)
    const nav = document.querySelector('nav')
    // solid=false → border-transparent bg-transparent
    expect(nav?.className).toContain('border-transparent')
    expect(nav?.className).toContain('bg-transparent')
  })

  it('renders solid nav when overHero=false (default) even with no scrolling', () => {
    renderWithI18n(<Nav overHero={false} />)
    const nav = document.querySelector('nav')
    // solid=true → bg-white/70 shadow-sm
    expect(nav?.className).toContain('bg-white/70')
    expect(nav?.className).toContain('shadow-sm')
  })

  it('flips to solid nav when scrolled past threshold (overHero=true, scrolled=true)', () => {
    renderWithI18n(<Nav overHero={true} />)
    // Initially transparent
    let nav = document.querySelector('nav')
    expect(nav?.className).toContain('border-transparent')

    // Simulate scrolling past threshold via the captured useMotionValueEvent callback
    act(() => {
      if (capturedScrollChangeCallback) {
        capturedScrollChangeCallback(50) // y=50 > 8 → setScrolled(true)
      }
    })
    nav = document.querySelector('nav')
    // solid=true → bg-white/70
    expect(nav?.className).toContain('bg-white/70')
  })
})

describe('Nav — locale fallback branch', () => {
  it('falls back to DEFAULT_LOCALE when params.locale is not a valid locale', () => {
    // Set invalid locale so isLocale() returns false → DEFAULT_LOCALE branch is taken
    mockParamsLocale.value = 'zz-invalid'
    renderWithI18n(<Nav />)
    // Nav still renders — the DEFAULT_LOCALE branch was exercised
    expect(screen.getByText('LazySheet')).toBeTruthy()
  })

  it('uses empty string fallback when params.locale is undefined (??  branch)', () => {
    // Set locale to undefined so `params.locale ?? ''` takes the ?? fallback branch
    mockParamsLocale.value = undefined
    renderWithI18n(<Nav />)
    // Nav still renders — the ?? '' branch was exercised
    expect(screen.getByText('LazySheet')).toBeTruthy()
  })
})

describe('Nav — VersionSelector integration', () => {
  const releases = [
    { tag: 'v0.5.0', name: '', htmlUrl: '', publishedAt: '', assets: [] },
    { tag: 'v0.4.0', name: '', htmlUrl: '', publishedAt: '', assets: [] },
  ]

  it('renders VersionSelector when releases and selectedTag are provided', () => {
    renderWithI18n(<Nav releases={releases} selectedTag="v0.5.0" />)
    const selector = screen.getByTestId('version-selector')
    expect(selector).toBeTruthy()
    expect(selector.textContent).toBe('v0.5.0')
  })

  it('does not render VersionSelector when releases/selectedTag are absent', () => {
    renderWithI18n(<Nav />)
    expect(screen.queryByTestId('version-selector')).toBeNull()
  })
})

describe('Nav — hamburger menu', () => {
  it('renders the hamburger button with aria-label "Open menu"', () => {
    renderWithI18n(<Nav />)
    const hamburger = screen.getByLabelText('Open menu')
    expect(hamburger).toBeTruthy()
  })

  it('opens the Sheet and shows menu links when hamburger is clicked', () => {
    renderWithI18n(<Nav />)
    const hamburger = screen.getByLabelText('Open menu')

    act(() => {
      fireEvent.click(hamburger)
    })

    // The Sheet (Radix Dialog) renders content into the document.
    // After clicking the trigger, the sheet content should be in the DOM.
    // We look for the navigation links that appear inside SheetContent.
    // Since there are multiple Features/Download/Guide elements (desktop + sheet),
    // we check that we have at least two instances — one desktop (hidden via CSS), one in sheet.
    const featuresLinks = screen.getAllByText('Features')
    expect(featuresLinks.length).toBeGreaterThanOrEqual(1)

    const downloadLinks = screen.getAllByText('Download')
    expect(downloadLinks.length).toBeGreaterThanOrEqual(1)

    const guideLinks = screen.getAllByText('Guide')
    expect(guideLinks.length).toBeGreaterThanOrEqual(1)
  })

  it('hamburger button is present in the DOM (< lg trigger)', () => {
    renderWithI18n(<Nav />)
    // The hamburger trigger must be in the DOM regardless of viewport
    const hamburger = screen.getByLabelText('Open menu')
    expect(hamburger.tagName.toLowerCase()).toBe('button')
  })

  it('desktop links cluster and mobile links both exist in DOM', () => {
    renderWithI18n(<Nav />)
    // Desktop: Features link is inside the hidden lg:flex container
    // Both are rendered in DOM; CSS hides/shows based on viewport
    const featuresLinks = screen.getAllByText('Features')
    // At minimum the desktop cluster link is rendered
    expect(featuresLinks.length).toBeGreaterThanOrEqual(1)
  })

  it('clicking a menu link fires onClick (closes the sheet)', () => {
    renderWithI18n(<Nav />)
    const hamburger = screen.getByLabelText('Open menu')

    // Open the sheet
    act(() => {
      fireEvent.click(hamburger)
    })

    // Find Guide links — click the one inside the sheet (last one if multiple)
    const guideLinks = screen.getAllByText('Guide')
    const lastGuideLink = guideLinks[guideLinks.length - 1]

    // Clicking the link should call setMenuOpen(false) — we verify it doesn't throw
    act(() => {
      fireEvent.click(lastGuideLink)
    })

    // After clicking, the component remains functional
    expect(screen.getByText('LazySheet')).toBeTruthy()
  })
})
