import type React from 'react'
import { useRef } from 'react'
import { motion, useScroll } from 'motion/react'
import { BentoCard } from './BentoCard'
import type { BentoTile } from './features'

type BentoGridProps = { tiles: BentoTile[]; header?: React.ReactNode }

export function BentoGrid({ tiles, header }: BentoGridProps): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  // Track scroll across the whole (tall, when pinned) section: 0 at pin-start, 1 at unpin.
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ['start start', 'end end'],
  })

  return (
    // Tall scroll track — only on desktop with motion enabled (motion-safe + md).
    // Mobile / reduced-motion: height auto, normal document flow.
    <section id="features" ref={trackRef} className="relative motion-safe:md:h-[300vh]">
      {/* Pinned stage: sticky + full-screen + vertically centered when pinning is active. */}
      <div className="mx-auto flex max-w-[1800px] flex-col px-4 py-24 md:px-10 lg:px-16 motion-safe:md:sticky motion-safe:md:top-16 motion-safe:md:py-8">
        {header}
        <motion.div
          className={[
            // content-driven rows: each card sizes to its own content (varied heights)
            'grid grid-cols-1 gap-3 [grid-auto-rows:minmax(160px,auto)]',
            'min-[480px]:grid-cols-2',
            'md:grid-cols-12 md:gap-3 md:[grid-auto-rows:minmax(0,auto)]',
          ].join(' ')}
        >
          {tiles.map((t, i) => (
            <BentoCard key={t.id} tile={t} index={i} progress={scrollYProgress} />
          ))}
        </motion.div>
      </div>
    </section>
  )
}
