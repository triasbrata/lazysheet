// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, screen, fireEvent } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mutable refs used inside vi.hoisted so the mock factory can close over them
// ---------------------------------------------------------------------------
const { navSpy } = vi.hoisted(() => {
  const navSpy = vi.fn()
  return { navSpy }
})

// ---------------------------------------------------------------------------
// Mock @tanstack/react-router — must appear above module-under-test imports
// ---------------------------------------------------------------------------
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navSpy,
    useParams: () => ({}),
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
      data-testid="version-select"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({
    'aria-label': ariaLabel,
  }: {
    children?: React.ReactNode
    'aria-label'?: string
  }) => <span data-testid="version-trigger" aria-label={ariaLabel} />,
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
import type { ReleaseData } from '#/lib/releases'
import { renderWithI18n } from '#/test/i18n'
import { VersionSelector } from './version-selector'

afterEach(cleanup)
afterEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function makeRelease(tag: string): ReleaseData {
  return {
    tag,
    name: tag,
    htmlUrl: `https://github.com/triasbrata/lazysheet/releases/tag/${tag}`,
    publishedAt: '2024-01-01T00:00:00Z',
    assets: [],
  }
}

const rel050 = makeRelease('v0.5.0')
const rel040 = makeRelease('v0.4.0')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('VersionSelector — renders trigger with aria-label and selected value', () => {
  it('shows the trigger with aria-label "Select version" and correct selected value', () => {
    renderWithI18n(<VersionSelector releases={[rel050, rel040]} selectedTag="v0.5.0" />)

    const trigger = screen.getByTestId('version-trigger')
    expect(trigger.getAttribute('aria-label')).toBe('Select version')

    const select = screen.getByTestId('version-select') as HTMLSelectElement
    expect(select.value).toBe('v0.5.0')
  })
})

describe('VersionSelector — options list with "(latest)" suffix', () => {
  it('renders all release tags as options', () => {
    renderWithI18n(<VersionSelector releases={[rel050, rel040]} selectedTag="v0.5.0" />)

    const select = screen.getByTestId('version-select') as HTMLSelectElement
    const optionValues = Array.from(select.options).map((o) => o.value)
    expect(optionValues).toContain('v0.5.0')
    expect(optionValues).toContain('v0.4.0')
  })

  it('appends "(latest)" suffix to the first (latest) release', () => {
    renderWithI18n(<VersionSelector releases={[rel050, rel040]} selectedTag="v0.5.0" />)

    const select = screen.getByTestId('version-select') as HTMLSelectElement
    const firstOption = select.options[0]
    expect(firstOption?.text).toContain('v0.5.0')
    expect(firstOption?.text).toContain('(latest)')
  })

  it('does NOT append "(latest)" suffix to subsequent releases', () => {
    renderWithI18n(<VersionSelector releases={[rel050, rel040]} selectedTag="v0.5.0" />)

    const select = screen.getByTestId('version-select') as HTMLSelectElement
    const secondOption = select.options[1]
    expect(secondOption?.text).toContain('v0.4.0')
    expect(secondOption?.text).not.toContain('(latest)')
  })
})

describe('VersionSelector — onValueChange wires navigate', () => {
  it('calls navigate with search containing the selected tag', () => {
    renderWithI18n(<VersionSelector releases={[rel050, rel040]} selectedTag="v0.5.0" />)

    const select = screen.getByTestId('version-select')
    fireEvent.change(select, { target: { value: 'v0.4.0' } })

    expect(navSpy).toHaveBeenCalledTimes(1)
    // navigate is called with { to: '.', search: <fn> }
    const callArg = navSpy.mock.calls[0]?.[0] as { to: string; search: (prev: Record<string, unknown>) => Record<string, unknown> }
    expect(callArg.to).toBe('.')
    // Exercise the search updater function
    const updatedSearch = callArg.search({ existing: 'value' })
    expect(updatedSearch).toEqual({ existing: 'value', v: 'v0.4.0' })
  })
})

describe('VersionSelector — renders null when releases.length <= 1', () => {
  it('renders nothing when releases array is empty', () => {
    const { container } = renderWithI18n(<VersionSelector releases={[]} selectedTag="v0.5.0" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when there is only one release', () => {
    const { container } = renderWithI18n(<VersionSelector releases={[rel050]} selectedTag="v0.5.0" />)
    expect(container.firstChild).toBeNull()
  })
})
