export function Footer() {
  return (
    <footer className="w-full border-t border-surface-container-high bg-white">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-8 text-sm text-on-surface-variant md:px-16">
        <span>© 2026&nbsp;LazySheet. Built for speed.</span>
        <a
          href="https://github.com/triasbrata/lazysheet"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-on-surface-variant no-underline hover:text-primary"
        >
          GitHub
        </a>
      </div>
    </footer>
  )
}
