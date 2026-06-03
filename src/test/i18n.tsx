import type React from 'react'
import { render } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { createI18nInstance } from '#/i18n/config'

// Singleton English i18n instance for tests — avoids re-creating on every render
export const enInstance = createI18nInstance('en')

/**
 * Wraps a UI component in an English I18nextProvider for testing.
 * Existing English string assertions continue to pass unchanged.
 */
export function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={enInstance}>{ui}</I18nextProvider>)
}
