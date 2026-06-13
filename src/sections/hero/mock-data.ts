import type { CSSProperties } from 'react'

export type MockTheme = {
  id: string
  name: string
  bg: string
  fg: string
  surface: string
  popover: string
  mutedFg: string
  border: string
  accent: string
  accentFg: string
  hover: string
}

export const THEMES: Record<'light' | 'palenight', MockTheme> = {
  light: {
    id: 'light',
    name: 'Light',
    bg: 'oklch(1 0 0)',
    fg: 'oklch(0.145 0 0)',
    surface: 'oklch(0.97 0 0)',
    popover: 'oklch(1 0 0)',
    mutedFg: 'oklch(0.556 0 0)',
    border: 'oklch(0.922 0 0)',
    accent: 'oklch(0.205 0 0)',
    accentFg: 'oklch(0.985 0 0)',
    hover: 'oklch(0.97 0 0)',
  },
  palenight: {
    id: 'palenight',
    name: 'Palenight',
    bg: 'oklch(0.301 0.031 274.1)',
    fg: 'oklch(0.751 0.048 277.1)',
    surface: 'oklch(0.33 0.042 287.7)',
    popover: 'oklch(0.26 0.027 275.0)',
    mutedFg: 'oklch(0.548 0.061 276.3)',
    border: 'oklch(0.295 0.036 286.3)',
    accent: 'oklch(0.576 0.194 321.6)',
    accentFg: 'oklch(0.985 0 0)',
    hover: 'oklch(0.407 0.046 273.0)',
  },
}

export const TARGET_THEME = 'palenight' as const

export type ThemeSwatch = { id: string; name: string; swatch: string }

export const DEFAULT_THEMES: ThemeSwatch[] = [
  { id: 'light', name: 'Light', swatch: 'oklch(1 0 0)' },
  { id: 'dark', name: 'Dark', swatch: 'oklch(0.205 0 0)' },
  { id: 'system', name: 'System', swatch: '' },
]

export const PALETTE_THEMES: ThemeSwatch[] = [
  { id: 'palenight', name: 'Palenight', swatch: 'oklch(0.301 0.031 274.1)' },
  { id: 'synthwave84', name: "Synthwave '84", swatch: 'oklch(0.27 0.045 300.7)' },
  { id: 'dracula', name: 'Dracula', swatch: 'oklch(0.288 0.022 277.5)' },
  { id: 'oceanic', name: 'Oceanic', swatch: 'oklch(0.309 0.019 229.8)' },
  { id: 'forest', name: 'Forest', swatch: 'oklch(0.243 0.042 194.8)' },
  { id: 'github', name: 'GitHub', swatch: 'oklch(0.979 0.003 264.5)' },
]

export const COLS = ['A', 'B', 'C'] as const
export const GRID = [10, 18, 28] as const
export const FILE_NAME = 'Untitled spreadsheet (7).xlsx'
export const TOAST_TEXT = 'Theme applied — Palenight'
export const SELECTION = { left: 44, top: 26, width: 368, height: 28 }

export function computeInitialScale(innerWidth: number): number {
  return Math.min(1.5, Math.max(1, (innerWidth * 0.8) / 1100))
}

export type CursorPos = { x: number; y: number; clicking?: boolean }

export function stepFromProgress(p: number): number {
  const t = [0.15, 0.3, 0.45, 0.6, 0.72, 0.88]
  let step = 0
  for (let i = 0; i < t.length; i++) {
    if (p >= t[i]) step = i + 1
  }
  return step
}

export const CURSOR_POS: Record<number, CursorPos> = {
  0: { x: 50, y: 55 },
  1: { x: 50, y: 3, clicking: true },
  2: { x: 62, y: 30 },
  3: { x: 62, y: 52 },
  4: { x: 62, y: 52, clicking: true },
  5: { x: 75, y: 72 },
  6: { x: 75, y: 72 },
}

export type SceneState = {
  settingsOpen: boolean
  themeMenuOpen: boolean
  highlightId: string | null
  appliedThemeId: 'light' | 'palenight'
  toastVisible: boolean
  cursor: CursorPos
}

export function deriveSceneState(step: number): SceneState {
  return {
    settingsOpen: step >= 2 && step <= 4,
    themeMenuOpen: step === 3 || step === 4,
    highlightId: step === 3 || step === 4 ? TARGET_THEME : null,
    appliedThemeId: step >= 4 ? TARGET_THEME : 'light',
    toastVisible: step >= 5,
    cursor: CURSOR_POS[step] ?? CURSOR_POS[0],
  }
}

export function themeVars(t: MockTheme): CSSProperties {
  return {
    '--m-bg': t.bg,
    '--m-fg': t.fg,
    '--m-surface': t.surface,
    '--m-popover': t.popover,
    '--m-muted-fg': t.mutedFg,
    '--m-border': t.border,
    '--m-accent': t.accent,
    '--m-accent-fg': t.accentFg,
    '--m-hover': t.hover,
  } as CSSProperties
}
