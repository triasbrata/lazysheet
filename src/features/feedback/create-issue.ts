import { createServerFn } from '@tanstack/react-start'

export type FeedbackType = 'bug' | 'feature' | 'other'

export interface CreateIssueInput {
  type: FeedbackType
  title: string
  description: string
  contact?: string
  company?: string // honeypot — must be empty
  turnstileToken?: string
}

export interface CreateIssueResult {
  url: string // issue html_url
  number: number
}

const REPO = 'triasbrata/lazysheet'
const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

function labelFor(type: FeedbackType): string {
  if (type === 'bug') return 'bug'
  if (type === 'feature') return 'enhancement'
  return 'question'
}

export const createIssue = createServerFn({ method: 'POST' })
  .inputValidator((data: CreateIssueInput) => data)
  .handler(async ({ data }): Promise<CreateIssueResult> => {
    // 1. Honeypot: if company field is non-empty, silently drop the request
    if (data.company && data.company.trim().length > 0) {
      return { url: '', number: 0 }
    }

    // 2. Verify Turnstile token
    const secret =
      (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
        ?.TURNSTILE_SECRET_KEY
    if (!secret) {
      throw new Error('server_misconfigured')
    }
    if (!data.turnstileToken) {
      throw new Error('captcha_failed')
    }
    const form = new URLSearchParams({ secret, response: data.turnstileToken })
    const vres = await fetch(TURNSTILE_VERIFY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    const vjson = (await vres.json()) as { success: boolean }
    if (!vres.ok || !vjson.success) {
      throw new Error('captcha_failed')
    }

    // 3. Trim and validate inputs
    const title = data.title.trim()
    const description = data.description.trim()

    const validTypes: FeedbackType[] = ['bug', 'feature', 'other']
    if (
      !validTypes.includes(data.type) ||
      title.length < 3 ||
      title.length > 120 ||
      description.length < 10 ||
      description.length > 5000
    ) {
      throw new Error('invalid_input')
    }

    // 4. Read token via the same cast pattern as releases-data.ts
    const token =
      (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
        ?.GITHUB_TOKEN
    if (!token) {
      throw new Error('server_misconfigured')
    }

    // 5. Build labels
    const labels = ['feedback', labelFor(data.type)]

    // 6. Compose markdown body
    const contact = data.contact?.trim()
    const body =
      `**Type:** ${data.type}\n\n` +
      description +
      (contact ? `\n\n**Contact:** ${contact}` : '') +
      '\n\n---\n_Submitted via lazysheet.brata.cloud feedback form_'

    // 7. POST to GitHub Issues API
    const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'lazysheet-landing',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body, labels }),
    })

    // 8. Handle non-OK responses
    if (!res.ok) {
      throw new Error(`github_${res.status}`)
    }

    // 9. Return the created issue data
    const json = (await res.json()) as { html_url: string; number: number }
    return { url: json.html_url, number: json.number }
  })
