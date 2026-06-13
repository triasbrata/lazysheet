// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import {
  THEMES,
  TARGET_THEME,
  DEFAULT_THEMES,
  PALETTE_THEMES,
  COLS,
  GRID,
  FILE_NAME,
  TOAST_TEXT,
  SELECTION,
  computeInitialScale,
  stepFromProgress,
  deriveSceneState,
  themeVars,
  CURSOR_POS,
} from './mock-data'

describe('THEMES', () => {
  it('light and palenight exist', () => {
    expect(THEMES.light).toBeDefined()
    expect(THEMES.palenight).toBeDefined()
  })

  it('palenight.accent is correct oklch value', () => {
    expect(THEMES.palenight.accent).toBe('oklch(0.576 0.194 321.6)')
  })

  const FIELDS = ['id', 'name', 'bg', 'fg', 'surface', 'popover', 'mutedFg', 'border', 'accent', 'accentFg', 'hover'] as const

  it('light has all 11 string fields', () => {
    FIELDS.forEach((f) => expect(typeof THEMES.light[f]).toBe('string'))
  })

  it('palenight has all 11 string fields', () => {
    FIELDS.forEach((f) => expect(typeof THEMES.palenight[f]).toBe('string'))
  })
})

describe('DEFAULT_THEMES', () => {
  it('names are Light, Dark, System', () => {
    expect(DEFAULT_THEMES.map((t) => t.name)).toEqual(['Light', 'Dark', 'System'])
  })

  it('System swatch is empty string', () => {
    const system = DEFAULT_THEMES.find((t) => t.id === 'system')
    expect(system?.swatch).toBe('')
  })
})

describe('PALETTE_THEMES', () => {
  it('has length 6', () => {
    expect(PALETTE_THEMES.length).toBe(6)
  })

  it('first id is palenight', () => {
    expect(PALETTE_THEMES[0].id).toBe('palenight')
  })

  it("includes Synthwave '84", () => {
    expect(PALETTE_THEMES.some((t) => t.name === "Synthwave '84")).toBe(true)
  })
})

describe('TARGET_THEME', () => {
  it('is palenight', () => {
    expect(TARGET_THEME).toBe('palenight')
  })
})

describe('constants', () => {
  it('TOAST_TEXT exact', () => {
    expect(TOAST_TEXT).toBe('Theme applied — Palenight')
  })

  it('FILE_NAME exact', () => {
    expect(FILE_NAME).toBe('Untitled spreadsheet (7).xlsx')
  })

  it('COLS is A B C', () => {
    expect([...COLS]).toEqual(['A', 'B', 'C'])
  })

  it('GRID is 10 18 28', () => {
    expect([...GRID]).toEqual([10, 18, 28])
  })

  it('SELECTION width === 368', () => {
    expect(SELECTION.width).toBe(368)
  })
})

describe('computeInitialScale', () => {
  it('1280 → 1 (clamped to lower bound)', () => {
    expect(computeInitialScale(1280)).toBe(1)
  })

  it('1920 → approximately 1.3963636', () => {
    expect(computeInitialScale(1920)).toBeCloseTo(1.3963636, 5)
  })

  it('3000 → 1.5 (clamped to upper bound)', () => {
    expect(computeInitialScale(3000)).toBe(1.5)
  })

  it('800 → 1 (clamped to lower bound)', () => {
    expect(computeInitialScale(800)).toBe(1)
  })
})

describe('stepFromProgress', () => {
  it('p=0 → 0', () => expect(stepFromProgress(0)).toBe(0))
  it('p=0.1 → 0', () => expect(stepFromProgress(0.1)).toBe(0))
  it('p=0.15 → 1', () => expect(stepFromProgress(0.15)).toBe(1))
  it('p=0.3 → 2', () => expect(stepFromProgress(0.3)).toBe(2))
  it('p=0.5 → 3', () => expect(stepFromProgress(0.5)).toBe(3))
  it('p=0.65 → 4', () => expect(stepFromProgress(0.65)).toBe(4))
  it('p=0.8 → 5', () => expect(stepFromProgress(0.8)).toBe(5))
  it('p=0.9 → 6', () => expect(stepFromProgress(0.9)).toBe(6))
  it('p=1 → 6', () => expect(stepFromProgress(1)).toBe(6))
})

