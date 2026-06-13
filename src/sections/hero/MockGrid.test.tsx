// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MockGrid } from './MockGrid'

afterEach(() => cleanup())

describe('MockGrid', () => {
  it('renders column headers A, B, C', () => {
    render(<MockGrid />)
    expect(screen.getAllByText('A').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('B').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('C').length).toBeGreaterThanOrEqual(1)
  })

  it('renders data values 10, 18, 28', () => {
    render(<MockGrid />)
    expect(screen.getByText('10')).toBeTruthy()
    expect(screen.getByText('18')).toBeTruthy()
    expect(screen.getByText('28')).toBeTruthy()
  })

  it('renders the marching-ants selection', () => {
    const { container } = render(<MockGrid />)
    expect(container.querySelector('.mock-selection-ants')).toBeTruthy()
  })

  it('ants rect has width 368', () => {
    const { container } = render(<MockGrid />)
    const rect = container.querySelector('.mock-selection-ants')
    expect(rect?.getAttribute('width')).toBe('368')
  })
})
