// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest'
import { screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'

// --- Mocks (above imports of the module under test) ---

vi.mock('./create-issue', () => ({
  createIssue: vi.fn(),
}))

vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({
    onSuccess,
    onExpire,
    onError,
  }: {
    onSuccess: (token: string) => void
    onExpire: () => void
    onError: () => void
  }) => (
    <>
      <button data-testid="turnstile" onClick={() => onSuccess('mock-token')}>
        verify
      </button>
      <button data-testid="turnstile-expire" onClick={() => onExpire()}>
        expire
      </button>
      <button data-testid="turnstile-error" onClick={() => onError()}>
        error
      </button>
    </>
  ),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// SITE_KEY timing: feedback-dialog.tsx reads `import.meta.env.VITE_TURNSTILE_SITE_KEY`
// at module evaluation time (line: const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY).
// We must stub the env BEFORE the module loads. We use vi.stubEnv at the top of the file
// combined with vi.resetModules() in beforeAll to ensure a fresh module load with the stub
// in place. The dynamic import inside beforeAll gives us the component after the env is set.

vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-key')

afterEach(cleanup)

import { toast } from 'sonner'
import { createIssue as _createIssue } from './create-issue'
import { renderWithI18n } from '#/test/i18n'

const createIssue = _createIssue as ReturnType<typeof vi.fn>
const mockToast = toast as { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> }

// We dynamically import so the module sees the stubbed env
let FeedbackDialog: (props: { trigger: React.ReactNode }) => React.ReactElement

beforeAll(async () => {
  vi.resetModules()
  const mod = await import('./feedback-dialog')
  FeedbackDialog = mod.FeedbackDialog as typeof FeedbackDialog
})

// Helper: open the dialog by clicking the trigger
function renderDialog() {
  return renderWithI18n(<FeedbackDialog trigger={<button>Open</button>} />)
}

function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: /open/i }))
}

function fillTitle(value: string) {
  fireEvent.change(screen.getByPlaceholderText('Short summary'), { target: { value } })
}

function fillDescription(value: string) {
  fireEvent.change(screen.getByPlaceholderText(/Describe the bug or feature/i), {
    target: { value },
  })
}

function submitForm() {
  // Find the submit button (text "Send" but NOT "Sending…" and NOT inside a button named "verify"/"expire"/"error")
  const form = document.querySelector('form')!
  fireEvent.submit(form)
}

describe('FeedbackDialog (no SITE_KEY — Turnstile hidden)', () => {
  let FeedbackDialogNoKey: (props: { trigger: React.ReactNode }) => React.ReactElement

  beforeAll(async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '')
    vi.resetModules()
    const mod = await import('./feedback-dialog')
    FeedbackDialogNoKey = mod.FeedbackDialog as typeof FeedbackDialog
    // Restore the key so main suite still works
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-key')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders without Turnstile when SITE_KEY is empty', () => {
    renderWithI18n(<FeedbackDialogNoKey trigger={<button>Open</button>} />)
    fireEvent.click(screen.getByRole('button', { name: /open/i }))
    // Turnstile buttons should NOT be present
    expect(screen.queryByTestId('turnstile')).toBeNull()
  })
})

