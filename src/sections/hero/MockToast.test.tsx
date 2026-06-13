// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MockToast } from './MockToast'
import { TOAST_TEXT } from './mock-data'

afterEach(() => cleanup())

describe('MockToast', () => {
  it('shows toast text when visible=true and has opacity-100 class', () => {
    const { container } = render(<MockToast visible={true} />)
    expect(screen.getByText(TOAST_TEXT)).toBeTruthy()
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('opacity-100')
  })

  it('keeps toast text in DOM but with opacity-0 when visible=false', () => {
    const { container } = render(<MockToast visible={false} />)
    expect(screen.getByText(TOAST_TEXT)).toBeTruthy()
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('opacity-0')
  })
})
