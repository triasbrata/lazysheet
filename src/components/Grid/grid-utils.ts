import type { MergeRange, SheetModel } from "@/lib/types";

export interface MergeSpan {
  rowSpan: number;
  colSpan: number;
}

export interface MergeInfo {
  // Map from "r:c" anchor → { rowSpan, colSpan }
  anchors: Map<string, MergeSpan>;
  // Map "r:c" of an absorbed cell → its anchor key "r1:c1"
  absorbed: Map<string, string>;
}

export function buildMergeInfo(merges: MergeRange[]): MergeInfo {
  const anchors = new Map<string, MergeSpan>();
  const absorbed = new Map<string, string>();
  for (const m of merges) {
    const r1 = Math.min(m.r1, m.r2);
    const r2 = Math.max(m.r1, m.r2);
    const c1 = Math.min(m.c1, m.c2);
    const c2 = Math.max(m.c1, m.c2);
    const rowSpan = r2 - r1 + 1;
    const colSpan = c2 - c1 + 1;
    if (rowSpan === 1 && colSpan === 1) continue;
    const anchorKey = `${r1}:${c1}`;
    anchors.set(anchorKey, { rowSpan, colSpan });
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (r === r1 && c === c1) continue;
        absorbed.set(`${r}:${c}`, anchorKey);
      }
    }
  }
  return { anchors, absorbed };
}

export function isHorizontalOnlyMerge(span: MergeSpan): boolean {
  return span.rowSpan === 1 && span.colSpan > 1;
}

// Defaults match Excel's implicit defaults (Calibri 11pt @ 96 DPI):
// col 8.43 chars → 59 px, row 15 pt → 20 px. Used when backend emits no dims
// (xls/xlsb/ods, or a column/row index beyond the dim array).
export const DEFAULT_ROW_HEIGHT = 20;
export const DEFAULT_COL_WIDTH = 59;
export const ROW_NUM_COL_WIDTH = 44;
// Floor for non-zero values: keeps tiny rows/cols readable.
// 0 is a sentinel meaning "hidden" — pass through unchanged.
const MIN_VISIBLE_PX = 8;

export function colWidth(sheet: SheetModel, colIdx: number): number {
  const w = sheet.col_widths[colIdx];
  if (w === undefined) return DEFAULT_COL_WIDTH;
  if (w === 0) return 0;
  return Math.max(w, MIN_VISIBLE_PX);
}

export function rowHeight(sheet: SheetModel, rowIdx: number): number {
  const h = sheet.row_heights[rowIdx];
  if (h === undefined) return DEFAULT_ROW_HEIGHT;
  if (h === 0) return 0;
  return Math.max(h, MIN_VISIBLE_PX);
}

// Bounds for interactive resize drags. Floor higher than MIN_VISIBLE_PX so
// the column letter / row number remain legible after a manual resize.
export const MIN_RESIZE_PX = 16;
export const MAX_RESIZE_PX = 2000;

// Autofit perf cap — measuring every row in a 50k-sheet column would freeze the
// UI. Above this threshold we sample evenly across the range.
export const MAX_AUTOFIT_SAMPLE = 1000;

export function clampResize(px: number): number {
  if (px < MIN_RESIZE_PX) return MIN_RESIZE_PX;
  if (px > MAX_RESIZE_PX) return MAX_RESIZE_PX;
  return px;
}

export function effectiveColWidth(
  sheet: SheetModel,
  colIdx: number,
  overrides?: Record<number, number>,
): number {
  const o = overrides?.[colIdx];
  if (o !== undefined) return Math.max(MIN_VISIBLE_PX, o);
  return colWidth(sheet, colIdx);
}

export function effectiveRowHeight(
  sheet: SheetModel,
  rowIdx: number,
  overrides?: Record<number, number>,
): number {
  const o = overrides?.[rowIdx];
  if (o !== undefined) return Math.max(MIN_VISIBLE_PX, o);
  return rowHeight(sheet, rowIdx);
}

// Structural signature used to detect when persisted dimension overrides
// have become stale (file edited externally — columns/rows added/removed,
// or sheet renamed). Excludes cell content (changes too easily) and merges
// (orthogonal to dimensions).
export function sheetFingerprint(sheet: SheetModel): string {
  return `${sheet.name}:${sheet.max_col}:${sheet.rows.length}`;
}

