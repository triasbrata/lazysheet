import type React from 'react'
import { useRef } from 'react'
import { motion, useScroll, useReducedMotion } from 'motion/react'
import { BentoCard } from './BentoCard'
import type { BentoTile } from './features'
import { useMediaQuery } from '#/lib/use-media-query'

type BentoGridProps = { tiles: BentoTile[]; header?: React.ReactNode }

export function BentoGrid({ tiles, header }: BentoGridProps): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  // Track scroll across the whole (tall, when pinned) section: 0 at pin-start, 1 at unpin.
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ['start start', 'end end'],
  })

  const reduce = useReducedMotion()
  const isXl = useMediaQuery('(min-width: 1280px)')
  const pinned = isXl && !reduce

  return (
    // Tall scroll track — only on desktop with motion enabled (motion-safe + xl).
    // Mobile / reduced-motion: height auto, normal document flow.
    <section ref={trackRef} className="relative motion-safe:xl:h-[300vh]">
      {/* Nav #features anchor — lands in the all-cards-visible HOLD beat on desktop
          (≈50% through the 300vh track → scrollYProgress ~0.5, before the staggered
          exit begins), or at the section top on mobile / reduced-motion. */}
      <span
        id="features"
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 scroll-mt-16 motion-safe:xl:top-[100vh]"
      />
      {/* Pinned stage: sticky + capped to the viewport height (minus the 4rem nav)
          so the full 4-row grid always fits — no row clipped below the fold on
          shorter desktops (e.g. 1366×768, 1536×864). */}
      <div className="mx-auto flex max-w-[1800px] flex-col px-4 py-24 sm:px-6 md:px-10 lg:px-16 motion-safe:xl:sticky motion-safe:xl:top-16 motion-safe:xl:h-[calc(100vh-4rem)] motion-safe:xl:py-6">
        {header}
        <motion.div
          data-testid="bento-grid"
          className="grid grid-cols-1 gap-3 [grid-auto-rows:minmax(160px,auto)] xl:min-h-0 xl:flex-1 xl:grid-cols-12 xl:grid-rows-4 xl:gap-3 xl:[grid-auto-rows:auto]"
        >
          {tiles.map((t, i) => (
            <BentoCard key={t.id} tile={t} index={i} progress={scrollYProgress} pinned={pinned} />
          ))}
        </motion.div>
      </div>
    </section>
  )
}
