// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { renderWithI18n } from '#/test/i18n'
import { useBentoTiles } from './features'
import React from 'react'

afterEach(cleanup)

function TileHarness() {
  const tiles = useBentoTiles()
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
  it('returns 12 tiles', () => {
    renderWithI18n(<TileHarness />)
    const el = screen.getByTestId('count')
    expect(Number(el.getAttribute('data-count'))).toBe(12)
  })

  it('has a tile with id group-by', () => {
    renderWithI18n(<TileHarness />)
    expect(screen.getByTestId('tile-group-by')).toBeTruthy()
  })

  it('has a tile with id formats', () => {
    renderWithI18n(<TileHarness />)
    expect(screen.getByTestId('tile-formats')).toBeTruthy()
  })

  it('group-by tile render() returns JSX with check bullets', () => {
    let tiles: ReturnType<typeof useBentoTiles> = []

    function Capture() {
      tiles = useBentoTiles()
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
      tiles = useBentoTiles()
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
      tiles = useBentoTiles()
      return null
    }
    renderWithI18n(<Capture />)

    for (const tile of tiles) {
      expect(typeof tile.id).toBe('string')
      expect(typeof tile.span).toBe('string')
      expect(typeof tile.title).toBe('string')
    }
  })
})
