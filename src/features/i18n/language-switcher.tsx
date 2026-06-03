import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useLocation } from '@tanstack/react-router'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { SUPPORTED_LOCALES, LOCALE_META, isLocale, type Locale } from '#/i18n/config'

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { locale?: string }
  const location = useLocation()

  const currentLocale: Locale = isLocale(params.locale ?? '') ? (params.locale as Locale) : (i18n.language as Locale) || 'en'

  // Derive the sub-path after the locale prefix (e.g. '' for home, '/download' for download page)
  const subPath = location.pathname.replace(new RegExp(`^/${currentLocale}(/|$)`), '/')

  const handleChange = (value: string) => {
    const target = value as Locale
    const newPath = `/${target}${subPath === '/' ? '' : subPath}`
    void navigate({ to: newPath })
  }

  return (
    <Select value={currentLocale} onValueChange={handleChange}>
      <SelectTrigger aria-label="Select language" className="h-9 w-auto gap-2 text-sm font-medium">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LOCALES.map((locale) => (
          <SelectItem key={locale} value={locale}>
            <span className="mr-2">{LOCALE_META[locale].flag}</span>
            {LOCALE_META[locale].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
