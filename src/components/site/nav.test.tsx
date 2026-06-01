// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

// Nav renders TanStack <Link>s, which normally need a RouterProvider.
// Stub them with plain anchors so the nav can be tested in isolation.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  }
})

import { Nav } from '#/components/site/nav'

afterEach(cleanup)

describe('Nav — what the user sees', () => {
  it('shows the LazySheet brand', () => {
    render(<Nav />)
    expect(screen.getByText('LazySheet')).toBeTruthy()
    expect(screen.getByAltText('LazySheet logo')).toBeTruthy()
  })

  it('offers Features and Download navigation', () => {
    render(<Nav />)
    expect(screen.getByText('Features')).toBeTruthy()
    expect(screen.getByText('Download')).toBeTruthy()
  })

  it('links to the GitHub repository', () => {
    render(<Nav />)
    const github = screen.getByLabelText('GitHub repository')
    expect(github.getAttribute('href')).toBe(
      'https://github.com/triasbrata/lazysheet',
    )
  })
})
