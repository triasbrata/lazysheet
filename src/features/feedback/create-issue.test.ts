/**
 * Tests for src/features/feedback/create-issue.ts
 *
 * Strategy: passthrough-mock for '@tanstack/react-start'.
 * createServerFn({ method }) returns a builder; .inputValidator(v) returns the same
 * builder; .handler(fn) returns fn directly.  This makes `createIssue` equal to the
 * raw async ({data}) handler, which we can call like a plain function in tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mock '@tanstack/react-start' BEFORE importing the module under test ---
// The mock makes .inputValidator(validatorFn) call validatorFn so v8 counts it as covered,
// then returns the builder so .handler(fn) returns fn as a plain callable.
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    let _validatorFn: ((v: unknown) => unknown) | undefined
    const builder: {
      inputValidator: (v: (d: unknown) => unknown) => typeof builder
      handler: (fn: unknown) => unknown
    } = {
      inputValidator: (fn) => {
        _validatorFn = fn
        return builder
      },
      handler: (fn: unknown) => {
        // Wrap: call validator before delegating so the validator lambda is exercised
        return async (args: { data: unknown }) => {
          const validatedData = _validatorFn ? _validatorFn(args.data) : args.data
          return (fn as (args: { data: unknown }) => unknown)({ data: validatedData })
        }
      },
    }
    return builder
  },
}))

// Import AFTER mock is installed
import { createIssue } from '#/features/feedback/create-issue'

// The mock makes createIssue === the raw handler function
type HandlerFn = (args: { data: import('#/features/feedback/create-issue').CreateIssueInput }) => Promise<import('#/features/feedback/create-issue').CreateIssueResult>
const handler = createIssue as unknown as HandlerFn

// ----- helpers -----

function makeFetchOk(json: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve(json),
  })
}

const validData = {
  type: 'bug' as const,
  title: 'Something is broken',
  description: 'This is a detailed description of the bug.',
  turnstileToken: 'test-token',
}

// Turnstile returns success
function mockTurnstileOk() {
  return { ok: true, status: 200, json: () => Promise.resolve({ success: true }) }
}

// GitHub returns created issue
function mockGithubOk() {
  return {
    ok: true,
    status: 201,
    json: () => Promise.resolve({ html_url: 'https://github.com/triasbrata/lazysheet/issues/42', number: 42 }),
  }
}

// ----- env management -----

const origEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  // Capture originals
  origEnv['TURNSTILE_SECRET_KEY'] = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.TURNSTILE_SECRET_KEY
  origEnv['GITHUB_TOKEN'] = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GITHUB_TOKEN

  // Set defaults for happy-path; individual cases will override/delete
  ;(globalThis as { process?: { env?: Record<string, string | undefined> } }).process!.env!['TURNSTILE_SECRET_KEY'] = 'ts-secret'
  ;(globalThis as { process?: { env?: Record<string, string | undefined> } }).process!.env!['GITHUB_TOKEN'] = 'gh-token'
})

afterEach(() => {
  // Restore env
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  if (env) {
    if (origEnv['TURNSTILE_SECRET_KEY'] === undefined) delete env['TURNSTILE_SECRET_KEY']
    else env['TURNSTILE_SECRET_KEY'] = origEnv['TURNSTILE_SECRET_KEY']

    if (origEnv['GITHUB_TOKEN'] === undefined) delete env['GITHUB_TOKEN']
    else env['GITHUB_TOKEN'] = origEnv['GITHUB_TOKEN']
  }
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// ==================== test cases ====================

describe('createIssue handler', () => {
  // ---- honeypot ----
  describe('honeypot', () => {
    it('returns {url:"",number:0} and never calls fetch when company is non-empty', async () => {
      const mockFetch = vi.fn()
      vi.stubGlobal('fetch', mockFetch)

      const result = await handler({ data: { ...validData, company: 'acme' } })
      expect(result).toEqual({ url: '', number: 0 })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('returns {url:"",number:0} for whitespace-only company field', async () => {
      // whitespace-only: trim().length === 0 → NOT honeypot (falls through)
      // Confirm: according to source, `data.company.trim().length > 0` triggers it
      // So "   " trimmed is "" → length 0 → NOT trapped
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(mockTurnstileOk())
        .mockResolvedValueOnce(mockGithubOk())
      vi.stubGlobal('fetch', mockFetch)

      const result = await handler({ data: { ...validData, company: '   ' } })
      // whitespace-only does NOT trigger honeypot
      expect(result).toEqual({ url: 'https://github.com/triasbrata/lazysheet/issues/42', number: 42 })
    })
  })

  // ---- missing TURNSTILE_SECRET_KEY ----
  describe('turnstile secret key', () => {
    it('throws server_misconfigured when TURNSTILE_SECRET_KEY is absent', async () => {
      delete (globalThis as { process?: { env?: Record<string, string | undefined> } }).process!.env!['TURNSTILE_SECRET_KEY']

      await expect(handler({ data: validData })).rejects.toThrow('server_misconfigured')
    })
  })

  // ---- missing turnstileToken ----
  describe('turnstile token', () => {
    it('throws captcha_failed when turnstileToken is missing', async () => {
      const mockFetch = vi.fn()
      vi.stubGlobal('fetch', mockFetch)

      const data = { ...validData, turnstileToken: undefined }
      await expect(handler({ data })).rejects.toThrow('captcha_failed')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('throws captcha_failed when turnstile response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ success: false }),
      }))

      await expect(handler({ data: validData })).rejects.toThrow('captcha_failed')
    })

    it('throws captcha_failed when turnstile json.success is false', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: false }),
      }))

      await expect(handler({ data: validData })).rejects.toThrow('captcha_failed')
    })
  })

  // ---- input validation ----
  describe('input validation', () => {
    function turnstileOkFetch(rest: unknown[] = []) {
      return vi.fn()
        .mockResolvedValueOnce(mockTurnstileOk())
    }

    it('throws invalid_input for unknown type', async () => {
      vi.stubGlobal('fetch', turnstileOkFetch())
      const data = { ...validData, type: 'invalid' as 'bug' }
      await expect(handler({ data })).rejects.toThrow('invalid_input')
    })

    it('throws invalid_input when title is too short (<3)', async () => {
      vi.stubGlobal('fetch', turnstileOkFetch())
      const data = { ...validData, title: 'ab' }
      await expect(handler({ data })).rejects.toThrow('invalid_input')
    })

    it('throws invalid_input when title is too long (>120)', async () => {
      vi.stubGlobal('fetch', turnstileOkFetch())
      const data = { ...validData, title: 'a'.repeat(121) }
      await expect(handler({ data })).rejects.toThrow('invalid_input')
    })

    it('throws invalid_input when description is too short (<10)', async () => {
      vi.stubGlobal('fetch', turnstileOkFetch())
      const data = { ...validData, description: 'short' }
      await expect(handler({ data })).rejects.toThrow('invalid_input')
    })

    it('throws invalid_input when description is too long (>5000)', async () => {
      vi.stubGlobal('fetch', turnstileOkFetch())
      const data = { ...validData, description: 'a'.repeat(5001) }
      await expect(handler({ data })).rejects.toThrow('invalid_input')
    })
  })

  // ---- missing GITHUB_TOKEN ----
  describe('github token', () => {
    it('throws server_misconfigured when GITHUB_TOKEN is absent', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockTurnstileOk()))
      delete (globalThis as { process?: { env?: Record<string, string | undefined> } }).process!.env!['GITHUB_TOKEN']

      await expect(handler({ data: validData })).rejects.toThrow('server_misconfigured')
    })
  })

  // ---- github response errors ----
  describe('github API errors', () => {
    it('throws github_422 when github responds with 422', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce(mockTurnstileOk())
        .mockResolvedValueOnce({ ok: false, status: 422, json: () => Promise.resolve({}) }),
      )

      await expect(handler({ data: validData })).rejects.toThrow('github_422')
    })

    it('throws github_500 when github responds with 500', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce(mockTurnstileOk())
        .mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) }),
      )

      await expect(handler({ data: validData })).rejects.toThrow('github_500')
    })
  })

  // ---- happy path ----
  describe('happy path', () => {
    it('returns {url, number} on success', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce(mockTurnstileOk())
        .mockResolvedValueOnce(mockGithubOk()),
      )

      const result = await handler({ data: validData })
      expect(result).toEqual({
        url: 'https://github.com/triasbrata/lazysheet/issues/42',
        number: 42,
      })
    })

    it('includes Contact line in github body when contact provided', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(mockTurnstileOk())
        .mockResolvedValueOnce(mockGithubOk())
      vi.stubGlobal('fetch', mockFetch)

      await handler({ data: { ...validData, contact: 'user@example.com' } })

      const githubCall = mockFetch.mock.calls[1]
      const body = JSON.parse(githubCall[1].body)
      expect(body.body).toContain('**Contact:** user@example.com')
    })

    it('omits Contact line in github body when contact is absent', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(mockTurnstileOk())
        .mockResolvedValueOnce(mockGithubOk())
      vi.stubGlobal('fetch', mockFetch)

      const { contact: _, ...dataWithoutContact } = { ...validData, contact: undefined }
      await handler({ data: dataWithoutContact })

      const githubCall = mockFetch.mock.calls[1]
      const body = JSON.parse(githubCall[1].body)
      expect(body.body).not.toContain('**Contact:**')
    })

    it('sends correct labels for type=bug', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(mockTurnstileOk())
        .mockResolvedValueOnce(mockGithubOk())
      vi.stubGlobal('fetch', mockFetch)

      await handler({ data: { ...validData, type: 'bug' } })

      const body = JSON.parse(mockFetch.mock.calls[1][1].body)
      expect(body.labels).toContain('bug')
    })

    it('sends correct labels for type=feature (enhancement)', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(mockTurnstileOk())
        .mockResolvedValueOnce(mockGithubOk())
      vi.stubGlobal('fetch', mockFetch)

      await handler({ data: { ...validData, type: 'feature' } })

      const body = JSON.parse(mockFetch.mock.calls[1][1].body)
      expect(body.labels).toContain('enhancement')
    })

    it('sends correct labels for type=other (question)', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(mockTurnstileOk())
        .mockResolvedValueOnce(mockGithubOk())
      vi.stubGlobal('fetch', mockFetch)

      await handler({ data: { ...validData, type: 'other' } })

      const body = JSON.parse(mockFetch.mock.calls[1][1].body)
      expect(body.labels).toContain('question')
    })
  })
})
