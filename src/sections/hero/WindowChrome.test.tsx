// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { WindowChrome } from './WindowChrome'

afterEach(() => cleanup())

describe('WindowChrome', () => {
  it('renders the filename from FILE_NAME', () => {
    render(<WindowChrome />)
    expect(screen.getByText('Untitled spreadsheet (7).xlsx')).toBeTruthy()
  })

  it('renders the search placeholder text', () => {
    render(<WindowChrome />)
    expect(screen.getByText('Search commands…')).toBeTruthy()
  })

  it('renders the keyboard shortcut hint', () => {
    render(<WindowChrome />)
    expect(screen.getByText('⌘P')).toBeTruthy()
  })

  it('renders exactly 3 traffic-light dots', () => {
    const { container } = render(<WindowChrome />)
    const dots = container.querySelectorAll('.rounded-full')
    expect(dots.length).toBe(3)
  })
})
