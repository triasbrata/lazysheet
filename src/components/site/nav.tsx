import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useScroll, useMotionValueEvent } from 'motion/react'
import { GithubMark } from '#/components/site/icons'
import { cn } from '#/lib/utils'

type NavProps = { overHero?: boolean }

export function Nav({ overHero = false }: NavProps) {
  const [scrolled, setScrolled] = useState(false)
  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 8))
  const solid = scrolled || !overHero

  return (
    <nav className={cn('fixed top-0 z-50 w-full border-b transition-all duration-300', solid ? 'border-surface-container-high bg-white/70 shadow-sm backdrop-blur-md backdrop-saturate-150' : 'border-transparent bg-transparent shadow-none')}>
      <div className={cn('mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 md:px-16 transition-all duration-300', scrolled ? 'h-16' : 'h-20')}>
        <Link to="/" className="flex items-center gap-2 no-underline">
          <img
            src="/app-icon.png"
            alt="LazySheet logo"
            className={cn('object-contain transition-all duration-300', scrolled ? 'h-8 w-8' : 'h-10 w-10')}
          />
          <span className={cn('font-display font-bold text-on-surface transition-all duration-300', scrolled ? 'text-lg' : 'text-xl')}>
            LazySheet
          </span>
        </Link>
        <div className="flex items-center gap-6 md:gap-10">
          <a
            href="/#features"
            className="hidden font-display text-sm font-medium text-on-surface no-underline transition-colors hover:text-primary sm:inline"
          >
            Features
          </a>
          <Link
            to="/download"
            className="font-display text-sm font-medium text-on-surface no-underline transition-colors hover:text-primary"
          >
            Download
          </Link>
          <a
            href="https://github.com/triasbrata/lazysheet"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub repository"
            className="inline-flex size-9 items-center justify-center rounded-lg text-on-surface transition-colors hover:bg-surface-container-low hover:text-primary"
          >
            <GithubMark className="text-[18px]" />
          </a>
        </div>
      </div>
    </nav>
  )
}