describe('FeedbackDialog', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('opens the dialog when trigger is clicked', () => {
    renderDialog()
    expect(screen.queryByText('Send feedback')).toBeNull()
    openDialog()
    expect(screen.getByText('Send feedback')).toBeTruthy()
  })

  it('shows validation error toast when title is empty and does not call createIssue', async () => {
    renderDialog()
    openDialog()
    submitForm()
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Title and description are required.')
    })
    expect(createIssue).not.toHaveBeenCalled()
  })

  it('shows validation error when description is too short', async () => {
    renderDialog()
    openDialog()
    fillTitle('Valid title')
    fillDescription('short')
    submitForm()
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Title and description are required.')
    })
    expect(createIssue).not.toHaveBeenCalled()
  })

  it('shows captcha error when title+desc valid but captcha not completed', async () => {
    renderDialog()
    openDialog()
    fillTitle('Valid title')
    fillDescription('This is a long enough description for the test.')
    submitForm()
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Please complete the verification.')
    })
    expect(createIssue).not.toHaveBeenCalled()
  })

  it('submits successfully: calls toast.success, resets fields, closes dialog', async () => {
    createIssue.mockResolvedValueOnce({ number: 5, url: 'https://github.com/issues/5' })

    renderDialog()
    openDialog()

    fillTitle('Valid title')
    fillDescription('This is a long enough description for the test.')
    // Complete captcha by clicking the mock turnstile button
    fireEvent.click(screen.getByTestId('turnstile'))
    submitForm()

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Thanks! Issue #5 created.')
    })
    expect(createIssue).toHaveBeenCalledTimes(1)
    // After success the dialog should close (title no longer visible)
    await waitFor(() => {
      expect(screen.queryByText('Send feedback')).toBeNull()
    })
  })

  it('handles honeypot path (number === 0): closes dialog silently, no toast.success', async () => {
    createIssue.mockResolvedValueOnce({ number: 0, url: '' })

    renderDialog()
    openDialog()

    fillTitle('Valid title')
    fillDescription('This is a long enough description for the test.')
    fireEvent.click(screen.getByTestId('turnstile'))
    submitForm()

    await waitFor(() => {
      expect(screen.queryByText('Send feedback')).toBeNull()
    })
    expect(mockToast.success).not.toHaveBeenCalled()
    expect(createIssue).toHaveBeenCalledTimes(1)
  })

  it('handles createIssue rejection: calls toast.error and resets captcha token', async () => {
    createIssue.mockRejectedValueOnce(new Error('network error'))

    renderDialog()
    openDialog()

    fillTitle('Valid title')
    fillDescription('This is a long enough description for the test.')
    fireEvent.click(screen.getByTestId('turnstile'))
    submitForm()

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Couldn't send. Please try again.")
    })
    // After error, captcha is reset — clicking submit again should hit captcha error
    vi.clearAllMocks()
    submitForm()
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Please complete the verification.')
    })
  })

  it('disables submit button and shows "Sending…" text while submitting', async () => {
    let resolveIssue!: (v: { number: number; url: string }) => void
    const pendingPromise = new Promise<{ number: number; url: string }>((res) => {
      resolveIssue = res
    })
    createIssue.mockReturnValueOnce(pendingPromise)

    renderDialog()
    openDialog()

    fillTitle('Valid title')
    fillDescription('This is a long enough description for the test.')
    fireEvent.click(screen.getByTestId('turnstile'))
    submitForm()

    // While the promise is pending the button should be disabled with "Sending…"
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /sending/i })
      expect(btn).toBeTruthy()
      expect((btn as HTMLButtonElement).disabled).toBe(true)
    })

    // Resolve so we don't leak open handles
    await act(async () => {
      resolveIssue({ number: 1, url: 'u' })
    })
  })

  it('type select: changes from default "feature" to "bug" and "other"', async () => {
    renderDialog()
    openDialog()

    const select = screen.getByDisplayValue('Feature request') as HTMLSelectElement
    expect(select.value).toBe('feature')

    fireEvent.change(select, { target: { value: 'bug' } })
    expect((screen.getByDisplayValue('Bug report') as HTMLSelectElement).value).toBe('bug')

    fireEvent.change(select, { target: { value: 'other' } })
    expect((screen.getByDisplayValue('Other') as HTMLSelectElement).value).toBe('other')
  })

  it('cancel button closes the dialog', async () => {
    renderDialog()
    openDialog()
    expect(screen.getByText('Send feedback')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => {
      expect(screen.queryByText('Send feedback')).toBeNull()
    })
  })

  it('Turnstile onExpire resets captcha token: re-verify after expire still allows submit', async () => {
    createIssue.mockResolvedValueOnce({ number: 10, url: 'u' })

    renderDialog()
    openDialog()

    fillTitle('Valid title')
    fillDescription('This is a long enough description for the test.')

    // Verify -> expire -> re-verify -> submit
    fireEvent.click(screen.getByTestId('turnstile'))       // onSuccess: token = 'mock-token'
    fireEvent.click(screen.getByTestId('turnstile-expire')) // onExpire: token = null
    fireEvent.click(screen.getByTestId('turnstile'))       // onSuccess again: token = 'mock-token'
    submitForm()

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Thanks! Issue #10 created.')
    })
  })

  it('Turnstile onError resets captcha token: re-verify after error still allows submit', async () => {
    createIssue.mockResolvedValueOnce({ number: 11, url: 'u' })

    renderDialog()
    openDialog()

    fillTitle('Valid title')
    fillDescription('This is a long enough description for the test.')

    // Verify -> error -> re-verify -> submit
    fireEvent.click(screen.getByTestId('turnstile'))      // onSuccess: token = 'mock-token'
    fireEvent.click(screen.getByTestId('turnstile-error')) // onError: token = null
    fireEvent.click(screen.getByTestId('turnstile'))      // onSuccess again: token = 'mock-token'
    submitForm()

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Thanks! Issue #11 created.')
    })
  })

  it('honeypot field onChange updates company state', async () => {
    renderDialog()
    openDialog()

    // The honeypot input is hidden (aria-hidden, sr-only), but it exists in the DOM
    const honeypot = document.querySelector('input[name="company"]') as HTMLInputElement
    expect(honeypot).toBeTruthy()
    fireEvent.change(honeypot, { target: { value: 'bot-company' } })
    expect(honeypot.value).toBe('bot-company')
  })

  it('createIssue receives the correct payload including captcha token', async () => {
    createIssue.mockResolvedValueOnce({ number: 7, url: 'u' })

    renderDialog()
    openDialog()

    const select = screen.getByDisplayValue('Feature request') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'bug' } })

    fillTitle('  A real title  ')
    fillDescription('Sufficient description text here.')
    fireEvent.change(screen.getByPlaceholderText('Email or GitHub handle'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByTestId('turnstile'))
    submitForm()

    await waitFor(() => {
      expect(createIssue).toHaveBeenCalledTimes(1)
    })
    expect(createIssue).toHaveBeenCalledWith({
      data: {
        type: 'bug',
        title: 'A real title',
        description: 'Sufficient description text here.',
        contact: 'user@example.com',
        company: '',
        turnstileToken: 'mock-token',
      },
    })
  })
})
