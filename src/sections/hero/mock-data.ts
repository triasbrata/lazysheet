export const COLS = ['A', 'B', 'C'] as const
export const GRID = [10, 18, 28] as const // A1, B1, C1
export const QUERY_ITEMS = ['INSERT', 'UPDATE', 'UPSERT'] as const
export const MARKDOWN_ITEMS = ['Inline', 'Title', 'Table'] as const
export const COPY_ROOT_ITEMS = ['CSV', 'TSV', 'ASCII Table', 'Plain text'] as const
export const TOAST_TEXT = 'Copied 1 row as INSERT into table Sheet1 (sqlite)'
export const FILE_NAME = 'Untitled spreadsheet (7).xlsx'

export function computeInitialScale(innerWidth: number): number {
  return Math.min(1.5, Math.max(1, (innerWidth * 0.8) / 1100))
}

// scroll choreography
export type CursorPos = { x: number; y: number; clicking?: boolean }
export type SceneState = {
  selected: boolean
  menuOpen: boolean
  submenuOpen: boolean
  highlightQuery: boolean
  highlightInsert: boolean
  toastVisible: boolean
  cursor: CursorPos
}

// 7 steps (0..6). thresholds: progress >= t[i] advances step.
export function stepFromProgress(p: number): number {
  const t = [0.15, 0.3, 0.45, 0.6, 0.72, 0.88]
  let step = 0
  for (let i = 0; i < t.length; i++) {
    if (p >= t[i]) step = i + 1
  }
  return step
}

// cursor position per step, percentages within the app card
export const CURSOR_POS: Record<number, CursorPos> = {
  0: { x: 50, y: 60 },
  1: { x: 22, y: 22 }, // over row 1 selecting
  2: { x: 34, y: 30, clicking: true }, // right-click anchor
  3: { x: 40, y: 40 }, // over "Copy as Query"
  4: { x: 56, y: 46, clicking: true }, // over "INSERT" in submenu
  5: { x: 70, y: 70 },
  6: { x: 70, y: 70 },
}

export function deriveSceneState(step: number): SceneState {
  return {
    selected: step >= 1,
    menuOpen: step >= 2 && step <= 4,
    submenuOpen: step === 3 || step === 4,
    highlightQuery: step === 3 || step === 4,
    highlightInsert: step === 4,
    toastVisible: step >= 5,
    cursor: CURSOR_POS[step] ?? CURSOR_POS[0],
  }
}
