import { useTranslation } from 'react-i18next'
import { Star } from 'lucide-react'
import { cn } from '#/lib/utils'
import { useGithubStars, formatStars } from './use-github-stars'

export interface GithubStarsProps {
  className?: string
}

export function GithubStars({ className }: GithubStarsProps) {
  const { t } = useTranslation()
  const { stars } = useGithubStars()

  if (stars == null) {
    return null
  }

  return (
    <span
      aria-label={t('nav.githubStarsAria', { count: stars })}
      className={cn('inline-flex items-center gap-1 text-sm tabular-nums text-on-surface-variant', className)}
    >
      <Star className="size-3.5 fill-current" />
      {formatStars(stars)}
    </span>
  )
}
