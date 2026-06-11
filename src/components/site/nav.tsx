import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { useScroll, useMotionValueEvent } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Menu } from 'lucide-react'
import { GithubMark } from '#/components/site/icons'
import { LanguageSwitcher } from '#/features/i18n/language-switcher'
import { cn } from '#/lib/utils'
import { isLocale, DEFAULT_LOCALE, type Locale } from '#/i18n/config'
import { FeedbackDialog } from '#/features/feedback/feedback-dialog'
import { GithubStars } from '#/features/github/github-stars'
import { VersionSelector } from '#/features/version/version-selector'
import { Sheet, SheetTrigger, SheetContent, SheetTitle } from '#/components/ui/sheet'
import type { ReleaseData } from '#/lib/releases'

type NavProps = { overHero?: boolean; releases?: ReleaseData[]; selectedTag?: string }

export function Nav({ overHero = false, releases, selectedTag }: NavProps) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 8))
  const solid = scrolled || !overHero

  const { t } = useTranslation()
  const params = useParams({ strict: false }) as { locale?: string }
  const locale: Locale = isLocale(params.locale ?? '') ? (params.locale as Locale) : DEFAULT_LOCALE

  return (
    <nav className={cn('fixed top-0 z-50 w-full border-b transition-all duration-300', solid ? 'border-surface-container-high bg-white/70 shadow-sm backdrop-blur-md backdrop-saturate-150' : 'border-transparent bg-transparent shadow-none')}>
      <div className={cn('mx-auto flex min-w-0 w-full max-w-[1200px] items-center justify-between gap-2 px-4 md:px-16 transition-all duration-300', scrolled ? 'h-16' : 'h-20')}>
        <Link to="/$locale" params={{ locale }} className="flex shrink-0 items-center gap-2 no-underline">
          <img
            src="/app-icon.png"
            alt={t('nav.logoAlt')}
            className={cn('object-contain transition-all duration-300', scrolled ? 'h-8 w-8' : 'h-10 w-10')}
          />
          <span className={cn('font-display font-bold text-on-surface transition-all duration-300', scrolled ? 'text-lg' : 'text-xl')}>
            LazySheet
          </span>
        </Link>

        {/* Desktop links cluster — visible only >= lg */}
        <div className="hidden lg:flex items-center gap-4 lg:gap-6">
          <a
            href={`/${locale}#features`}
            className="font-display text-sm font-medium text-on-surface no-underline transition-colors hover:text-primary"
          >
            {t('nav.features')}
          </a>
          <Link
            to="/$locale/guide"
            params={{ locale }}
            className="font-display text-sm font-medium text-on-surface no-underline transition-colors hover:text-primary"
          >
            Guide
          </Link>
          <Link
            to="/$locale/download"
            params={{ locale }}
            className="font-display text-sm font-medium text-on-surface no-underline transition-colors hover:text-primary"
          >
            {t('nav.download')}
          </Link>
          <FeedbackDialog
            trigger={
              <button
                type="button"
                aria-label={t('nav.feedbackAria')}
                className="font-display text-sm font-medium text-on-surface no-underline transition-colors hover:text-primary inline-flex"
              >
                {t('feedback.trigger')}
              </button>
            }
          />
          <div className="inline-flex items-center gap-1">
            <a
              href="https://github.com/triasbrata/lazysheet"
              target="_blank"
              rel="noreferrer"
              aria-label={t('nav.githubAria')}
              className="inline-flex size-9 items-center justify-center rounded-lg text-on-surface transition-colors hover:bg-surface-container-low hover:text-primary"
            >
              <GithubMark className="text-[18px]" />
            </a>
            <GithubStars />
          </div>
          {releases && selectedTag ? (
            <VersionSelector releases={releases} selectedTag={selectedTag} />
          ) : null}
          <LanguageSwitcher />
        </div>

        {/* Always-visible cluster: GitHub icon (compact) + hamburger — < lg only */}
        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          {/* GitHub icon — always visible (compact, no stars count) */}
          <a
            href="https://github.com/triasbrata/lazysheet"
            target="_blank"
            rel="noreferrer"
            aria-label={t('nav.githubAria')}
            className="inline-flex lg:hidden size-9 items-center justify-center rounded-lg text-on-surface transition-colors hover:bg-surface-container-low hover:text-primary"
          >
            <GithubMark className="text-[18px]" />
          </a>

          {/* Hamburger — visible only < lg */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label={t('nav.menuAria')}
                className="inline-flex lg:hidden size-9 items-center justify-center rounded-lg text-on-surface transition-colors hover:bg-surface-container-low hover:text-primary"
              >
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 px-6 py-6">
              <SheetTitle className="sr-only">Navigation menu</SheetTitle>
              <nav className="flex flex-col gap-4 mt-4">
                <a
                  href={`/${locale}#features`}
                  className="font-display text-base font-medium text-on-surface no-underline transition-colors hover:text-primary"
                  onClick={() => setMenuOpen(false)}
                >
                  {t('nav.features')}
                </a>
                <Link
                  to="/$locale/guide"
                  params={{ locale }}
                  className="font-display text-base font-medium text-on-surface no-underline transition-colors hover:text-primary"
                  onClick={() => setMenuOpen(false)}
                >
                  Guide
                </Link>
                <Link
                  to="/$locale/download"
                  params={{ locale }}
                  className="font-display text-base font-medium text-on-surface no-underline transition-colors hover:text-primary"
                  onClick={() => setMenuOpen(false)}
                >
                  {t('nav.download')}
                </Link>
                <FeedbackDialog
                  trigger={
                    <button
                      type="button"
                      aria-label={t('nav.feedbackAria')}
                      className="font-display text-base font-medium text-on-surface no-underline transition-colors hover:text-primary text-left"
                      onClick={() => setMenuOpen(false)}
                    >
                      {t('feedback.trigger')}
                    </button>
                  }
                />
                <a
                  href="https://github.com/triasbrata/lazysheet"
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t('nav.githubAria')}
                  className="inline-flex items-center gap-2 font-display text-base font-medium text-on-surface no-underline transition-colors hover:text-primary"
                  onClick={() => setMenuOpen(false)}
                >
                  <GithubMark className="text-[18px]" />
                  GitHub
                </a>

                {/* Version + language — moved into the drawer on < lg */}
                <div className="mt-2 flex flex-col items-start gap-3 border-t border-surface-container-high pt-4">
                  {releases && selectedTag ? (
                    <VersionSelector releases={releases} selectedTag={selectedTag} />
                  ) : null}
                  <LanguageSwitcher />
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  )
}