export function columnLetter(idx: number): string {
  // 0-based → A, B, ..., Z, AA, AB, ...
  let n = idx + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Resolves a clicked (row, col) to the merge anchor coords if absorbed.
// Returns input unchanged when the cell is not part of any merge.
export function resolveActiveCoords(
  merges: MergeInfo,
  row: number,
  col: number,
): { row: number; col: number } {
  const key = `${row + 1}:${col + 1}`;
  const absorbedAnchor = merges.absorbed.get(key);
  if (absorbedAnchor) {
    const [r1Str, c1Str] = absorbedAnchor.split(":");
    return { row: parseInt(r1Str, 10) - 1, col: parseInt(c1Str, 10) - 1 };
  }
  return { row, col };
}

export function mergeSpanAt(
  merges: MergeInfo,
  row: number,
  col: number,
): { rowSpan: number; colSpan: number } {
  const anchor = merges.anchors.get(`${row + 1}:${col + 1}`);
  return anchor ?? { rowSpan: 1, colSpan: 1 };
}

// Returns nearest visible col in direction `dir` (1 = right, -1 = left).
// Skips hidden cols (width 0). Returns startCol if already at boundary.
export function nextVisibleCol(
  sheet: SheetModel,
  startCol: number,
  dir: 1 | -1,
  maxCol: number,
): number {
  let c = startCol + dir;
  while (c >= 0 && c < maxCol) {
    if (colWidth(sheet, c) > 0) return c;
    c += dir;
  }
  return startCol;
}

export function nextVisibleRow(
  sheet: SheetModel,
  startRow: number,
  dir: 1 | -1,
  maxRow: number,
): number {
  let r = startRow + dir;
  while (r >= 0 && r < maxRow) {
    if (rowHeight(sheet, r) > 0) return r;
    r += dir;
  }
  return startRow;
}

export function firstVisibleCol(sheet: SheetModel, maxCol: number): number {
  for (let c = 0; c < maxCol; c++) if (colWidth(sheet, c) > 0) return c;
  return 0;
}

export function lastVisibleCol(sheet: SheetModel, maxCol: number): number {
  for (let c = maxCol - 1; c >= 0; c--) if (colWidth(sheet, c) > 0) return c;
  return maxCol - 1;
}

export function firstVisibleRow(sheet: SheetModel, maxRow: number): number {
  for (let r = 0; r < maxRow; r++) if (rowHeight(sheet, r) > 0) return r;
  return 0;
}

export function lastVisibleRow(sheet: SheetModel, maxRow: number): number {
  for (let r = maxRow - 1; r >= 0; r--) if (rowHeight(sheet, r) > 0) return r;
  return maxRow - 1;
}

export interface Selection {
  // Where selection started — Excel "active cell" stays here through extension.
  anchor: { row: number; col: number };
  // Where selection ends — moved by drag, shift-click, shift-arrow.
  focus: { row: number; col: number };
  // Semantic intent: header-click for rows/cols, corner-click for all.
  mode: "cell" | "row" | "col" | "all";
  // Scroll behavior when applied — same semantics as old GridTarget.scroll.
  scroll?: "center" | "ifNeeded" | "none";
  // Re-trigger marker (so callers can re-issue an identical selection to retrigger scroll).
  nonce: number;
}

export interface Bounds {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export function selectionBounds(
  s: Selection,
  totalRows: number,
  totalCols: number,
): Bounds {
  if (s.mode === "all") {
    return { r1: 0, c1: 0, r2: totalRows - 1, c2: totalCols - 1 };
  }
  if (s.mode === "row") {
    const r1 = Math.min(s.anchor.row, s.focus.row);
    const r2 = Math.max(s.anchor.row, s.focus.row);
    return { r1, c1: 0, r2, c2: totalCols - 1 };
  }
  if (s.mode === "col") {
    const c1 = Math.min(s.anchor.col, s.focus.col);
    const c2 = Math.max(s.anchor.col, s.focus.col);
    return { r1: 0, c1, r2: totalRows - 1, c2 };
  }
  return {
    r1: Math.min(s.anchor.row, s.focus.row),
    c1: Math.min(s.anchor.col, s.focus.col),
    r2: Math.max(s.anchor.row, s.focus.row),
    c2: Math.max(s.anchor.col, s.focus.col),
  };
}

// Expand bounds so any merged region that intersects becomes fully contained.
// Iterates to fixed point — chains of touching merges may extend further on
// each pass. Anchors are keyed 1-indexed per buildMergeInfo convention.
export function expandBoundsForMerges(base: Bounds, merges: MergeInfo): Bounds {
  let { r1, c1, r2, c2 } = base;
  let changed = true;
  while (changed) {
    changed = false;
    for (const [key, span] of merges.anchors) {
      const [arStr, acStr] = key.split(":");
      const ar = parseInt(arStr, 10) - 1;
      const ac = parseInt(acStr, 10) - 1;
      const mr2 = ar + span.rowSpan - 1;
      const mc2 = ac + span.colSpan - 1;
      if (ar <= r2 && mr2 >= r1 && ac <= c2 && mc2 >= c1) {
        if (ar < r1) {
          r1 = ar;
          changed = true;
        }
        if (ac < c1) {
          c1 = ac;
          changed = true;
        }
        if (mr2 > r2) {
          r2 = mr2;
          changed = true;
        }
        if (mc2 > c2) {
          c2 = mc2;
          changed = true;
        }
      }
    }
  }
  return { r1, c1, r2, c2 };
}

export function boundsInclude(b: Bounds, row: number, col: number): boolean {
  return row >= b.r1 && row <= b.r2 && col >= b.c1 && col <= b.c2;
}

export function formatSelectionRef(s: Selection, bounds: Bounds): string {
  if (s.mode === "row") {
    return bounds.r1 === bounds.r2
      ? `${bounds.r1 + 1}:${bounds.r1 + 1}`
      : `${bounds.r1 + 1}:${bounds.r2 + 1}`;
  }
  if (s.mode === "col") {
    return bounds.c1 === bounds.c2
      ? `${columnLetter(bounds.c1)}:${columnLetter(bounds.c1)}`
      : `${columnLetter(bounds.c1)}:${columnLetter(bounds.c2)}`;
  }
  if (bounds.r1 === bounds.r2 && bounds.c1 === bounds.c2) {
    return `${columnLetter(bounds.c1)}${bounds.r1 + 1}`;
  }
  return `${columnLetter(bounds.c1)}${bounds.r1 + 1}:${columnLetter(bounds.c2)}${bounds.r2 + 1}`;
}

// Returns up to `cap` row indices spanning [0, total). Always includes 0 and
// total-1 (when total >= 2). When total <= cap, returns every index.
export function sampleRowIndices(total: number, cap: number = MAX_AUTOFIT_SAMPLE): number[] {
  if (total <= 0) return [];
  if (total <= cap) {
    const out = new Array<number>(total);
    for (let i = 0; i < total; i++) out[i] = i;
    return out;
  }
  const out: number[] = [];
  const step = (total - 1) / (cap - 1);
  for (let i = 0; i < cap; i++) {
    const idx = Math.round(i * step);
    if (out.length === 0 || out[out.length - 1] !== idx) out.push(idx);
  }
  return out;
}

// Derive a normalized [lo, hi] column range from a Selection when its mode
// covers full columns ("col" or "all"). Returns null otherwise.
export function selectionColRange(s: Selection | null, totalCols: number): [number, number] | null {
  if (!s) return null;
  if (s.mode === "col") {
    const c1 = Math.min(s.anchor.col, s.focus.col);
    const c2 = Math.max(s.anchor.col, s.focus.col);
    return [c1, c2];
  }
  if (s.mode === "all") return [0, totalCols - 1];
  return null;
}

// Derive a normalized [lo, hi] row range from a Selection when its mode
// covers full rows ("row" or "all"). Returns null otherwise.
export function selectionRowRange(s: Selection | null, totalRows: number): [number, number] | null {
  if (!s) return null;
  if (s.mode === "row") {
    const r1 = Math.min(s.anchor.row, s.focus.row);
    const r2 = Math.max(s.anchor.row, s.focus.row);
    return [r1, r2];
  }
  if (s.mode === "all") return [0, totalRows - 1];
  return null;
}

/** Row indices whose override value changed (added, changed, or removed) between two override maps. */
export function changedRowIndices(
  prev: Record<number, number> | undefined,
  cur: Record<number, number> | undefined,
): number[] {
  const p = prev ?? {};
  const c = cur ?? {};
  const keys = new Set<number>();
  for (const k of Object.keys(p)) keys.add(Number(k));
  for (const k of Object.keys(c)) keys.add(Number(k));
  const out: number[] = [];
  for (const k of keys) if (p[k] !== c[k]) out.push(k);
  return out;
}

// True when the in-flow header row has scrolled strictly above the ruler
// bottom, so the duplicate sticky band should replace it. Strict `>` (not `>=`)
// so a header at the very top (start=0) — or any header flush under the ruler —
// keeps the in-flow row + funnel overlay instead of double-rendering the band.
export function headerBandStuck(scrollTop: number, start: number): boolean {
  return scrollTop > start;
}

export function parseA1(ref: string): { row: number; col: number } | null {
  const m = ref.trim().match(/^([A-Za-z]+)(\d+)$/);
  if (!m) return null;
  const letters = m[1].toUpperCase();
  const rowNum = parseInt(m[2], 10);
  if (!rowNum || rowNum < 1) return null;
  let col = 0;
  for (const ch of letters) {
    col = col * 26 + (ch.charCodeAt(0) - 64);
  }
  return { row: rowNum - 1, col: col - 1 };
}
