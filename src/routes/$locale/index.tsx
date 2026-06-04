import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Nav } from '#/components/site/nav'
import { Footer } from '#/components/site/footer'
import {
  ExcelIcon,
  CsvIcon,
  TsvIcon,
  LockIcon,
  TerminalIcon,
  LinuxMark,
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
import { useBentoTiles } from '#/sections/bento/features'
import { isLocale, DEFAULT_LOCALE, type Locale } from '#/i18n/config'

export const Route = createFileRoute('/$locale/')({
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
  const { t } = useTranslation()
  const params = useParams({ strict: false }) as { locale?: string }
  const locale: Locale = isLocale(params.locale ?? '') ? (params.locale as Locale) : DEFAULT_LOCALE

  return (
    <section className="hero-gradient px-4 pt-24 pb-32 md:px-16">
      <div className="mx-auto max-w-[1200px] text-center">
        <div className="mb-8 flex justify-center">
          <img
            src="/app-icon.png"
            alt={t('hero.iconAlt')}
            className="h-24 w-24 object-contain md:h-32 md:w-32"
          />
        </div>
        <h1 className="font-display mx-auto mb-6 max-w-[900px] text-[40px] font-bold leading-[1.05] tracking-[-0.04em] text-on-surface sm:text-[56px] md:text-[72px] md:leading-[80px]">
          {t('hero.titleLine1')}
          <br />
          <span className="text-primary">{t('hero.titleLine2')}</span>
        </h1>
        <p className="mx-auto mb-12 max-w-[650px] text-lg leading-[28px] text-on-surface-variant">
          {t('hero.subtitle')}
        </p>

        <div className="group mb-16 flex flex-col items-center justify-center">
          <div className="mb-4 flex flex-col items-center justify-center gap-4 md:flex-row">
            <DownloadButton data={data} />
            <Link
              to="/$locale/download"
              params={{ locale }}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#cbd5e1] bg-white px-8 py-5 text-2xl font-bold text-[#4a5568] no-underline transition-all hover:bg-gray-50 md:w-auto"
            >
              {t('hero.otherDownloads')}
            </Link>
          </div>
          <p className="text-sm text-on-surface-variant opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {t('hero.licensePrefix')}{' '}
            <a
              href="https://github.com/triasbrata/lazysheet/blob/main/LICENSE"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {t('hero.license')}
            </a>
            .
          </p>
        </div>

        <div className="relative mx-auto max-w-[1100px] overflow-hidden rounded-xl border border-surface-container-highest bg-white shadow-2xl">
          <img
            src="/shots/application.png"
            alt={t('hero.dashboardAlt')}
            className="h-auto w-full"
          />
        </div>
      </div>
    </section>
  )
}

export function Formats() {
  const { t } = useTranslation()

  return (
    <section className="border-y border-surface-container-high bg-surface-container-low py-20">
      <div className="mx-auto max-w-[1200px] px-4 text-center">
        <h2 className="font-display mb-4 text-3xl font-bold text-on-surface">
          {t('formats.heading')}
        </h2>
        <p className="mb-10 text-on-surface-variant">
          {t('formats.bodyPrefix')}{' '}
          <span className="font-bold text-on-surface">{t('formats.dragDrop')}</span>.
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
  const { t } = useTranslation()
  const tiles = useBentoTiles()

  return (
    <BentoGrid
      tiles={tiles}
      header={
        <div className="mb-8 text-center motion-safe:md:mb-6">
          <h2 className="font-display mb-4 text-[40px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[48px] sm:leading-[56px]">
            {t('features.heading')}
          </h2>
          <p className="text-on-surface-variant">
            {t('features.subtitle')}
          </p>
        </div>
      }
    />
  )
}

export function Faq() {
  const { t } = useTranslation()

  return (
    <section
      id="faq"
      className="border-t border-surface-container-high bg-surface-container-low py-24"
    >
      <div className="mx-auto max-w-[1000px] px-4 md:px-8">
        <div className="mb-12 text-center">
          <h2 className="font-display mb-4 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[40px]">
            {t('faq.heading')}
          </h2>
          <p className="text-on-surface-variant">
            {t('faq.subtitle')}
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
                  {t('faq.unsignedQuestion')}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-6">
              <p className="mb-4 text-on-surface-variant">
                {t('faq.unsignedAnswerPre')}{' '}
                <span className="inline-flex items-center gap-1 font-medium text-on-surface">
                  <TerminalIcon className="text-[14px]" />
                  {t('faq.terminal')}
                </span>{' '}
                app and run:
              </p>

              <CopyCommand command={'xattr -dr com.apple.quarantine "/Applications/LazySheet.app"'} />

              <p className="mt-4 text-sm text-on-surface-variant">
                {t('faq.unsignedAnswerPost')}
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="deb-deps" className="border-t border-surface-container-high">
            <AccordionTrigger className="py-6 text-base">
              <span className="flex items-center gap-3">
                <span className="inline-flex shrink-0 rounded-lg bg-secondary-container p-2 text-[var(--st-secondary)]">
                  <LinuxMark className="text-[16px]" />
                </span>
                <span className="font-display font-semibold text-on-surface">
                  {t('faq.debQuestion')}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-6">
              <p className="mb-4 text-on-surface-variant">
                {t('faq.debAnswerPre')}
              </p>

              <CopyCommand command={'sudo apt install -y libjavascriptcoregtk-4.1-0 libsoup-3.0-0 libsoup-3.0-common libwebkit2gtk-4.1-0'} />

              <p className="mt-4 text-sm text-on-surface-variant">
                {t('faq.debAnswerPost')}
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
