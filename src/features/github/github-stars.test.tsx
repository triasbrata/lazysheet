// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'

import { renderWithI18n } from '#/test/i18n'

// Mock the hook — must be before the component import
vi.mock('./use-github-stars', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./use-github-stars')>()
  return {
    ...actual, // keep real formatStars
    useGithubStars: vi.fn(() => ({ stars: null, loading: true })),
  }
})

import { GithubStars } from './github-stars'
import { useGithubStars } from './use-github-stars'

afterEach(cleanup)

describe('GithubStars', () => {
  it('renders nothing when stars is null', () => {
    vi.mocked(useGithubStars).mockReturnValue({ stars: null, loading: true })
    const { container } = renderWithI18n(<GithubStars />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the formatted star count when stars are available', () => {
    vi.mocked(useGithubStars).mockReturnValue({ stars: 1500, loading: false })
    renderWithI18n(<GithubStars />)
    // formatStars(1500) === '1.5k'
    expect(screen.getByText('1.5k')).toBeTruthy()
  })

  it('has an aria-label with the star count', () => {
    vi.mocked(useGithubStars).mockReturnValue({ stars: 1500, loading: false })
    renderWithI18n(<GithubStars />)
    // en.json: "githubStarsAria": "{{count}} GitHub stars"
    expect(screen.getByLabelText('1500 GitHub stars')).toBeTruthy()
  })

  it('applies the className prop to the rendered element', () => {
    vi.mocked(useGithubStars).mockReturnValue({ stars: 42, loading: false })
    renderWithI18n(<GithubStars className="my-custom-class" />)
    const el = screen.getByLabelText('42 GitHub stars')
    expect(el.classList.contains('my-custom-class')).toBe(true)
  })
})
