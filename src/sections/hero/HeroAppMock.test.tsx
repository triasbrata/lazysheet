// @vitest-environment happy-dom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import React from 'react'

vi.mock('motion/react', () => {
  const make = (tag: string) => ({ children, style, whileHover, initial, animate, variants, transition, ...rest }: any) =>
    React.createElement(tag, rest, children)
  const motion = new Proxy({}, { get: (_t, tag: string) => make(tag) })
  return {
    motion,
    useScroll: () => ({ scrollYProgress: { get: () => 0, on: () => () => {} } }),
    useTransform: (_mv: any, _in: any, out: any) => ({ get: () => (Array.isArray(out) ? out[0] : 0) }),
    useReducedMotion: () => false,
    useMotionValueEvent: vi.fn(),
  }
})

import { HeroAppMock } from './HeroAppMock'
import { renderWithI18n } from '#/test/i18n'
import { screen, act } from '@testing-library/react'
import { FILE_NAME } from './mock-data'

afterEach(() => cleanup())

describe('HeroAppMock', () => {
  it('renders chrome, grid, and status bar', () => {
    renderWithI18n(<HeroAppMock />)
    expect(screen.getByText(FILE_NAME)).toBeTruthy()
    // Grid always shows row 1 data (10, 18 appear once; 28 also in status bar)
    expect(screen.getByText('10')).toBeTruthy()
    expect(screen.getByText('18')).toBeTruthy()
    expect(screen.getAllByText('28').length).toBeGreaterThan(0)
    // Status bar present
    expect(screen.getByText('C1')).toBeTruthy()
  })

  it('has accessible img role with dashboard label', () => {
    renderWithI18n(<HeroAppMock />)
    expect(screen.getByRole('img', { name: /dashboard/i })).toBeTruthy()
  })

  it('resize handler runs without error and component still renders', () => {
    renderWithI18n(<HeroAppMock />)
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(screen.getByText(FILE_NAME)).toBeTruthy()
  })
})
