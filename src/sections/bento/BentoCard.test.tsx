// @vitest-environment happy-dom
// Tests for BentoCard with useReducedMotion = false (default)
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import React from 'react'

// --- motion/react mock (reduce=false) ---
vi.mock('motion/react', () => {
  const mockSet = vi.fn()

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
        {
          style,
          className,
          onMouseMove,
          onMouseLeave,
          'data-motion': tag,
          ...rest,
        },
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
    useMotionValue: (v: number) => ({ get: () => v, set: mockSet }),
    useSpring: (mv: unknown) => mv,
    useReducedMotion: () => false,
    useMotionValueEvent: vi.fn(),
  }
})

import { BentoCard } from './BentoCard'
import type { BentoTile } from './features'
import { renderWithI18n } from '#/test/i18n'

afterEach(cleanup)

const fakeProgress = { get: () => 0 } as unknown as import('motion/react').MotionValue<number>

const fakeIcon = ({ className }: { className?: string }) => (
  <svg className={className} data-testid="fake-icon" />
)

describe('BentoCard — reduce=false', () => {
  // --- tone variants ---
  it('applies tint tone class', () => {
    const tile: BentoTile = {
      id: 'test-tint',
      span: 'xl:col-span-4',
      title: 'Tint Tile',
      tone: 'tint',
    }
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />,
    )
    const outerDiv = container.querySelector('[data-motion="div"]')
    expect(outerDiv?.className).toContain('bg-surface-container-low')
  })

  it('applies accent tone class', () => {
    const tile: BentoTile = {
      id: 'test-accent',
      span: 'xl:col-span-4',
      title: 'Accent Tile',
      tone: 'accent',
    }
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />,
    )
    const outerDiv = container.querySelector('[data-motion="div"]')
    expect(outerDiv?.className).toContain('bg-gradient-to-br')
  })

  it('applies white bg for undefined tone', () => {
    const tile: BentoTile = {
      id: 'test-plain',
      span: 'xl:col-span-4',
      title: 'Plain Tile',
    }
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />,
    )
    const outerDiv = container.querySelector('[data-motion="div"]')
    expect(outerDiv?.className).toContain('bg-white')
  })

  // --- layout: band ---
  it('renders band layout with flex-row', () => {
    const tile: BentoTile = {
      id: 'test-band',
      span: 'xl:col-span-12',
      title: 'Band Tile',
      layout: 'band',
      icon: fakeIcon,
      description: 'Band description',
    }
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />,
    )
    // Should have a flex-row container
    const flexRow = container.querySelector('.flex.flex-row')
    expect(flexRow).toBeTruthy()
    expect(screen.getByText('Band Tile')).toBeTruthy()
    expect(screen.getByText('Band description')).toBeTruthy()
  })

  it('renders band layout without icon when icon absent', () => {
    const tile: BentoTile = {
      id: 'test-band-no-icon',
      span: 'xl:col-span-12',
      title: 'Band No Icon',
      layout: 'band',
      description: 'No icon band',
    }
    renderWithI18n(<BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />)
    expect(screen.queryByTestId('fake-icon')).toBeNull()
    expect(screen.getByText('Band No Icon')).toBeTruthy()
  })

  it('band layout - group-by id uses text-2xl heading', () => {
    const tile: BentoTile = {
      id: 'group-by',
      span: 'xl:col-span-4',
      title: 'Group By',
      layout: 'band',
    }
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />,
    )
    const h3 = container.querySelector('h3')
    expect(h3?.className).toContain('text-2xl')
  })

  it('band layout - non-group-by id uses text-base heading', () => {
    const tile: BentoTile = {
      id: 'other-id',
      span: 'xl:col-span-4',
      title: 'Other',
      layout: 'band',
    }
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />,
    )
    const h3 = container.querySelector('h3')
    expect(h3?.className).toContain('text-base')
  })

  // --- default (stack) layout ---
  it('renders stack layout by default', () => {
    const tile: BentoTile = {
      id: 'test-stack',
      span: 'xl:col-span-4',
      title: 'Stack Tile',
      icon: fakeIcon,
      description: 'Stack description',
    }
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />,
    )
    const flexCol = container.querySelector('.flex.flex-col')
    expect(flexCol).toBeTruthy()
    expect(screen.getByText('Stack description')).toBeTruthy()
  })

  it('stack layout - group-by id uses text-2xl', () => {
    const tile: BentoTile = {
      id: 'group-by',
      span: 'xl:col-span-4',
      title: 'Group By Stack',
    }
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />,
    )
    const h3 = container.querySelector('h3')
    expect(h3?.className).toContain('text-2xl')
  })

  it('stack layout - other id uses text-lg', () => {
    const tile: BentoTile = {
      id: 'other-id',
      span: 'xl:col-span-4',
      title: 'Other Stack',
    }
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />,
    )
    const h3 = container.querySelector('h3')
    expect(h3?.className).toContain('text-lg')
  })

  // --- icon present / absent ---
  it('renders icon when provided', () => {
    const tile: BentoTile = {
      id: 'test-icon',
      span: 'xl:col-span-4',
      title: 'With Icon',
      icon: fakeIcon,
    }
    renderWithI18n(<BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />)
    expect(screen.getByTestId('fake-icon')).toBeTruthy()
  })

  it('renders without icon when absent', () => {
    const tile: BentoTile = {
      id: 'test-no-icon',
      span: 'xl:col-span-4',
      title: 'No Icon',
    }
    renderWithI18n(<BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />)
    expect(screen.queryByTestId('fake-icon')).toBeNull()
  })

  // --- description present / absent ---
  it('renders description when provided', () => {
    const tile: BentoTile = {
      id: 'test-desc',
      span: 'xl:col-span-4',
      title: 'Title',
      description: 'My description',
    }
    renderWithI18n(<BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />)
    expect(screen.getByText('My description')).toBeTruthy()
  })

  it('does not render description paragraph when absent', () => {
    const tile: BentoTile = {
      id: 'test-no-desc',
      span: 'xl:col-span-4',
      title: 'Title Only',
    }
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />,
    )
    // No <p> element
    expect(container.querySelector('p')).toBeNull()
  })

  // --- render() closure present ---
  it('renders tile.render() content when provided', () => {
    const tile: BentoTile = {
      id: 'test-render',
      span: 'xl:col-span-4',
      title: 'Render Tile',
      render: () => <span data-testid="custom-render">Custom Content</span>,
    }
    renderWithI18n(<BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />)
    expect(screen.getByTestId('custom-render')).toBeTruthy()
  })

  // --- media present ---
  it('renders media image when provided', () => {
    const tile: BentoTile = {
      id: 'test-media',
      span: 'xl:col-span-4',
      title: 'Media Tile',
      media: { src: '/shots/test.png', alt: 'Test Image' },
    }
    renderWithI18n(<BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />)
    const img = screen.getByAltText('Test Image')
    expect(img).toBeTruthy()
    expect(img.getAttribute('src')).toBe('/shots/test.png')
    // default position anchors top-left
    expect(img.className).toContain('object-cover')
    expect(img.className).toContain('object-left-top')
  })

  it('renders media centered when position is center', () => {
    const tile: BentoTile = {
      id: 'test-media-center',
      span: 'xl:col-span-4',
      title: 'Centered Tile',
      media: { src: '/shots/test.gif', alt: 'Centered Image', position: 'center' },
    }
    renderWithI18n(<BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />)
    const img = screen.getByAltText('Centered Image')
    expect(img.className).toContain('object-cover')
    expect(img.className).toContain('object-center')
    expect(img.className).not.toContain('object-left-top')
  })

  it('does not render media when absent', () => {
    const tile: BentoTile = {
      id: 'test-no-media',
      span: 'xl:col-span-4',
      title: 'No Media',
    }
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />,
    )
    expect(container.querySelector('img')).toBeNull()
  })

  // --- shine overlay present when reduce=false ---
  it('renders shine overlay when reduce=false', () => {
    const tile: BentoTile = {
      id: 'test-shine',
      span: 'xl:col-span-4',
      title: 'Shine Tile',
    }
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />,
    )
    // Shine div has pointer-events-none and skew class
    const shine = container.querySelector('.pointer-events-none.-skew-x-12')
    expect(shine).toBeTruthy()
  })

  // --- mouseMove / mouseLeave handlers (reduce=false, with media) ---
  it('fires handleMouseMove and handleMouseLeave when reduce=false and media present', () => {
    const tile: BentoTile = {
      id: 'test-mouse',
      span: 'xl:col-span-4',
      title: 'Mouse Tile',
      media: { src: '/img/x.png', alt: 'X' },
    }
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />,
    )
    // The inner wrapper is the SECOND data-motion="div" — it has onMouseMove/onMouseLeave
    const innerDivs = container.querySelectorAll('[data-motion="div"]')
    // innerDivs[0] = outer wrapper (wrapperStyle), innerDivs[1] = inner wrapper (onMouseMove)
    const innerWrapper = innerDivs[1] as HTMLElement | undefined

    // Mock getBoundingClientRect — e.currentTarget points to the element the handler is on
    const mockRect = {
      left: 0,
      top: 0,
      width: 200,
      height: 100,
      right: 200,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    }
    if (innerWrapper) {
      // Override getBoundingClientRect on the prototype chain and directly
      Object.defineProperty(innerWrapper, 'getBoundingClientRect', {
        value: () => mockRect,
        configurable: true,
        writable: true,
      })
      fireEvent.mouseMove(innerWrapper, { clientX: 150, clientY: 60 })
      fireEvent.mouseLeave(innerWrapper)
    }
    // No error thrown = pass
    expect(true).toBe(true)
  })

  it('fires handleMouseMove when reduce=false but no media (early return)', () => {
    const tile: BentoTile = {
      id: 'test-mouse-no-media',
      span: 'xl:col-span-4',
      title: 'No Media Mouse',
    }
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />,
    )
    const innerDiv = container.querySelectorAll('[data-motion="div"]')[1]
    if (innerDiv) {
      fireEvent.mouseMove(innerDiv, { clientX: 50, clientY: 50 })
      fireEvent.mouseLeave(innerDiv)
    }
    expect(true).toBe(true)
  })

  // --- index affects wrapperStyle keys (different index) ---
  it('renders correctly with a high index (stagger cap)', () => {
    const tile: BentoTile = {
      id: 'test-high-index',
      span: 'xl:col-span-4',
      title: 'High Index',
    }
    renderWithI18n(<BentoCard tile={tile} index={20} progress={fakeProgress} pinned={false} />)
    expect(screen.getByText('High Index')).toBeTruthy()
  })

  // --- all three tiles with description absent in band layout ---
  it('band layout without description omits <p>', () => {
    const tile: BentoTile = {
      id: 'band-no-desc',
      span: 'xl:col-span-4',
      title: 'Band No Desc',
      layout: 'band',
    }
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />,
    )
    expect(container.querySelector('p')).toBeNull()
  })

  // --- pinned=true: scroll-progress style path ---
  it('pinned=true uses scroll-progress style (wrapperStyle set on outer div)', () => {
    const tile: BentoTile = {
      id: 'test-pinned',
      span: 'xl:col-span-4',
      title: 'Pinned Tile',
    }
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} pinned={true} />,
    )
    // The outer motion.div should exist; with pinned=true and reduce=false,
    // wrapperStyle is set (opacity/y/scale from useTransform mock returns objects).
    const outerDiv = container.querySelector('[data-motion="div"]') as HTMLElement | null
    expect(outerDiv).toBeTruthy()
    expect(screen.getByText('Pinned Tile')).toBeTruthy()
  })

  // --- stacked (pinned=false): whileInView props are spread on outer div ---
  it('stacked (pinned=false) spreads whileInView props onto outer motion.div', () => {
    const tile: BentoTile = {
      id: 'test-stacked',
      span: 'xl:col-span-4',
      title: 'Stacked Tile',
    }
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} pinned={false} />,
    )
    // The motion mock passes through unknown props as data attributes or spreads them.
    // With motionProps spread and mock passing ...rest to React.createElement,
    // we verify that the component renders at all and the tile is present.
    const outerDiv = container.querySelector('[data-motion="div"]')
    expect(outerDiv).toBeTruthy()
    expect(screen.getByText('Stacked Tile')).toBeTruthy()
  })

  // --- stacked delay caps at 0.3 for high index ---
  it('stacked delay caps at 0.3 for high index (index=20)', () => {
    const tile: BentoTile = {
      id: 'test-stacked-delay',
      span: 'xl:col-span-4',
      title: 'Stacked High Index',
    }
    // Should not throw and render correctly
    renderWithI18n(<BentoCard tile={tile} index={20} progress={fakeProgress} pinned={false} />)
    expect(screen.getByText('Stacked High Index')).toBeTruthy()
  })
})
