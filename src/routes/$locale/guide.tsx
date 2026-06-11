import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Nav } from '#/components/site/nav'
import { Footer } from '#/components/site/footer'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { DEFAULT_LOCALE, isLocale, resources, type Locale } from '#/i18n/config'

type GuideStep = {
  n: number
  key: string
  img: string
}

const STEPS: GuideStep[] = [
  { n: 1, key: 'open', img: '/shots/guide/guide-1-open.png' },
  { n: 2, key: 'browse', img: '/shots/guide/guide-2-grid.png' },
  { n: 3, key: 'setheader', img: '/shots/guide/guide-7-set-header.png' },
  { n: 4, key: 'filter', img: '/shots/guide/guide-3-filter.png' },
  { n: 5, key: 'stats', img: '/shots/guide/guide-4-stats.png' },
  { n: 6, key: 'groupby', img: '/shots/guide/guide-5-groupby.png' },
  { n: 7, key: 'copyformats', img: '/shots/guide/guide-8-copy-formats.png' },
  { n: 8, key: 'dragout', img: '/shots/guide/guide-9-drag-out.gif' },
  { n: 9, key: 'command', img: '/shots/guide/guide-6-command-palette.png' },
]

type GuideTranslation = {
  pageTitle: string
  pageDescription: string
}

export const Route = createFileRoute('/$locale/guide')({
  component: Guide,
  head: ({ params }) => {
    const locale: Locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE
    const guide = (resources[locale].translation as { guide: GuideTranslation }).guide
    return {
      meta: [
        { title: guide.pageTitle },
        { name: 'description', content: guide.pageDescription },
      ],
    }
  },
})

function Guide() {
  return <GuideView />
}

export function GuideView() {
  const { t } = useTranslation()
  const params = useParams({ strict: false }) as { locale?: string }
  const locale: Locale = isLocale(params.locale ?? '') ? (params.locale as Locale) : DEFAULT_LOCALE
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="pt-20">
        <section className="px-4 pt-20 pb-12 text-center md:px-16">
          <h1 className="font-display mb-4 text-5xl font-bold tracking-[-0.03em] text-on-surface sm:text-6xl">
            {t('guide.heading')}
          </h1>
          <p className="mx-auto max-w-[640px] text-lg text-on-surface-variant">
            {t('guide.subtitle')}
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
              to="/$locale/download"
              params={{ locale }}
              className="rounded-xl bg-[var(--st-green)] px-8 py-4 text-lg font-bold text-white no-underline transition-all hover:opacity-90"
            >
              {t('guide.ctaDownload')}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function GuideStepRow({ step }: { step: GuideStep }) {
  const { t } = useTranslation()
  const isEven = step.n % 2 === 0
  const stepLabel = t('guide.stepLabel', { n: step.n })
  const title = t(`guide.steps.${step.key}.title`)
  const body = t(`guide.steps.${step.key}.body`)
  const alt = t(`guide.steps.${step.key}.alt`)

  const textCol = (
    <div className="flex flex-col gap-3">
      <span className="w-fit rounded-full bg-secondary-container px-3 py-1 text-xs font-semibold text-[var(--st-secondary)]">
        {stepLabel}
      </span>
      <h2 className="font-display text-2xl font-semibold text-on-surface sm:text-3xl">
        {title}
      </h2>
      <p className="text-on-surface-variant leading-relaxed">{body}</p>
    </div>
  )

  // Click the image to zoom: a lightbox dialog with the enlarged image on the
  // left (80%) and the step's title + description on the right (20%).
  const imageCol = (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={title}
          className="group m-0 block w-full cursor-zoom-in overflow-hidden rounded-xl border border-surface-container-highest bg-white p-0 shadow-2xl"
        >
          <img
            src={step.img}
            alt={alt}
            loading="lazy"
            className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[92vw] gap-0 overflow-hidden p-0 sm:max-w-[92vw]">
        <div className="grid max-h-[88vh] grid-cols-1 lg:grid-cols-[4fr_1fr]">
          <div className="flex items-center justify-center bg-black/5 p-2 md:p-4">
            <img
              src={step.img}
              alt={alt}
              className="max-h-[86vh] w-full rounded-md object-contain"
            />
          </div>
          <div className="flex flex-col gap-3 p-6">
            <span className="w-fit rounded-full bg-secondary-container px-3 py-1 text-xs font-semibold text-[var(--st-secondary)]">
              {stepLabel}
            </span>
            <DialogTitle className="font-display text-2xl font-semibold text-on-surface">
              {title}
            </DialogTitle>
            <DialogDescription className="text-on-surface-variant leading-relaxed">
              {body}
            </DialogDescription>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="grid items-center gap-6 md:gap-8 md:grid-cols-2">
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
