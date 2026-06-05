import { describe, it, expect } from 'vitest'
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_META,
  resources,
  isLocale,
  localeFromPathname,
  createI18nInstance,
} from './config'

describe('constants', () => {
  it('SUPPORTED_LOCALES contains the expected locales', () => {
    expect(SUPPORTED_LOCALES).toEqual(['en', 'id', 'zh', 'es'])
  })

  it('DEFAULT_LOCALE is en', () => {
    expect(DEFAULT_LOCALE).toBe('en')
  })

  it('LOCALE_META has entries for every supported locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(LOCALE_META[locale]).toBeDefined()
      expect(typeof LOCALE_META[locale].htmlLang).toBe('string')
      expect(typeof LOCALE_META[locale].ogLocale).toBe('string')
      expect(typeof LOCALE_META[locale].label).toBe('string')
      expect(typeof LOCALE_META[locale].flag).toBe('string')
    }
  })

  it('resources has translation entries for every supported locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(resources[locale]).toBeDefined()
      expect(resources[locale].translation).toBeDefined()
    }
  })
})

describe('isLocale', () => {
  it.each(SUPPORTED_LOCALES as unknown as string[])('returns true for supported locale "%s"', (locale) => {
    expect(isLocale(locale)).toBe(true)
  })

  it('returns false for unsupported locale "fr"', () => {
    expect(isLocale('fr')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isLocale('')).toBe(false)
  })

  it('returns false for arbitrary string', () => {
    expect(isLocale('xx')).toBe(false)
  })
})

describe('localeFromPathname', () => {
  it('returns the locale segment when a supported locale is first', () => {
    expect(localeFromPathname('/id/some/path')).toBe('id')
  })

  it('returns en locale from /en/... path', () => {
    expect(localeFromPathname('/en/something')).toBe('en')
  })

  it('returns zh locale from /zh/... path', () => {
    expect(localeFromPathname('/zh/page')).toBe('zh')
  })

  it('returns es locale from /es/ path', () => {
    expect(localeFromPathname('/es/')).toBe('es')
  })

  it('returns DEFAULT_LOCALE for unsupported first segment', () => {
    expect(localeFromPathname('/fr/page')).toBe(DEFAULT_LOCALE)
  })

  it('returns DEFAULT_LOCALE for root pathname "/"', () => {
    expect(localeFromPathname('/')).toBe(DEFAULT_LOCALE)
  })

  it('returns DEFAULT_LOCALE for empty string', () => {
    expect(localeFromPathname('')).toBe(DEFAULT_LOCALE)
  })

  it('returns DEFAULT_LOCALE when first segment is not a locale', () => {
    expect(localeFromPathname('/about')).toBe(DEFAULT_LOCALE)
  })

  it('returns locale even without leading slash', () => {
    expect(localeFromPathname('id/page')).toBe('id')
  })
})

describe('createI18nInstance', () => {
  it('creates an instance with the correct language for "en"', async () => {
    const instance = createI18nInstance('en')
    // Wait for async init to settle
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(instance.language).toBe('en')
  })

  it('creates an instance with the correct language for "id"', async () => {
    const instance = createI18nInstance('id')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(instance.language).toBe('id')
  })

  it('translates a known key in "en"', async () => {
    const instance = createI18nInstance('en')
    await new Promise((resolve) => setTimeout(resolve, 0))
    // nav.features exists in all locales
    const result = instance.t('nav.features')
    expect(result).toBe('Features')
  })

  it('translates a known key in "id" to a different (localized) string', async () => {
    const instance = createI18nInstance('id')
    await new Promise((resolve) => setTimeout(resolve, 0))
    const result = instance.t('nav.features')
    expect(result).toBe('Fitur')
  })

  it('translates a known key in "zh"', async () => {
    const instance = createI18nInstance('zh')
    await new Promise((resolve) => setTimeout(resolve, 0))
    const result = instance.t('nav.features')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    // zh.features should differ from english
    expect(result).not.toBe('Features')
  })

  it('translates a known key in "es"', async () => {
    const instance = createI18nInstance('es')
    await new Promise((resolve) => setTimeout(resolve, 0))
    const result = instance.t('nav.features')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    expect(result).not.toBe('Features')
  })

  it('creates independent instances for different locales', async () => {
    const en = createI18nInstance('en')
    const id = createI18nInstance('id')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(en.t('nav.download')).toBe('Download')
    expect(id.t('nav.download')).toBe('Unduh')
  })
})
