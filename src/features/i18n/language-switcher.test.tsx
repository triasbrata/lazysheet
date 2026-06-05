// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, screen, fireEvent } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mutable refs used inside vi.hoisted so the mock factory can close over them
// ---------------------------------------------------------------------------
const { navSpy, paramsRef, locationRef } = vi.hoisted(() => {
  const navSpy = vi.fn()
  const paramsRef = { value: {} as { locale?: string } }
  const locationRef = { value: { pathname: '/en' } }
  return { navSpy, paramsRef, locationRef }
})

// ---------------------------------------------------------------------------
// Mock @tanstack/react-router — must appear above module-under-test imports
// ---------------------------------------------------------------------------
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navSpy,
    useParams: () => paramsRef.value,
    useLocation: () => locationRef.value,
  }
})

// ---------------------------------------------------------------------------
// Mock shadcn Select with a native <select> so Radix UI is not involved.
// The native element fires onChange -> we bridge to onValueChange.
// ---------------------------------------------------------------------------
vi.mock('#/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string
    onValueChange: (v: string) => void
    children: React.ReactNode
  }) => (
    <select
      data-testid="language-select"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string
    children: React.ReactNode
  }) => <option value={value}>{children}</option>,
}))

// ---------------------------------------------------------------------------
// Module under test (imported after mocks)
// ---------------------------------------------------------------------------
import { render } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { LanguageSwitcher } from './language-switcher'
import { renderWithI18n, enInstance } from '#/test/i18n'
import { createI18nInstance } from '#/i18n/config'

afterEach(cleanup)
afterEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function renderSwitcher() {
  return renderWithI18n(<LanguageSwitcher />)
}

/**
 * Renders with an i18n instance whose language is forced to empty string,
 * exercising the `|| 'en'` fallback branch in the currentLocale expression.
 */
function renderSwitcherWithNoLanguage() {
  const instance = createI18nInstance('en')
  // Temporarily blank out the language to simulate the || 'en' branch
  Object.defineProperty(instance, 'language', { get: () => '', configurable: true })
  return render(
    <I18nextProvider i18n={instance}>
      <LanguageSwitcher />
    </I18nextProvider>,
  )
}

function getSelect() {
  return screen.getByTestId('language-select') as HTMLSelectElement
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('LanguageSwitcher — currentLocale derivation', () => {
  it('uses params.locale when it is a valid locale (e.g. "id")', () => {
    paramsRef.value = { locale: 'id' }
    locationRef.value = { pathname: '/id' }

    renderSwitcher()

    expect(getSelect().value).toBe('id')
  })

  it('falls back to i18n.language ("en") when params.locale is invalid', () => {
    // 'xx' is not in SUPPORTED_LOCALES
    paramsRef.value = { locale: 'xx' }
    locationRef.value = { pathname: '/xx' }

    renderSwitcher()

    // The renderWithI18n helper uses an 'en' i18n instance
    expect(getSelect().value).toBe('en')
  })

  it('falls back to "en" when params.locale is undefined', () => {
    paramsRef.value = {}
    locationRef.value = { pathname: '/en' }

    renderSwitcher()

    expect(getSelect().value).toBe('en')
  })

  it('falls back to hard-coded "en" when both params.locale is invalid AND i18n.language is empty', () => {
    // This covers the `|| 'en'` literal branch: (i18n.language as Locale) || 'en'
    paramsRef.value = { locale: 'xx' }
    locationRef.value = { pathname: '/en' }

    renderSwitcherWithNoLanguage()

    expect(getSelect().value).toBe('en')
  })

  it('renders all supported locales as options', () => {
    paramsRef.value = { locale: 'en' }
    locationRef.value = { pathname: '/en' }

    renderSwitcher()

    const select = getSelect()
    const optionValues = Array.from(select.options).map((o) => o.value)
    expect(optionValues).toContain('en')
    expect(optionValues).toContain('id')
    expect(optionValues).toContain('zh')
    expect(optionValues).toContain('es')
  })
})

describe('LanguageSwitcher — handleChange navigation', () => {
  it('navigates to "/<new>" when subPath is "/" (pathname is "/<locale>")', () => {
    paramsRef.value = { locale: 'en' }
    // pathname = '/en' → after stripping the locale prefix the subPath is '/'
    locationRef.value = { pathname: '/en' }

    renderSwitcher()

    fireEvent.change(getSelect(), { target: { value: 'id' } })

    expect(navSpy).toHaveBeenCalledTimes(1)
    expect(navSpy).toHaveBeenCalledWith({ to: '/id' })
  })

  it('navigates to "/<new><subPath>" when there is a sub-path (e.g. "/en/guide" → "/id/guide")', () => {
    paramsRef.value = { locale: 'en' }
    locationRef.value = { pathname: '/en/guide' }

    renderSwitcher()

    fireEvent.change(getSelect(), { target: { value: 'id' } })

    expect(navSpy).toHaveBeenCalledTimes(1)
    expect(navSpy).toHaveBeenCalledWith({ to: '/id/guide' })
  })

  it('navigates correctly when switching from "id" locale on a nested path', () => {
    paramsRef.value = { locale: 'id' }
    locationRef.value = { pathname: '/id/download' }

    renderSwitcher()

    fireEvent.change(getSelect(), { target: { value: 'zh' } })

    expect(navSpy).toHaveBeenCalledWith({ to: '/zh/download' })
  })

  it('navigates to root path "/<new>" (no trailing slash) when switching from home', () => {
    paramsRef.value = { locale: 'es' }
    locationRef.value = { pathname: '/es' }

    renderSwitcher()

    fireEvent.change(getSelect(), { target: { value: 'en' } })

    // subPath is '/' → newPath should be '/en' (not '/en/')
    expect(navSpy).toHaveBeenCalledWith({ to: '/en' })
  })
})
