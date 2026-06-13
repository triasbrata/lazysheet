// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MockGrid } from './MockGrid'

afterEach(() => cleanup())

describe('MockGrid', () => {
  describe('selected=true', () => {
    it('renders column headers A, B, C', () => {
      render(<MockGrid selected={true} />)
      expect(screen.getAllByText('A').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('B').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('C').length).toBeGreaterThanOrEqual(1)
    })

    it('renders data values 10, 18, 28', () => {
      render(<MockGrid selected={true} />)
      expect(screen.getByText('10')).toBeTruthy()
      expect(screen.getByText('18')).toBeTruthy()
      expect(screen.getByText('28')).toBeTruthy()
    })

    it('renders marching-ants border-dashed overlay', () => {
      const { container } = render(<MockGrid selected={true} />)
      expect(container.querySelector('.border-dashed')).toBeTruthy()
    })
  })

  describe('selected=false', () => {
    it('renders column headers A, B, C', () => {
      render(<MockGrid selected={false} />)
      expect(screen.getAllByText('A').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('B').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('C').length).toBeGreaterThanOrEqual(1)
    })

    it('renders data values without overlay', () => {
      render(<MockGrid selected={false} />)
      expect(screen.getByText('10')).toBeTruthy()
      expect(screen.getByText('18')).toBeTruthy()
      expect(screen.getByText('28')).toBeTruthy()
    })

    it('does NOT render marching-ants border-dashed overlay', () => {
      const { container } = render(<MockGrid selected={false} />)
      expect(container.querySelector('.border-dashed')).toBeNull()
    })
  })
})
