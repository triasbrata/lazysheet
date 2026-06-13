// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import {
  COLS,
  GRID,
  QUERY_ITEMS,
  MARKDOWN_ITEMS,
  COPY_ROOT_ITEMS,
  TOAST_TEXT,
  FILE_NAME,
  computeInitialScale,
  stepFromProgress,
  deriveSceneState,
  CURSOR_POS,
} from './mock-data'

describe('constants', () => {
  it('COLS deep-equals [A, B, C]', () => {
    expect([...COLS]).toEqual(['A', 'B', 'C'])
  })

  it('GRID equals [10, 18, 28]', () => {
    expect([...GRID]).toEqual([10, 18, 28])
  })

  it('QUERY_ITEMS equals [INSERT, UPDATE, UPSERT]', () => {
    expect([...QUERY_ITEMS]).toEqual(['INSERT', 'UPDATE', 'UPSERT'])
  })

  it('MARKDOWN_ITEMS equals [Inline, Title, Table]', () => {
    expect([...MARKDOWN_ITEMS]).toEqual(['Inline', 'Title', 'Table'])
  })

  it('COPY_ROOT_ITEMS equals [CSV, TSV, ASCII Table, Plain text]', () => {
    expect([...COPY_ROOT_ITEMS]).toEqual(['CSV', 'TSV', 'ASCII Table', 'Plain text'])
  })

  it('TOAST_TEXT exact', () => {
    expect(TOAST_TEXT).toBe('Copied 1 row as INSERT into table Sheet1 (sqlite)')
  })

  it('FILE_NAME exact', () => {
    expect(FILE_NAME).toBe('Untitled spreadsheet (7).xlsx')
  })
})

describe('computeInitialScale', () => {
  it('1280 → 1 (raw < 1, clamped to lower bound)', () => {
    expect(computeInitialScale(1280)).toBe(1)
  })

  it('1920 → approximately 1.3963636', () => {
    expect(computeInitialScale(1920)).toBeCloseTo(1.3963636, 5)
  })

  it('3000 → 1.5 (raw > 1.5, clamped to upper bound)', () => {
    expect(computeInitialScale(3000)).toBe(1.5)
  })

  it('800 → 1 (raw < 1, clamped to lower bound)', () => {
    expect(computeInitialScale(800)).toBe(1)
  })
})

describe('stepFromProgress', () => {
  it('p=0 → 0', () => expect(stepFromProgress(0)).toBe(0))
  it('p=0.1 → 0', () => expect(stepFromProgress(0.1)).toBe(0))
  it('p=0.15 → 1', () => expect(stepFromProgress(0.15)).toBe(1))
  it('p=0.2 → 1', () => expect(stepFromProgress(0.2)).toBe(1))
  it('p=0.3 → 2', () => expect(stepFromProgress(0.3)).toBe(2))
  it('p=0.5 → 3', () => expect(stepFromProgress(0.5)).toBe(3))
  it('p=0.65 → 4', () => expect(stepFromProgress(0.65)).toBe(4))
  it('p=0.8 → 5', () => expect(stepFromProgress(0.8)).toBe(5))
  it('p=0.9 → 6', () => expect(stepFromProgress(0.9)).toBe(6))
  it('p=1 → 6', () => expect(stepFromProgress(1)).toBe(6))
})

describe('deriveSceneState', () => {
  it('step 0', () => {
    expect(deriveSceneState(0)).toEqual({
      selected: false,
      menuOpen: false,
      submenuOpen: false,
      highlightQuery: false,
      highlightInsert: false,
      toastVisible: false,
      cursor: CURSOR_POS[0],
    })
  })

  it('step 1', () => {
    expect(deriveSceneState(1)).toEqual({
      selected: true,
      menuOpen: false,
      submenuOpen: false,
      highlightQuery: false,
      highlightInsert: false,
      toastVisible: false,
      cursor: CURSOR_POS[1],
    })
  })

  it('step 2', () => {
    expect(deriveSceneState(2)).toEqual({
      selected: true,
      menuOpen: true,
      submenuOpen: false,
      highlightQuery: false,
      highlightInsert: false,
      toastVisible: false,
      cursor: CURSOR_POS[2],
    })
  })

  it('step 3', () => {
    expect(deriveSceneState(3)).toEqual({
      selected: true,
      menuOpen: true,
      submenuOpen: true,
      highlightQuery: true,
      highlightInsert: false,
      toastVisible: false,
      cursor: CURSOR_POS[3],
    })
  })

  it('step 4', () => {
    expect(deriveSceneState(4)).toEqual({
      selected: true,
      menuOpen: true,
      submenuOpen: true,
      highlightQuery: true,
      highlightInsert: true,
      toastVisible: false,
      cursor: CURSOR_POS[4],
    })
  })

  it('step 5', () => {
    expect(deriveSceneState(5)).toEqual({
      selected: true,
      menuOpen: false,
      submenuOpen: false,
      highlightQuery: false,
      highlightInsert: false,
      toastVisible: true,
      cursor: CURSOR_POS[5],
    })
  })

  it('step 6 — toastVisible true, menuOpen false', () => {
    expect(deriveSceneState(6)).toEqual({
      selected: true,
      menuOpen: false,
      submenuOpen: false,
      highlightQuery: false,
      highlightInsert: false,
      toastVisible: true,
      cursor: CURSOR_POS[6],
    })
  })

  it('step 99 — cursor falls back to CURSOR_POS[0] (?? branch)', () => {
    const state = deriveSceneState(99)
    expect(state.cursor).toEqual(CURSOR_POS[0])
    expect(state.toastVisible).toBe(true)
    expect(state.selected).toBe(true)
    expect(state.menuOpen).toBe(false)
  })
})