describe('deriveSceneState', () => {
  it('step 0 — idle, light theme, settings closed', () => {
    expect(deriveSceneState(0)).toEqual({
      settingsOpen: false,
      themeMenuOpen: false,
      highlightId: null,
      appliedThemeId: 'light',
      toastVisible: false,
      cursor: CURSOR_POS[0],
    })
  })

  it('step 1 — cursor at gear, settings still closed', () => {
    expect(deriveSceneState(1)).toEqual({
      settingsOpen: false,
      themeMenuOpen: false,
      highlightId: null,
      appliedThemeId: 'light',
      toastVisible: false,
      cursor: CURSOR_POS[1],
    })
  })

  it('step 2 — settings open, menu closed, nothing highlighted', () => {
    expect(deriveSceneState(2)).toEqual({
      settingsOpen: true,
      themeMenuOpen: false,
      highlightId: null,
      appliedThemeId: 'light',
      toastVisible: false,
      cursor: CURSOR_POS[2],
    })
  })

  it('step 3 — theme menu open, palenight highlighted, not yet applied', () => {
    expect(deriveSceneState(3)).toEqual({
      settingsOpen: true,
      themeMenuOpen: true,
      highlightId: TARGET_THEME,
      appliedThemeId: 'light',
      toastVisible: false,
      cursor: CURSOR_POS[3],
    })
  })

  it('step 4 — palenight applied while settings+menu open', () => {
    expect(deriveSceneState(4)).toEqual({
      settingsOpen: true,
      themeMenuOpen: true,
      highlightId: TARGET_THEME,
      appliedThemeId: 'palenight',
      toastVisible: false,
      cursor: CURSOR_POS[4],
    })
  })

  it('step 5 — settings closed, palenight applied, toast shown', () => {
    expect(deriveSceneState(5)).toEqual({
      settingsOpen: false,
      themeMenuOpen: false,
      highlightId: null,
      appliedThemeId: 'palenight',
      toastVisible: true,
      cursor: CURSOR_POS[5],
    })
  })

  it('step 6 — holds palenight + toast', () => {
    expect(deriveSceneState(6)).toEqual({
      settingsOpen: false,
      themeMenuOpen: false,
      highlightId: null,
      appliedThemeId: 'palenight',
      toastVisible: true,
      cursor: CURSOR_POS[6],
    })
  })

  it('step 99 — cursor falls back to CURSOR_POS[0], toast true, settingsOpen false, appliedThemeId palenight', () => {
    const state = deriveSceneState(99)
    expect(state.cursor).toEqual(CURSOR_POS[0])
    expect(state.toastVisible).toBe(true)
    expect(state.settingsOpen).toBe(false)
    expect(state.appliedThemeId).toBe('palenight')
  })
})

describe('themeVars', () => {
  it('returns object with all CSS var keys', () => {
    const vars = themeVars(THEMES.palenight)
    expect(vars).toHaveProperty('--m-bg')
    expect(vars).toHaveProperty('--m-fg')
    expect(vars).toHaveProperty('--m-surface')
    expect(vars).toHaveProperty('--m-popover')
    expect(vars).toHaveProperty('--m-muted-fg')
    expect(vars).toHaveProperty('--m-border')
    expect(vars).toHaveProperty('--m-accent')
    expect(vars).toHaveProperty('--m-accent-fg')
    expect(vars).toHaveProperty('--m-hover')
  })

  it('--m-accent matches palenight accent', () => {
    const vars = themeVars(THEMES.palenight)
    expect((vars as Record<string, string>)['--m-accent']).toBe(THEMES.palenight.accent)
  })
})
