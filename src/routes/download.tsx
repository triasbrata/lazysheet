import { createFileRoute } from '@tanstack/react-router'
import { Nav } from '#/components/site/nav'
import { Footer } from '#/components/site/footer'
import { AppleMark, WindowsMark, LinuxMark, DownloadIcon } from '#/components/site/icons'
import {
  groupByOS,
  formatLabel,
  archBadge,
  RELEASES_PAGE_URL,
  type ReleaseAsset,
} from '#/lib/releases'
import { useClientOSArch } from '#/features/download/use-os-arch'
import { getDownloadData, type DownloadData } from '#/lib/releases-data'

export const Route = createFileRoute('/download')({
  component: Download,
  loader: () => getDownloadData(),
  head: () => ({
    meta: [{ title: 'Download LazySheet — macOS, Windows & Linux' }],
  }),
})

function DownloadRow({ asset }: { asset: ReleaseAsset }) {
  return (
    <a
      href={asset.url}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center justify-between gap-3 rounded-lg px-3 py-3 no-underline transition-colors hover:bg-surface-container-low"
    >
      <span className="flex items-center gap-2.5">
        <span className="font-display text-sm font-semibold text-[var(--st-green)]">
          {formatLabel(asset)}
        </span>
        <span className="rounded bg-surface-container-high px-2 py-0.5 text-xs font-medium text-on-surface-variant">
          {archBadge(asset)}
        </span>
      </span>
      <DownloadIcon className="text-[18px] text-on-surface-variant transition-colors group-hover:text-[var(--st-green)]" />
    </a>
  )
}

const OS_CONFIG = [
  { key: 'macOS' as const, label: 'macOS', Icon: AppleMark },
  { key: 'Windows' as const, label: 'Windows', Icon: WindowsMark },
  { key: 'Linux' as const, label: 'Linux', Icon: LinuxMark },
]

function Download() {
  return <DownloadView data={Route.useLoaderData()} />
}

export function DownloadView({ data }: { data: DownloadData }) {
  const { os: detectedOS } = useClientOSArch({ os: data.serverOS, arch: null })
  const groups = data.release ? groupByOS(data.release.assets) : null

  const hasAnyAssets = groups
    ? OS_CONFIG.some(({ key }) => groups[key].length > 0)
    : false

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="pt-20">
        <section className="px-4 pt-20 pb-16 md:px-16">
          <h1 className="font-display mb-16 text-center text-5xl font-bold tracking-[-0.03em] text-on-surface sm:text-6xl">
            Download
          </h1>

          {groups && hasAnyAssets ? (
            <div className="mx-auto grid max-w-[1100px] grid-cols-1 items-stretch gap-6 md:grid-cols-3">
              {OS_CONFIG.filter(({ key }) => groups[key].length > 0).map(({ key, label, Icon }) => (
                <div
                  key={key}
                  className={`flex flex-col rounded-2xl bg-white p-8 ${
                    key === detectedOS
                      ? 'border-2 border-primary shadow-[0_18px_40px_-20px_rgba(0,88,195,0.35)]'
                      : 'border border-surface-container-high'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <Icon className="text-[52px] text-on-surface" />
                    <h2 className="font-display mt-4 mb-6 text-2xl font-bold text-on-surface">
                      {label}
                    </h2>
                  </div>
                  <div className="flex flex-col gap-1">
                    {groups[key].map((asset, i) => (
                      <DownloadRow key={`${asset.name}-${i}`} asset={asset} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mx-auto flex max-w-[480px] flex-col items-center rounded-2xl border border-surface-container-high bg-white p-10 text-center">
              <DownloadIcon className="mb-4 text-[48px] text-on-surface-variant" />
              <p className="mb-6 text-on-surface-variant">
                Builds aren&apos;t published yet — check the releases page for the latest downloads.
              </p>
              <a
                href={RELEASES_PAGE_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-[var(--st-green)] px-8 py-4 text-lg font-bold text-white no-underline transition-all hover:opacity-90"
              >
                View Releases on GitHub
              </a>
            </div>
          )}

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
              href={RELEASES_PAGE_URL}
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
