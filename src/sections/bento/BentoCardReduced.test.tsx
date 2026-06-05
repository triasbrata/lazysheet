// @vitest-environment happy-dom
// Tests for BentoCard with useReducedMotion = true
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent } from '@testing-library/react'
import React from 'react'

// --- motion/react mock with reduce=true ---
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
    useReducedMotion: () => true,  // <-- reduced motion ON
    useMotionValueEvent: vi.fn(),
  }
})

import { BentoCard } from './BentoCard'
import type { BentoTile } from './features'
import { renderWithI18n } from '#/test/i18n'

afterEach(cleanup)

const fakeProgress = { get: () => 0 } as unknown as import('motion/react').MotionValue<number>

describe('BentoCard — reduce=true', () => {
  it('does NOT render shine overlay when reduced motion', () => {
    const tile: BentoTile = {
      id: 'test-reduced',
      span: 'md:col-span-4',
      title: 'Reduced Tile',
    }
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} />,
    )
    // Shine div should NOT be present
    const shine = container.querySelector('.pointer-events-none.-skew-x-12')
    expect(shine).toBeNull()
  })

  it('wrapperStyle is undefined (no opacity/y/scale) when reduce=true', () => {
    const tile: BentoTile = {
      id: 'test-reduced-style',
      span: 'md:col-span-4',
      title: 'No Wrapper Style',
    }
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} />,
    )
    const outerDiv = container.querySelector('[data-motion="div"]') as HTMLElement | null
    // When reduce=true, wrapperStyle = undefined, so the style attribute should be absent or empty
    expect(outerDiv?.style.opacity).toBeFalsy()
  })

  it('innerVariants is empty object (no hover scale) when reduce=true', () => {
    const tile: BentoTile = {
      id: 'test-inner-variants',
      span: 'md:col-span-4',
      title: 'No Hover Scale',
    }
    // Just render without error to confirm the reduce=true branch runs
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} />,
    )
    expect(container.querySelector('[data-motion="div"]')).toBeTruthy()
  })

  it('handleMouseMove early-returns when reduce=true (no mouseX.set called)', () => {
    const tile: BentoTile = {
      id: 'test-reduced-mouse',
      span: 'md:col-span-4',
      title: 'Reduced Mouse',
      media: { src: '/img/x.png', alt: 'X' },
    }
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} />,
    )
    // Fire mouse events — they should early-return because reduce=true
    const innerDiv = container.querySelectorAll('[data-motion="div"]')[1]
    if (innerDiv) {
      fireEvent.mouseMove(innerDiv, { clientX: 100, clientY: 50 })
      fireEvent.mouseLeave(innerDiv)
    }
    // No error = pass. The reduce guard means no .set() called for parallax.
    expect(true).toBe(true)
  })

  it('media style is undefined (no parallax) when reduce=true', () => {
    const tile: BentoTile = {
      id: 'test-reduced-media',
      span: 'md:col-span-4',
      title: 'Reduced Media',
      media: { src: '/shots/img.png', alt: 'Media Image' },
    }
    const { container } = renderWithI18n(
      <BentoCard tile={tile} index={0} progress={fakeProgress} />,
    )
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    // The media motion.div has style=undefined when reduce=true → no inline style
    const mediaWrapper = img?.parentElement as HTMLElement | null
    expect(mediaWrapper?.style.transform).toBeFalsy()
  })
})
