// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { renderWithI18n } from '#/test/i18n'
import { useBentoTiles } from './features'
import React from 'react'

afterEach(cleanup)

function TileHarness({ activeTag }: { activeTag: string }) {
  const tiles = useBentoTiles(activeTag)
  return (
    <div data-testid="count" data-count={tiles.length}>
      {tiles.map((t) => (
        <span key={t.id} data-testid={`tile-${t.id}`}>
          {t.title}
        </span>
      ))}
    </div>
  )
}

describe('useBentoTiles', () => {
  it('returns 11 tiles', () => {
    renderWithI18n(<TileHarness activeTag="v0.4.0" />)
    const el = screen.getByTestId('count')
    expect(Number(el.getAttribute('data-count'))).toBe(11)
  })

  it('v0.4.0 does NOT have tile-resize (resize is a v0.5.0 feature)', () => {
    renderWithI18n(<TileHarness activeTag="v0.4.0" />)
    expect(screen.queryByTestId('tile-resize')).toBeNull()
  })

  it('has a tile with id group-by', () => {
    renderWithI18n(<TileHarness activeTag="v0.4.0" />)
    expect(screen.getByTestId('tile-group-by')).toBeTruthy()
  })

  it('has a tile with id formats', () => {
    renderWithI18n(<TileHarness activeTag="v0.4.0" />)
    expect(screen.getByTestId('tile-formats')).toBeTruthy()
  })

  it('group-by tile render() returns JSX with check bullets', () => {
    let tiles: ReturnType<typeof useBentoTiles> = []

    function Capture() {
      tiles = useBentoTiles('v0.4.0')
      return null
    }
    renderWithI18n(<Capture />)

    const groupBy = tiles.find((t) => t.id === 'group-by')
    expect(groupBy).toBeDefined()
    expect(typeof groupBy!.render).toBe('function')

    const { container } = renderWithI18n(<>{groupBy!.render!()}</>)
    // Should render a <ul> with list items
    expect(container.querySelector('ul')).toBeTruthy()
    const items = container.querySelectorAll('li')
    expect(items.length).toBeGreaterThanOrEqual(2)
  })

  it('formats tile render() returns JSX with file extension spans', () => {
    let tiles: ReturnType<typeof useBentoTiles> = []

    function Capture() {
      tiles = useBentoTiles('v0.4.0')
      return null
    }
    renderWithI18n(<Capture />)

    const formats = tiles.find((t) => t.id === 'formats')
    expect(formats).toBeDefined()
    expect(typeof formats!.render).toBe('function')

    const { container } = renderWithI18n(<>{formats!.render!()}</>)
    // Should render spans for each file extension
    const spans = container.querySelectorAll('span')
    expect(spans.length).toBeGreaterThanOrEqual(5) // .xlsx, .xlsm, .xls, .csv, .tsv
    const text = container.textContent ?? ''
    expect(text).toContain('.xlsx')
    expect(text).toContain('.csv')
  })

  it('each tile has required id, span, title fields', () => {
    let tiles: ReturnType<typeof useBentoTiles> = []

    function Capture() {
      tiles = useBentoTiles('v0.4.0')
      return null
    }
    renderWithI18n(<Capture />)

    for (const tile of tiles) {
      expect(typeof tile.id).toBe('string')
      expect(typeof tile.span).toBe('string')
      expect(typeof tile.title).toBe('string')
    }
  })

  it('v0.4.0 tile spans use xl: prefix (not md:) for col/row tokens', () => {
    let tiles: ReturnType<typeof useBentoTiles> = []

    function Capture() {
      tiles = useBentoTiles('v0.4.0')
      return null
    }
    renderWithI18n(<Capture />)

    // At least one tile should have xl:col-start-
    const hasXlColStart = tiles.some((t) => t.span.includes('xl:col-start-'))
    expect(hasXlColStart).toBe(true)
    // No tile should have md:col-start-
    const hasMdColStart = tiles.some((t) => t.span.includes('md:col-start-'))
    expect(hasMdColStart).toBe(false)
  })

  it('v0.5.0 tile spans use xl: prefix (not md:) for col/row tokens', () => {
    let tiles: ReturnType<typeof useBentoTiles> = []

    function Capture() {
      tiles = useBentoTiles('v0.5.0')
      return null
    }
    renderWithI18n(<Capture />)

    const hasXlColStart = tiles.some((t) => t.span.includes('xl:col-start-'))
    expect(hasXlColStart).toBe(true)
    const hasMdColStart = tiles.some((t) => t.span.includes('md:col-start-'))
    expect(hasMdColStart).toBe(false)
  })

  it('returns 12 tiles for a future tag (v9.9.9) — highest defined <= active resolves to v0.5.0', () => {
    let tiles: ReturnType<typeof useBentoTiles> = []

    function Capture() {
      tiles = useBentoTiles('v9.9.9')
      return null
    }
    renderWithI18n(<Capture />)

    expect(tiles.length).toBe(12)
  })

  it('returns 11 tiles for a tag below all defined (v0.0.1) — falls back to min = v0.4.0', () => {
    let tiles: ReturnType<typeof useBentoTiles> = []

    function Capture() {
      tiles = useBentoTiles('v0.0.1')
      return null
    }
    renderWithI18n(<Capture />)

    expect(tiles.length).toBe(11)
  })

  it('returns 12 tiles for v0.5.0', () => {
    renderWithI18n(<TileHarness activeTag="v0.5.0" />)
    const el = screen.getByTestId('count')
    expect(Number(el.getAttribute('data-count'))).toBe(12)
  })

  it('v0.5.0 has tile-zoom', () => {
    renderWithI18n(<TileHarness activeTag="v0.5.0" />)
    expect(screen.getByTestId('tile-zoom')).toBeTruthy()
  })

  it('v0.5.0 has tile-formula', () => {
    renderWithI18n(<TileHarness activeTag="v0.5.0" />)
    expect(screen.getByTestId('tile-formula')).toBeTruthy()
  })

  it('v0.5.0 has tile-copyAsQuery (hero, replaces group-by)', () => {
    renderWithI18n(<TileHarness activeTag="v0.5.0" />)
    expect(screen.getByTestId('tile-copyAsQuery')).toBeTruthy()
  })

  it('v0.5.0 no longer has tile-sqlExport (merged into copyAsQuery)', () => {
    renderWithI18n(<TileHarness activeTag="v0.5.0" />)
    expect(screen.queryByTestId('tile-sqlExport')).toBeNull()
  })

  it('v0.5.0 carries group-by as a normal feature (demoted from hero)', () => {
    renderWithI18n(<TileHarness activeTag="v0.5.0" />)
    expect(screen.getByTestId('tile-group-by')).toBeTruthy()
  })

  it('v0.5.0 carries 4 main v0.4.0 features (group-by, command, filters, copy)', () => {
    renderWithI18n(<TileHarness activeTag="v0.5.0" />)
    expect(screen.getByTestId('tile-group-by')).toBeTruthy()
    expect(screen.getByTestId('tile-command')).toBeTruthy()
    expect(screen.getByTestId('tile-filters')).toBeTruthy()
    expect(screen.getByTestId('tile-copy')).toBeTruthy()
  })

  it('copyAsQuery render() returns INSERT/UPDATE/UPSERT chips', () => {
    let tiles: ReturnType<typeof useBentoTiles> = []

    function Capture() {
      tiles = useBentoTiles('v0.5.0')
      return null
    }
    renderWithI18n(<Capture />)

    const cq = tiles.find((t) => t.id === 'copyAsQuery')
    expect(cq).toBeDefined()
    expect(typeof cq!.render).toBe('function')

    const { container } = renderWithI18n(<>{cq!.render!()}</>)
    const text = container.textContent ?? ''
    expect(text).toContain('INSERT')
    expect(text).toContain('UPDATE')
    expect(text).toContain('UPSERT')
  })

  it('v0.5.0 has tile-autoUpdate', () => {
    renderWithI18n(<TileHarness activeTag="v0.5.0" />)
    expect(screen.getByTestId('tile-autoUpdate')).toBeTruthy()
  })

  it('v0.5.0 has tile-resize (resize introduced in v0.5.0)', () => {
    renderWithI18n(<TileHarness activeTag="v0.5.0" />)
    expect(screen.getByTestId('tile-resize')).toBeTruthy()
  })
})
