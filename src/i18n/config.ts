import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import id from './locales/id.json'
import zh from './locales/zh.json'
import es from './locales/es.json'

export const SUPPORTED_LOCALES = ['en', 'id', 'zh', 'es'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'

export const LOCALE_META: Record<Locale, { htmlLang: string; ogLocale: string; label: string }> = {
  en: { htmlLang: 'en', ogLocale: 'en_US', label: 'English' },
  id: { htmlLang: 'id', ogLocale: 'id_ID', label: 'Bahasa Indonesia' },
  zh: { htmlLang: 'zh-CN', ogLocale: 'zh_CN', label: '简体中文' },
  es: { htmlLang: 'es', ogLocale: 'es_ES', label: 'Español' },
}

export const resources: Record<Locale, { translation: object }> = {
  en: { translation: en },
  id: { translation: id },
  zh: { translation: zh },
  es: { translation: es },
}

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export function createI18nInstance(locale: Locale) {
  const instance = i18next.createInstance()
  instance.use(initReactI18next).init({
    resources,
    lng: locale,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
  return instance
}

export function localeFromPathname(pathname: string): Locale {
  const seg = pathname.split('/').filter(Boolean)[0] ?? ''
  return isLocale(seg) ? seg : DEFAULT_LOCALE
}
