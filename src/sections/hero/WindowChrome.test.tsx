// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { WindowChrome } from './WindowChrome'
import { FILE_NAME } from './mock-data'

afterEach(() => cleanup())

describe('WindowChrome', () => {
  it('renders FILE_NAME', () => {
    render(<WindowChrome />)
    expect(screen.getByText(FILE_NAME)).toBeTruthy()
  })

  it('renders "Search commands…"', () => {
    render(<WindowChrome />)
    expect(screen.getByText('Search commands…')).toBeTruthy()
  })

  it('renders keyboard shortcut ⌘P', () => {
    render(<WindowChrome />)
    expect(screen.getByText('⌘P')).toBeTruthy()
  })

  it('renders exactly 3 traffic-light dots', () => {
    const { container } = render(<WindowChrome />)
    const dots = container.querySelectorAll('.rounded-full')
    expect(dots.length).toBe(3)
  })

  it('renders PanelRight icon', () => {
    const { container } = render(<WindowChrome />)
    expect(container.querySelector('svg.lucide-panel-right')).toBeTruthy()
  })

  it('does NOT render Settings or Sun icons', () => {
    const { container } = render(<WindowChrome />)
    expect(container.querySelector('svg.lucide-settings')).toBeNull()
    expect(container.querySelector('svg.lucide-sun')).toBeNull()
  })
})
