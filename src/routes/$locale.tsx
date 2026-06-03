import { useMemo } from 'react'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { I18nextProvider } from 'react-i18next'
import { createI18nInstance, DEFAULT_LOCALE, isLocale, type Locale } from '#/i18n/config'
import { getSeoMeta, getHreflangLinks } from '#/i18n/seo'

export const Route = createFileRoute('/$locale')({
  beforeLoad: ({ params }) => {
    if (!isLocale(params.locale)) {
      throw redirect({ to: '/$locale', params: { locale: DEFAULT_LOCALE } })
    }
  },
  head: ({ params }) => {
    const locale: Locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE
    return {
      meta: getSeoMeta(locale),
      links: getHreflangLinks(locale),
    }
  },
  component: LocaleLayout,
})

function LocaleLayout() {
  const { locale } = Route.useParams()
  const safeLocale: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE
  const i18n = useMemo(() => createI18nInstance(safeLocale), [safeLocale])

  return (
    <I18nextProvider i18n={i18n}>
      <Outlet />
    </I18nextProvider>
  )
}
