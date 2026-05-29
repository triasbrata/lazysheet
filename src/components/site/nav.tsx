import { Link } from '@tanstack/react-router'
import { GithubMark } from '#/components/site/icons'

export function Nav() {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-surface-container-high bg-white shadow-sm">
      <div className="mx-auto flex h-20 w-full max-w-[1200px] items-center justify-between px-4 md:px-16">
        <Link to="/" className="flex items-center gap-2 no-underline">
          <img
            src="/app-icon.png"
            alt="LazySheet logo"
            className="h-10 w-10 object-contain"
          />
          <span className="font-display text-xl font-bold text-on-surface">
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
