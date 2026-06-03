// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'

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

  it('renders all 6 step titles', () => {
    renderWithI18n(<GuideView />)
    expect(screen.getByRole('heading', { level: 2, name: 'Open any file' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Browse instantly' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Filter columns' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Instant stats' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Group-by & aggregate' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Command palette' })).toBeTruthy()
  })

  it('renders 6 guide screenshot images', () => {
    renderWithI18n(<GuideView />)
    const imgs = screen
      .getAllByRole('img')
      .filter((img) => img.getAttribute('src')?.startsWith('/shots/guide/'))
    expect(imgs).toHaveLength(6)
  })
})
