// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MockCursor } from './MockCursor'

afterEach(() => cleanup())

describe('MockCursor', () => {
  it('renders an SVG and positions itself via inline style', () => {
    const { container } = render(<MockCursor x={10} y={20} clicking={true} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.left).toBe('10%')
    expect(wrapper.style.top).toBe('20%')
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('renders a click ripple ring when clicking=true', () => {
    const { container } = render(<MockCursor x={10} y={20} clicking={true} />)
    expect(container.querySelector('.animate-ping')).not.toBeNull()
  })

  it('does NOT render a ripple ring when clicking=false', () => {
    const { container } = render(<MockCursor x={50} y={50} clicking={false} />)
    expect(container.querySelector('.animate-ping')).toBeNull()
  })

  it('defaults clicking to false', () => {
    const { container } = render(<MockCursor x={5} y={5} />)
    expect(container.querySelector('.animate-ping')).toBeNull()
  })
})
