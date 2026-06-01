// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { Footer } from '#/components/site/footer'

afterEach(cleanup)

describe('Footer — what the user sees', () => {
  it('shows the copyright line', () => {
    render(<Footer />)
    expect(screen.getByText(/LazySheet\. Built for speed\./i)).toBeTruthy()
  })

  it('links to GitHub', () => {
    render(<Footer />)
    const github = screen.getByText('GitHub')
    expect(github.getAttribute('href')).toBe(
      'https://github.com/triasbrata/lazysheet',
    )
  })
})
