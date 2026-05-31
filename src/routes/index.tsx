import { createFileRoute, Link } from '@tanstack/react-router'
import { Nav } from '#/components/site/nav'
import { Footer } from '#/components/site/footer'
import {
  ExcelIcon,
  CsvIcon,
  TsvIcon,
  BoltIcon,
  CheckIcon,
  LayersIcon,
  PaletteIcon,
  CopyIcon,
  AppleMark,
  GroupIcon,
  SearchIcon,
  FilterIcon,
  PinIcon,
  ResizeIcon,
  KeyboardIcon,
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

const SMALL_FEATURES = [
  {
    Icon: LayersIcon,
    title: 'Multi-sheet Navigation',
    desc: 'Switch between worksheet tabs in any workbook from the bottom tab bar.',
  },
  {
    Icon: SearchIcon,
    title: 'Find in Sheet',
    desc: 'Full-text search with Cmd+F. Jump between matches highlighted across the sheet.',
  },
  {
    Icon: FilterIcon,
    title: 'Column Filters',
    desc: 'Click the funnel on any header. 14 filter types plus an Excel-style value checklist.',
  },
  {
    Icon: PinIcon,
    title: 'Sticky Header Row',
    desc: 'Mark any row as the header — it stays pinned while you scroll through the data.',
  },
  {
    Icon: ResizeIcon,
    title: 'Resizable Columns & Rows',
    desc: 'Drag to resize, double-click to autofit. Sizes are remembered per file.',
  },
  {
    Icon: KeyboardIcon,
    title: 'Command Palette',
    desc: 'Cmd+K to jump to any cell reference or run an action — keyboard-first navigation.',
  },
  {
    Icon: PaletteIcon,
    title: 'Rich Cell Formatting',
    desc: 'Fonts, colors, alignment, merged cells, and clickable hyperlinks preserved from .xlsx files.',
  },
  {
    Icon: CopyIcon,
    title: 'Copy as Image',
    desc: 'Capture a group-by summary report as a PNG straight to your clipboard.',
  },
  {
    Icon: AppleMark,
    title: 'Native macOS Integration',
    desc: "Drag & drop, 'Open With', and Recent Files support built in.",
  },
]

function Hero({ data }: { data: DownloadData }) {
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

function Formats() {
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
    <section id="features" className="mx-auto max-w-[1200px] px-4 py-24 md:px-16">
      <div className="mb-16 text-center">
        <h2 className="font-display mb-4 text-[40px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[48px] sm:leading-[56px]">
          Engineered for Performance
        </h2>
        <p className="text-on-surface-variant">
          The feature set you need to analyze data without the bloat.
        </p>
      </div>

      <div className="bento-grid">
        {/* Group-by Summary — large */}
        <div className="feature-card col-span-12 rounded-xl border border-surface-container-high bg-white p-8 md:col-span-8">
          <div className="flex flex-col items-center gap-8 md:flex-row">
            <div className="flex-1">
              <span className="mb-6 inline-flex rounded-lg bg-primary-fixed p-3 text-primary">
                <GroupIcon className="text-[22px]" />
              </span>
              <h3 className="font-display mb-4 text-2xl font-semibold">
                Group-by Summary
              </h3>
              <p className="mb-6 text-on-surface-variant">
                Summarize data by any column in seconds. Select a range, choose your category and value columns, and get instant roll-ups with SUM, AVG, MIN, MAX, and COUNT — no pivot-table setup.
              </p>
              <ul className="space-y-2 text-sm font-medium text-on-surface">
                <li className="flex items-center gap-2">
                  <CheckIcon className="text-[16px] text-primary" />
                  Multi-level grouping across up to 6 columns
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon className="text-[16px] text-primary" />
                  Instant SUM / AVG / MIN / MAX / COUNT on any range selection
                </li>
              </ul>
            </div>
            <div className="flex-1 overflow-hidden rounded-lg border border-surface-container-high">
              <img
                src="/shots/application-summary.png"
                alt="Group-by summary in LazySheet"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Virtualized Rendering — speed */}
        <div className="feature-card col-span-12 flex flex-col justify-between rounded-xl border border-surface-container-high bg-white p-8 md:col-span-4">
          <div>
            <span className="mb-6 inline-flex rounded-lg bg-secondary-container p-3 text-[var(--st-secondary)]">
              <BoltIcon className="text-[22px]" />
            </span>
            <h3 className="font-display mb-4 text-2xl font-semibold">
              Virtualized Rendering
            </h3>
            <p className="text-on-surface-variant">
              LazySheet only renders the rows you can see. Scroll through massive sheets with smooth, lag-free movement regardless of hardware.
            </p>
          </div>
          <div className="mt-8 border-t border-surface-container-high pt-8">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Scroll Latency</span>
              <span className="font-bold text-primary">0.1ms</span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div className="h-full w-[10%] bg-primary" />
            </div>
          </div>
        </div>

        {/* Small feature cards */}
        {SMALL_FEATURES.map((f) => (
          <div
            key={f.title}
            className="feature-card col-span-12 rounded-xl border border-surface-container-high bg-white p-6 sm:col-span-6 md:col-span-4"
          >
            <f.Icon className="mb-4 text-[22px] text-primary" />
            <h4 className="font-display mb-2 text-sm font-bold">{f.title}</h4>
            <p className="text-sm text-on-surface-variant">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Faq() {
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
      <Nav />
      <main className="pt-16">
        <Hero data={data} />
        <Formats />
        <Features />
        <Faq />
      </main>
      <Footer />
    </div>
  )
}
