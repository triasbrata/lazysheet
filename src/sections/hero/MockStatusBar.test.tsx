// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MockStatusBar } from './MockStatusBar'

afterEach(() => cleanup())

describe('MockStatusBar', () => {
  it('shows A1:C1', () => {
    render(<MockStatusBar version="v0.6.0" />)
    expect(screen.getByText('A1:C1')).toBeTruthy()
  })

  it('shows text matching /3 cells/', () => {
    render(<MockStatusBar version="v0.6.0" />)
    expect(screen.getByText(/3 cells/)).toBeTruthy()
  })

  it('shows 100%', () => {
    render(<MockStatusBar version="v0.6.0" />)
    expect(screen.getByText('100%')).toBeTruthy()
  })

  it('shows LazySheet v0.6.0', () => {
    render(<MockStatusBar version="v0.6.0" />)
    expect(screen.getByText('LazySheet v0.6.0')).toBeTruthy()
  })
})
