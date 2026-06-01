// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { CopyCommand } from '#/features/faq/copy-command'

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
    render(<CopyCommand command={CMD} />)
    expect(screen.getByText(CMD)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy command' })).toBeTruthy()
  })

  it('copies the command to the clipboard on click', async () => {
    render(<CopyCommand command={CMD} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy command' }))

    expect(writeText).toHaveBeenCalledWith(CMD)
    // button flips to its "Copied" confirmation state
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy()
    expect(screen.getByText('Copied')).toBeTruthy()
  })
})
