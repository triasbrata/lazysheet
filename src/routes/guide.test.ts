import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_LOCALE } from '#/i18n/config'

// Stub createFileRoute so the module loads in Node without router internals.
// We keep `redirect` real so the thrown value has the authentic shape.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (opts: any) => ({ options: opts }),
  }
})

import { Route } from './guide'

describe('Route /guide — redirect to locale guide', () => {
  it('throws a redirect Response', () => {
    expect(() => Route.options.beforeLoad({} as any)).toThrow()
  })

  it('redirects to /$locale/guide with DEFAULT_LOCALE param', () => {
    let thrown: unknown
    try {
      Route.options.beforeLoad({} as any)
    } catch (e) {
      thrown = e
    }

    // redirect() returns a Response with an .options property
    expect(thrown).toBeInstanceOf(Response)
    const r = thrown as Response & { options: any }
    expect(r.options.to).toBe('/$locale/guide')
    expect(r.options.params).toEqual({ locale: DEFAULT_LOCALE })
    expect(DEFAULT_LOCALE).toBe('en')
  })
})
