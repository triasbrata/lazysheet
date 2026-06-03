import { createFileRoute, Link } from '@tanstack/react-router'
import { Nav } from '#/components/site/nav'
import { Footer } from '#/components/site/footer'

type GuideStep = {
  n: number
  title: string
  body: string
  img: string
  alt: string
}

const STEPS: GuideStep[] = [
  {
    n: 1,
    title: 'Open any file',
    body: 'Press ⌘O to open the file picker, or simply drag and drop a file onto the window. LazySheet supports xlsx, xls, csv, and tsv — no conversion needed.',
    img: '/shots/guide/guide-1-open.png',
    alt: 'Native file picker showing CSV files in Downloads folder',
  },
  {
    n: 2,
    title: 'Browse instantly',
    body: 'Your data loads in milliseconds. Scroll through hundreds of thousands of rows with zero lag — every column visible at a glance, exactly as it appears in the source file.',
    img: '/shots/guide/guide-2-grid.png',
    alt: 'Full data grid displaying all columns of a large CSV file',
  },
  {
    n: 3,
    title: 'Filter columns',
    body: "Click any column header's filter icon to open the filter popover. Pick specific values from a searchable list, or set a condition like \"greater than\" or \"contains\" to narrow down your data instantly.",
    img: '/shots/guide/guide-3-filter.png',
    alt: 'Column filter popover with searchable value checkboxes and condition options',
  },
  {
    n: 4,
    title: 'Instant stats',
    body: 'Select any range of cells and the status bar at the bottom shows live aggregate stats — SUM, AVG, MIN, MAX, and COUNT — without writing a single formula.',
    img: '/shots/guide/guide-4-stats.png',
    alt: 'Selection stats bar showing SUM, AVG, MIN, MAX, and COUNT for selected cells',
  },
  {
    n: 5,
    title: 'Group-by & aggregate',
    body: 'Open "Summarize selection" to aggregate one column grouped by another — choose SUM, AVG, MIN, MAX, or COUNT. Then copy the result as Markdown or TSV to paste straight into your notes, docs, or a message.',
    img: '/shots/guide/guide-5-groupby.png',
    alt: 'Group-by summary panel with aggregate options and Copy Markdown / Copy TSV buttons',
  },
  {
    n: 6,
    title: 'Command palette',
    body: 'Press ⌘K (or click the search bar) to open the command palette. Quickly jump to a cell with Goto, run Summarize selection (⌘⇧Y), Copy file, Copy file path, or Open a new file — all from the keyboard.',
    img: '/shots/guide/guide-6-command-palette.png',
    alt: 'Command palette showing Goto, Summarize selection, Copy file, Copy file path, and Open file commands',
  },
]

export const Route = createFileRoute('/guide')({
  component: Guide,
  head: () => ({
    meta: [
      { title: 'How to use LazySheet — Guide' },
      {
        name: 'description',
        content:
          'Learn how to open, browse, filter, and analyze spreadsheets with LazySheet in six quick steps.',
      },
    ],
  }),
})

function Guide() {
  return <GuideView />
}

export function GuideView() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="pt-20">
        <section className="px-4 pt-20 pb-12 text-center md:px-16">
          <h1 className="font-display mb-4 text-5xl font-bold tracking-[-0.03em] text-on-surface sm:text-6xl">
            How to use LazySheet
          </h1>
          <p className="mx-auto max-w-[640px] text-lg text-on-surface-variant">
            Open a file and start analyzing in seconds — no setup, no formulas required.
          </p>
        </section>

        <div className="mx-auto max-w-[1100px] px-4 pb-24 md:px-8">
          <div className="flex flex-col gap-20">
            {STEPS.map((s) => (
              <GuideStepRow key={s.n} step={s} />
            ))}
          </div>

          <div className="mt-20 flex justify-center">
            <Link
              to="/download"
              className="rounded-xl bg-[var(--st-green)] px-8 py-4 text-lg font-bold text-white no-underline transition-all hover:opacity-90"
            >
              Download LazySheet
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function GuideStepRow({ step }: { step: GuideStep }) {
  const isEven = step.n % 2 === 0

  const textCol = (
    <div className="flex flex-col gap-3">
      <span className="w-fit rounded-full bg-secondary-container px-3 py-1 text-xs font-semibold text-[var(--st-secondary)]">
        Step {step.n}
      </span>
      <h2 className="font-display text-2xl font-semibold text-on-surface sm:text-3xl">
        {step.title}
      </h2>
      <p className="text-on-surface-variant leading-relaxed">{step.body}</p>
    </div>
  )

  const imageCol = (
    <figure className="m-0 overflow-hidden rounded-xl border border-surface-container-highest bg-white shadow-2xl">
      <img
        src={step.img}
        alt={step.alt}
        loading="lazy"
        className="h-auto w-full"
      />
    </figure>
  )

  return (
    <div className="grid items-center gap-8 md:grid-cols-2">
      {isEven ? (
        <>
          <div className="md:order-2">{textCol}</div>
          <div className="md:order-1">{imageCol}</div>
        </>
      ) : (
        <>
          {textCol}
          {imageCol}
        </>
      )}
    </div>
  )
}
