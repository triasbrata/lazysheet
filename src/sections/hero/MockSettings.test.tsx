// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MockSettings } from './MockSettings'
import { PALETTE_THEMES } from './mock-data'

afterEach(() => cleanup())

describe('MockSettings', () => {
  it('returns null when open=false', () => {
    const { container } = render(
      <MockSettings
        open={false}
        themeMenuOpen={false}
        highlightId={null}
        appliedThemeId="light"
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders key setting rows when open=true', () => {
    render(
      <MockSettings
        open={true}
        themeMenuOpen={false}
        highlightId={null}
        appliedThemeId="light"
      />,
    )
    expect(screen.getByText('Settings')).toBeTruthy()
    expect(screen.getByText('Theme')).toBeTruthy()
    expect(screen.getByText('Language')).toBeTruthy()
    expect(screen.getByText('Ask before closing a sheet')).toBeTruthy()
    expect(screen.getByText('Disable running text')).toBeTruthy()
  })

  it('renders theme group labels and all palette names when themeMenuOpen=true', () => {
    render(
      <MockSettings
        open={true}
        themeMenuOpen={true}
        highlightId={null}
        appliedThemeId="light"
      />,
    )
    expect(screen.getByText('Default')).toBeTruthy()
    expect(screen.getByText('Color Palettes')).toBeTruthy()
    PALETTE_THEMES.forEach((p) => {
      expect(screen.getByText(p.name)).toBeTruthy()
    })
  })

  it('renders a Check icon for the applied theme when themeMenuOpen=true', () => {
    const { container } = render(
      <MockSettings
        open={true}
        themeMenuOpen={true}
        highlightId={null}
        appliedThemeId="palenight"
      />,
    )
    // lucide-react adds a class matching the icon name
    const checkIcon =
      container.querySelector('svg.lucide-check') ??
      container.querySelector('[class*="lucide-check"]') ??
      container.querySelector('svg[data-icon="check"]')
    expect(checkIcon).toBeTruthy()
  })

  it('renders the highlighted row when highlightId is set', () => {
    render(
      <MockSettings
        open={true}
        themeMenuOpen={true}
        highlightId="palenight"
        appliedThemeId="light"
      />,
    )
    expect(screen.getByText('Palenight')).toBeTruthy()
  })
})
