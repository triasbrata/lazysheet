import { useReducedMotion, motion, useTransform, useMotionValue, useSpring } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { cn } from '#/lib/utils'
import type { BentoTile } from './features'

type BentoCardProps = { tile: BentoTile; index: number; progress: MotionValue<number> }

// Scroll-linked timeline over the pinned section's scrollYProgress (0→1):
// staggered entrance → a HOLD where every card (and the whole container) is
// fully visible → a staggered exit where cards fade out one-by-one.
const IN_STAGGER = 0.03 // per-index entrance offset
const IN_STAGGER_MAX = 0.22 // cap so late cards finish before the hold
const IN_DUR = 0.18 // entrance window width (max inEnd ≈ 0.40)
const HOLD_END = 0.56 // exit begins here — gives a clear all-visible hold (0.40→0.56)
const OUT_STAGGER = 0.02 // per-index exit offset → one-by-one fade-out
const OUT_DUR = 0.16 // per-card exit window width

export function BentoCard({ tile, index, progress }: BentoCardProps): JSX.Element {
  const reduce = useReducedMotion()

  // Entrance: staggered fade-in. Exit: staggered fade-out (one card at a time),
  // only after the hold — fade + lift + slight recede.
  const inStart = Math.min(index * IN_STAGGER, IN_STAGGER_MAX)
  const inEnd = inStart + IN_DUR
  const outStart = HOLD_END + index * OUT_STAGGER
  const outEnd = Math.min(outStart + OUT_DUR, 1)
  const keys = [inStart, inEnd, outStart, outEnd]
  const opacity = useTransform(progress, keys, [0, 1, 1, 0])
  const y = useTransform(progress, keys, [40, 0, 0, -56])
  const scale = useTransform(progress, keys, [0.92, 1, 1, 0.96])

  // Pointer parallax for media — always compute unconditionally
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const springX = useSpring(mouseX, { stiffness: 200, damping: 30 })
  const springY = useSpring(mouseY, { stiffness: 200, damping: 30 })

  const toneClass =
    tile.tone === 'tint'
      ? 'bg-surface-container-low'
      : tile.tone === 'accent'
        ? 'bg-gradient-to-br from-primary-fixed/40 to-white'
        : 'bg-white'

  const wrapperStyle = reduce ? undefined : { opacity, y, scale }

  const isBand = tile.layout === 'band'

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduce || !tile.media) return
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = ((e.clientX - cx) / rect.width) * -10
    const dy = ((e.clientY - cy) / rect.height) * -10
    mouseX.set(dx)
    mouseY.set(dy)
  }

  function handleMouseLeave() {
    mouseX.set(0)
    mouseY.set(0)
  }

  const shineVariants = {
    initial: { x: '-150%' },
    hover: { x: '150%' },
  }

  const innerVariants = reduce
    ? {}
    : {
        hover: { scale: 1.02 },
      }

  return (
    <motion.div
      style={wrapperStyle}
      className={cn(
        'group relative overflow-hidden rounded-3xl border border-surface-container-high p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),inset_0_-12px_24px_-20px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_-16px_rgba(0,0,0,0.14)] transition-shadow hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),inset_0_-12px_24px_-20px_rgba(0,0,0,0.18),0_2px_4px_rgba(0,0,0,0.05),0_18px_44px_-18px_rgba(0,0,0,0.20)] motion-safe:md:p-6',
        toneClass,
        tile.span,
      )}
    >
      {/* Inner wrapper: handles hover scale + shine */}
      <motion.div
        className="relative h-full"
        whileHover={reduce ? undefined : 'hover'}
        initial="initial"
        variants={innerVariants}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Shine overlay */}
        {!reduce && (
          <motion.div
            className="pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent"
            variants={shineVariants}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        )}

        {/* Content */}
        {isBand ? (
          <div className="flex flex-row items-center gap-6">
            {tile.icon && (
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-fixed">
                <tile.icon className="text-[20px] text-primary" />
              </span>
            )}
            <div>
              <h3
                className={cn(
                  'font-display font-semibold text-on-surface',
                  tile.id === 'group-by' ? 'text-2xl' : 'text-base',
                )}
              >
                {tile.title}
              </h3>
              {tile.description && (
                <p className="text-sm leading-relaxed text-on-surface-variant">
                  {tile.description}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3">
              {tile.icon && (
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-fixed">
                  <tile.icon className="text-[20px] text-primary" />
                </span>
              )}
              <h3
                className={cn(
                  'font-display font-semibold leading-none text-on-surface',
                  tile.id === 'group-by' ? 'text-2xl' : 'text-lg',
                )}
              >
                {tile.title}
              </h3>
            </div>
            {tile.description && (
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                {tile.description}
              </p>
            )}
            {tile.render && <div className="mt-3">{tile.render()}</div>}
            {tile.media && (
              <motion.div
                className="mt-6 overflow-hidden rounded-xl border border-surface-container-high motion-safe:md:mt-4 motion-safe:md:min-h-[220px] motion-safe:md:flex-1"
                style={
                  reduce
                    ? undefined
                    : { x: springX, y: springY }
                }
              >
                <img
                  src={tile.media.src}
                  alt={tile.media.alt}
                  className="h-full w-full object-cover object-left-top"
                />
              </motion.div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
