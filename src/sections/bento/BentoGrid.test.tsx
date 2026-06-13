// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import React from 'react'

// --- motion/react mock ---
vi.mock('motion/react', () => {
  function makeMotionComponent(tag: string) {
    return function MotionEl({
      children,
      style,
      className,
      onMouseMove,
      onMouseLeave,
      whileHover,
      initial,
      variants,
      transition,
      ...rest
    }: React.HTMLAttributes<HTMLElement> & { [key: string]: unknown }) {
      return React.createElement(
        tag,
        { style, className, onMouseMove, onMouseLeave, ...rest },
        children,
      )
    }
  }

  const motion = new Proxy(
    {},
    {
      get(_target, tag: string) {
        return makeMotionComponent(tag)
      },
    },
  )

  return {
    motion,
    useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
    useTransform: (_mv: unknown, _in: unknown, out: unknown[]) => ({
      get: () => (Array.isArray(out) ? out[0] : 0),
    }),
    useMotionValue: (v: number) => ({ get: () => v, set: vi.fn() }),
    useSpring: (mv: unknown) => mv,
    useReducedMotion: () => false,
    useMotionValueEvent: vi.fn(),
  }
})

// --- useMediaQuery mock ---
vi.mock('#/lib/use-media-query', () => ({
  useMediaQuery: vi.fn(),
}))

import { BentoGrid } from './BentoGrid'
import type { BentoTile } from './features'
import { renderWithI18n } from '#/test/i18n'
import { useMediaQuery } from '#/lib/use-media-query'

afterEach(cleanup)

const fakeIcon = ({ className }: { className?: string }) => (
  <svg className={className} data-testid="fake-icon" />
)

const fakeTiles: BentoTile[] = [
  {
    id: 'tile-1',
    span: 'xl:col-span-4',
    title: 'Tile One',
    description: 'Desc one',
    tone: 'tint',
    icon: fakeIcon,
  },
  {
    id: 'tile-2',
    span: 'xl:col-span-4',
    title: 'Tile Two',
    tone: 'accent',
    icon: fakeIcon,
    media: { src: '/img/test.png', alt: 'Test media' },
  },
  {
    id: 'tile-3',
    span: 'xl:col-span-4',
    title: 'Tile Three',
  },
]

describe('BentoGrid', () => {
  it('renders a card for each tile', () => {
    vi.mocked(useMediaQuery).mockReturnValue(false)
    renderWithI18n(<BentoGrid tiles={fakeTiles} />)
    expect(screen.getByText('Tile One')).toBeTruthy()
    expect(screen.getByText('Tile Two')).toBeTruthy()
    expect(screen.getByText('Tile Three')).toBeTruthy()
  })

  it('renders header when provided', () => {
    vi.mocked(useMediaQuery).mockReturnValue(false)
    renderWithI18n(
      <BentoGrid tiles={fakeTiles} header={<h2>Section Header</h2>} />,
    )
    expect(screen.getByText('Section Header')).toBeTruthy()
  })

  it('renders without header when not provided', () => {
    vi.mocked(useMediaQuery).mockReturnValue(false)
    const { container } = renderWithI18n(<BentoGrid tiles={fakeTiles} />)
    expect(container.querySelector('h2')).toBeNull()
  })

  it('renders empty grid when no tiles provided', () => {
    vi.mocked(useMediaQuery).mockReturnValue(false)
    const { container } = renderWithI18n(<BentoGrid tiles={[]} />)
    // Section should still render
    expect(container.querySelector('section')).toBeTruthy()
  })

  it('renders the features anchor span', () => {
    vi.mocked(useMediaQuery).mockReturnValue(false)
    const { container } = renderWithI18n(<BentoGrid tiles={fakeTiles} />)
    const anchor = container.querySelector('#features')
    expect(anchor).toBeTruthy()
  })

  // --- Case A: useMediaQuery => true (xl desktop, pinned mode) ---
  it('Case A (isXl=true): grid has xl:grid-cols-12 class and data-testid="bento-grid"', () => {
    vi.mocked(useMediaQuery).mockReturnValue(true)
    const { container } = renderWithI18n(<BentoGrid tiles={fakeTiles} />)
    const grid = container.querySelector('[data-testid="bento-grid"]')
    expect(grid).toBeTruthy()
    expect(grid?.className).toContain('xl:grid-cols-12')
  })

  it('Case A (isXl=true): section uses xl:h-[300vh] and NOT md:h-[300vh]', () => {
    vi.mocked(useMediaQuery).mockReturnValue(true)
    const { container } = renderWithI18n(<BentoGrid tiles={fakeTiles} />)
    const section = container.querySelector('section')
    expect(section?.className).toContain('xl:h-[300vh]')
    expect(section?.className).not.toContain('md:h-[300vh]')
  })

  it('Case A (isXl=true): cards are rendered (pinned mode)', () => {
    vi.mocked(useMediaQuery).mockReturnValue(true)
    renderWithI18n(<BentoGrid tiles={fakeTiles} />)
    expect(screen.getByText('Tile One')).toBeTruthy()
    expect(screen.getByText('Tile Two')).toBeTruthy()
    expect(screen.getByText('Tile Three')).toBeTruthy()
  })

  // --- Case B: useMediaQuery => false (below xl, stacked mode) ---
  it('Case B (isXl=false): grid has grid-cols-1 and no min-[480px]:grid-cols-2', () => {
    vi.mocked(useMediaQuery).mockReturnValue(false)
    const { container } = renderWithI18n(<BentoGrid tiles={fakeTiles} />)
    const grid = container.querySelector('[data-testid="bento-grid"]')
    expect(grid).toBeTruthy()
    expect(grid?.className).toContain('grid-cols-1')
    expect(grid?.className).not.toContain('min-[480px]:grid-cols-2')
  })

  it('Case B (isXl=false): section uses xl:h-[300vh] and NOT md:h-[300vh]', () => {
    vi.mocked(useMediaQuery).mockReturnValue(false)
    const { container } = renderWithI18n(<BentoGrid tiles={fakeTiles} />)
    const section = container.querySelector('section')
    expect(section?.className).toContain('xl:h-[300vh]')
    expect(section?.className).not.toContain('md:h-[300vh]')
  })
})
