import type { ComponentType } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Nav } from '#/components/site/nav'
import { Footer } from '#/components/site/footer'
import { AppleMark, WindowsMark, LinuxMark, DownloadIcon } from '#/components/site/icons'

export const Route = createFileRoute('/download')({
  component: Download,
  head: () => ({
    meta: [{ title: 'Download LazySheet — macOS, Windows & Linux' }],
  }),
})

const RELEASES_URL = 'https://github.com/triasbrata/lazysheet/releases/latest'

type Row = { label: string; badge: string }
type Column = {
  os: string
  icon: ComponentType<{ className?: string }>
  highlight?: boolean
  rows: Array<Row>
}

const COLUMNS: Array<Column> = [
  {
    os: 'macOS',
    icon: AppleMark,
    highlight: true,
    rows: [{ label: 'Universal', badge: 'Intel + Apple Silicon' }],
  },
  {
    os: 'Windows',
    icon: WindowsMark,
    rows: [
      { label: 'User Installer', badge: 'x64' },
      { label: 'User Installer', badge: 'ARM64' },
      { label: 'MSI Installer', badge: 'x64' },
      { label: 'MSI Installer', badge: 'ARM64' },
      { label: 'Portable', badge: 'x64' },
      { label: 'Portable', badge: 'ARM64' },
    ],
  },
  {
    os: 'Linux',
    icon: LinuxMark,
    rows: [
      { label: '.deb', badge: 'x64' },
      { label: '.deb', badge: 'ARM64' },
      { label: '.rpm', badge: 'x64' },
      { label: '.rpm', badge: 'ARM64' },
      { label: 'AppImage', badge: 'x64' },
      { label: 'AppImage', badge: 'ARM64' },
      { label: 'AUR', badge: 'Arch Linux' },
    ],
  },
]

function DownloadRow({ label, badge }: Row) {
  return (
    <a
      href={RELEASES_URL}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center justify-between gap-3 rounded-lg px-3 py-3 no-underline transition-colors hover:bg-surface-container-low"
    >
      <span className="flex items-center gap-2.5">
        <span className="font-display text-sm font-semibold text-[var(--st-green)]">
          {label}
        </span>
        <span className="rounded bg-surface-container-high px-2 py-0.5 text-xs font-medium text-on-surface-variant">
          {badge}
        </span>
      </span>
      <DownloadIcon className="text-[18px] text-on-surface-variant transition-colors group-hover:text-[var(--st-green)]" />
    </a>
  )
}

function Download() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="pt-20">
        <section className="px-4 pt-20 pb-16 md:px-16">
          <h1 className="font-display mb-16 text-center text-5xl font-bold tracking-[-0.03em] text-on-surface sm:text-6xl">
            Download
          </h1>

          <div className="mx-auto grid max-w-[1100px] grid-cols-1 items-stretch gap-6 md:grid-cols-3">
            {COLUMNS.map((col) => (
              <div
                key={col.os}
                className={`flex flex-col rounded-2xl bg-white p-8 ${
                  col.highlight
                    ? 'border-2 border-primary shadow-[0_18px_40px_-20px_rgba(0,88,195,0.35)]'
                    : 'border border-surface-container-high'
                }`}
              >
                <div className="flex flex-col items-center">
                  <col.icon className="text-[52px] text-on-surface" />
                  <h2 className="font-display mt-4 mb-6 text-2xl font-bold text-on-surface">
                    {col.os}
                  </h2>
                </div>
                <div className="flex flex-col gap-1">
                  {col.rows.map((r, i) => (
                    <DownloadRow key={`${r.label}-${r.badge}-${i}`} {...r} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-12 max-w-[1100px] text-center">
            <p className="text-sm text-on-surface-variant">
              By using LazySheet, you agree to the{' '}
              <a
                href="https://github.com/triasbrata/lazysheet/blob/main/LICENSE"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                License
              </a>
              .
            </p>
            <a
              href="https://github.com/triasbrata/lazysheet/releases"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block font-medium text-on-surface underline"
            >
              View all releases on GitHub
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
