// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { screen } from '@testing-library/react'

import { Footer } from '#/components/site/footer'
import { renderWithI18n } from '#/test/i18n'

afterEach(cleanup)

describe('Footer — what the user sees', () => {
  it('shows the copyright line', () => {
    renderWithI18n(<Footer />)
    expect(screen.getByText(/LazySheet\. Built for speed\./i)).toBeTruthy()
  })

  it('links to GitHub', () => {
    renderWithI18n(<Footer />)
    const github = screen.getByText('GitHub')
    expect(github.getAttribute('href')).toBe(
      'https://github.com/triasbrata/lazysheet',
    )
  })
})
