// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'

// GuideView pulls in <Nav> and <Link>s, which normally need a RouterProvider.
// Stub them with plain anchors so we can test the page in isolation —
// no router, no loader, no network.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
    useParams: () => ({ locale: 'en' }),
    useNavigate: () => () => {},
    useLocation: () => ({ pathname: '/guide' }),
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

import { GuideView } from './guide'
import { renderWithI18n } from '#/test/i18n'

afterEach(cleanup)

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
})
