import { createFileRoute, Link } from '@tanstack/react-router'
import { Nav } from '#/components/site/nav'
import { Footer } from '#/components/site/footer'
import {
  ExcelIcon,
  CsvIcon,
  TsvIcon,
  LockIcon,
  TerminalIcon,
} from '#/components/site/icons'
import { getDownloadData, type DownloadData } from '#/lib/releases-data'
import { DownloadButton } from '#/features/download/download-button'
import { CopyCommand } from '#/features/faq/copy-command'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '#/components/ui/accordion'
import { BentoGrid } from '#/sections/bento/BentoGrid'
import { BENTO_TILES } from '#/sections/bento/features'

export const Route = createFileRoute('/')({
  component: Home,
  loader: () => getDownloadData(),
})

const FORMATS = [
  { ext: '.xlsx', Icon: ExcelIcon, tint: '#16a34a' },
  { ext: '.xlsm', Icon: ExcelIcon, tint: '#16a34a' },
  { ext: '.xls', Icon: ExcelIcon, tint: '#16a34a' },
  { ext: '.csv', Icon: CsvIcon, tint: '#0ea5e9' },
  { ext: '.tsv', Icon: TsvIcon, tint: '#f59e0b' },
]


export function Hero({ data }: { data: DownloadData }) {
  return (
    <section className="hero-gradient px-4 pt-24 pb-32 md:px-16">
      <div className="mx-auto max-w-[1200px] text-center">
        <div className="mb-8 flex justify-center">
          <img
            src="/app-icon.png"
            alt="LazySheet icon"
            className="h-24 w-24 object-contain md:h-32 md:w-32"
          />
        </div>
        <h1 className="font-display mx-auto mb-6 max-w-[900px] text-[40px] font-bold leading-[1.05] tracking-[-0.04em] text-on-surface sm:text-[56px] md:text-[72px] md:leading-[80px]">
          Fast. Simple.
          <br />
          <span className="text-primary">Spreadsheet Viewer.</span>
        </h1>
        <p className="mx-auto mb-12 max-w-[650px] text-lg leading-[28px] text-on-surface-variant">
          Stop waiting for heavy spreadsheet software. Open 100MB CSVs instantly
          and gain insights with zero latency.
        </p>

        <div className="group mb-16 flex flex-col items-center justify-center">
          <div className="mb-4 flex flex-col items-center justify-center gap-4 md:flex-row">
            <DownloadButton data={data} />
            <Link
              to="/download"
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#cbd5e1] bg-white px-8 py-5 text-2xl font-bold text-[#4a5568] no-underline transition-all hover:bg-gray-50 md:w-auto"
            >
              Other downloads
            </Link>
          </div>
          <p className="text-sm text-on-surface-variant opacity-0 transition-opacity duration-200 group-hover:opacity-100">
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
        </div>

        <div className="relative mx-auto max-w-[1100px] overflow-hidden rounded-xl border border-surface-container-highest bg-white shadow-2xl">
          <img
            src="/shots/application.png"
            alt="LazySheet dashboard"
            className="h-auto w-full"
          />
        </div>
      </div>
    </section>
  )
}

export function Formats() {
  return (
    <section className="border-y border-surface-container-high bg-surface-container-low py-20">
      <div className="mx-auto max-w-[1200px] px-4 text-center">
        <h2 className="font-display mb-4 text-3xl font-bold text-on-surface">
          Wide format support
        </h2>
        <p className="mb-10 text-on-surface-variant">
          Open any data file with a simple{' '}
          <span className="font-bold text-on-surface">Drag &amp; Drop</span>.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          {FORMATS.map((f) => (
            <div
              key={f.ext}
              className="flex items-center gap-3 rounded-lg border border-surface-container-high bg-white px-6 py-4 text-on-surface shadow-sm"
            >
              <f.Icon className="text-[20px]" style={{ color: f.tint }} />
              <span className="font-display font-bold text-on-surface">{f.ext}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <BentoGrid
      tiles={BENTO_TILES}
      header={
        <div className="mb-8 text-center motion-safe:md:mb-6">
          <h2 className="font-display mb-4 text-[40px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[48px] sm:leading-[56px]">
            Engineered for Performance
          </h2>
          <p className="text-on-surface-variant">
            The feature set you need to analyze data without the bloat.
          </p>
        </div>
      }
    />
  )
}

export function Faq() {
  return (
    <section
      id="faq"
      className="border-t border-surface-container-high bg-surface-container-low py-24"
    >
      <div className="mx-auto max-w-[1000px] px-4 md:px-8">
        <div className="mb-12 text-center">
          <h2 className="font-display mb-4 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[40px]">
            Having trouble opening the app?
          </h2>
          <p className="text-on-surface-variant">
            Common questions about installing LazySheet.
          </p>
        </div>

        <Accordion
          type="single"
          collapsible
          defaultValue="unsigned"
          className="overflow-hidden rounded-xl border border-surface-container-high bg-white px-6 md:px-8"
        >
          <AccordionItem value="unsigned" className="border-surface-container-high">
            <AccordionTrigger className="py-6 text-base">
              <span className="flex items-center gap-3">
                <span className="inline-flex shrink-0 rounded-lg bg-secondary-container p-2 text-[var(--st-secondary)]">
                  <LockIcon className="text-[16px]" />
                </span>
                <span className="font-display font-semibold text-on-surface">
                  macOS says LazySheet is “damaged” or from an “unidentified
                  developer”
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-6">
              <p className="mb-4 text-on-surface-variant">
                LazySheet isn’t code-signed with an Apple Developer certificate
                yet, so macOS Gatekeeper quarantines it and blocks it from
                opening. The app is safe — you just need to remove the
                quarantine flag. Open the{' '}
                <span className="inline-flex items-center gap-1 font-medium text-on-surface">
                  <TerminalIcon className="text-[14px]" />
                  Terminal
                </span>{' '}
                app and run:
              </p>

              <CopyCommand command={'xattr -dr com.apple.quarantine "/Applications/LazySheet.app"'} />

              <p className="mt-4 text-sm text-on-surface-variant">
                After it finishes, open LazySheet normally from Applications. If
                you installed it elsewhere, change the path to match its
                location.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </section>
  )
}

function Home() {
  const data = Route.useLoaderData()
  return (
    <div className="min-h-screen">
      <Nav overHero />
      <main>
        <Hero data={data} />
        <Formats />
        <Features />
        <Faq />
      </main>
      <Footer />
    </div>
  )
}
