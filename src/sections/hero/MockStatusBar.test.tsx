// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MockStatusBar } from './MockStatusBar'

afterEach(() => cleanup())

describe('MockStatusBar', () => {
  describe('selected=true', () => {
    it('shows range cell ref A1:C1', () => {
      render(<MockStatusBar selected={true} />)
      expect(screen.getByText('A1:C1')).toBeTruthy()
    })

    it('shows selection size with 3 cells', () => {
      render(<MockStatusBar selected={true} />)
      expect(screen.getByText(/3 cells/)).toBeTruthy()
    })

    it('shows zoom 100%', () => {
      render(<MockStatusBar selected={true} />)
      expect(screen.getByText('100%')).toBeTruthy()
    })
  })

  describe('selected=false', () => {
    it('shows single cell ref C1', () => {
      render(<MockStatusBar selected={false} />)
      expect(screen.getByText('C1')).toBeTruthy()
    })

    it('shows value 28', () => {
      render(<MockStatusBar selected={false} />)
      expect(screen.getByText('28')).toBeTruthy()
    })
  })
})
