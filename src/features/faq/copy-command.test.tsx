// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent } from '@testing-library/react'
import { screen } from '@testing-library/react'

import { CopyCommand } from '#/features/faq/copy-command'
import { renderWithI18n } from '#/test/i18n'

const CMD = 'xattr -dr com.apple.quarantine "/Applications/LazySheet.app"'

let writeText: ReturnType<typeof vi.fn>

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
})

afterEach(cleanup)

describe('CopyCommand — what the user sees', () => {
  it('shows the command and a Copy button', () => {
    renderWithI18n(<CopyCommand command={CMD} />)
    expect(screen.getByText(CMD)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy command' })).toBeTruthy()
  })

  it('copies the command to the clipboard on click', async () => {
    renderWithI18n(<CopyCommand command={CMD} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy command' }))

    expect(writeText).toHaveBeenCalledWith(CMD)
    // button flips to its "Copied" confirmation state
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy()
    expect(screen.getByText('Copied')).toBeTruthy()
  })
})

describe('CopyCommand — branch coverage', () => {
  it('handles clipboard writeText failure gracefully (no crash, no unhandled rejection)', async () => {
    writeText = vi.fn().mockRejectedValueOnce(new Error('clipboard unavailable'))
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    renderWithI18n(<CopyCommand command={CMD} />)
    // Should not throw or produce unhandled rejection
    fireEvent.click(screen.getByRole('button', { name: 'Copy command' }))

    // Let the rejected promise settle — button stays in "Copy" state
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.getByRole('button', { name: 'Copy command' })).toBeTruthy()
  })

  it('double-click clears the previous timer before setting a new one (timer.current branch)', async () => {
    renderWithI18n(<CopyCommand command={CMD} />)

    const btn = screen.getByRole('button', { name: 'Copy command' })
    // First click — promise resolves, sets copied=true and sets timer.current
    fireEvent.click(btn)
    // Wait for the promise to resolve and the state to update (sets timer.current)
    const btn2 = await screen.findByRole('button', { name: 'Copied' })

    // Second click while timer is still active — hits `if (timer.current) clearTimeout(timer.current)` branch
    await act(async () => {
      fireEvent.click(btn2)
    })
    // After second click, copied is re-set to true with a fresh timer — no crash means branch was covered
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy()
  })

  it('unmount before timer fires invokes cleanup clearTimeout (useEffect cleanup branch)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { unmount } = renderWithI18n(<CopyCommand command={CMD} />)

      // Click to trigger clipboard write; resolve the mock promise
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copy command' }))
        // Flush the microtask: the mock clipboard.writeText resolves synchronously in the microtask queue
        await new Promise((resolve) => queueMicrotask(resolve as () => void))
      })

      // Unmount while timer is still pending — triggers useEffect cleanup clearTimeout
      unmount()
      // Advance past the timer to confirm no state-update-after-unmount error
      vi.advanceTimersByTime(2000)
    } finally {
      vi.useRealTimers()
    }
  })

  it('timer fires after 2 seconds and resets copied state (setTimeout callback branch)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      renderWithI18n(<CopyCommand command={CMD} />)

      // Click and wait for copied state to be true
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copy command' }))
        await new Promise((resolve) => queueMicrotask(resolve as () => void))
      })

      // Should be in "Copied" state now
      expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy()

      // Advance the timer by 2000ms — fires the setTimeout callback `() => setCopied(false)`
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      // Button should revert to "Copy command"
      expect(screen.getByRole('button', { name: 'Copy command' })).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})
