// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MockContextMenu } from './MockContextMenu'

afterEach(() => cleanup())

describe('MockContextMenu', () => {
  it('returns null when open=false', () => {
    const { container } = render(
      <MockContextMenu
        open={false}
        submenuOpen={false}
        highlightQuery={false}
        highlightInsert={false}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders main items when open=true, submenu hidden', () => {
    render(
      <MockContextMenu
        open={true}
        submenuOpen={false}
        highlightQuery={false}
        highlightInsert={false}
      />,
    )
    expect(screen.getByText('Copy as Query')).toBeTruthy()
    expect(screen.getByText('Copy')).toBeTruthy()
    expect(screen.getByText('Summarize range…')).toBeTruthy()
    expect(screen.getByText('Resize')).toBeTruthy()
    expect(screen.queryByText('INSERT')).toBeNull()
  })

  it('renders submenu items and highlights INSERT when submenuOpen=true, highlightInsert=true', () => {
    render(
      <MockContextMenu
        open={true}
        submenuOpen={true}
        highlightQuery={true}
        highlightInsert={true}
      />,
    )
    expect(screen.getByText('INSERT')).toBeTruthy()
    expect(screen.getByText('UPDATE')).toBeTruthy()
    expect(screen.getByText('UPSERT')).toBeTruthy()
    const insertEl = screen.getByText('INSERT')
    expect(insertEl.className).toContain('bg-[#f0f0f0]')
  })
})
