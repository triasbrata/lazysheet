import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useLocation } from '@tanstack/react-router'
import { SUPPORTED_LOCALES, LOCALE_META, isLocale, type Locale } from '#/i18n/config'

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { locale?: string }
  const location = useLocation()

  const currentLocale: Locale = isLocale(params.locale ?? '') ? (params.locale as Locale) : (i18n.language as Locale) || 'en'

  // Derive the sub-path after the locale prefix (e.g. '' for home, '/download' for download page)
  const subPath = location.pathname.replace(new RegExp(`^/${currentLocale}(/|$)`), '/')

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const target = e.target.value as Locale
    const newPath = `/${target}${subPath === '/' ? '' : subPath}`
    void navigate({ to: newPath })
  }

  return (
    <select
      value={currentLocale}
      onChange={handleChange}
      aria-label="Select language"
      className="cursor-pointer rounded-lg border border-surface-container-high bg-transparent px-2 py-1 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary"
    >
      {SUPPORTED_LOCALES.map((locale) => (
        <option key={locale} value={locale}>
          {LOCALE_META[locale].label}
        </option>
      ))}
    </select>
  )
}
