import type { SheetModel, MergeRange } from "@/lib/types";
import { cellText } from "@/lib/types";
import type { MergeInfo } from "@/components/Grid/grid-utils";
import { isHorizontalOnlyMerge } from "@/components/Grid/grid-utils";

// ─── Indexing note ────────────────────────────────────────────────────────
// `MergeRange` (and the `MergeInfo.anchors`/`absorbed` keys built from it) are
// **1-indexed** — the backend emits 1-based merge coords. Proof: the render does
// `merges.anchors.get(\`${rowIdx + 1}:${colIdx + 1}\`)` with 0-indexed rowIdx,
// and `expandBoundsForMerges` does `parseInt(key) - 1` to reach 0-indexed.
// Everything else here — sheet.rows indices, headerRow, the cols used to read
// sheet.rows[r][c], and computeVisibleRows' loop — is **0-indexed**. Convert at
// the boundary: subtract 1 when consuming a MergeRange; add 1 when building an
// anchor key to query MergeInfo.
// ──────────────────────────────────────────────────────────────────────────

export interface HeaderGroup {
  /** 0-indexed column that owns this group's filter value. */
  anchorCol: number;
  /** 0-indexed columns whose data this filter tests (merged-skipped cols removed). */
  cols: number[];
}

export type ConditionOp =
  | "none"
  | "empty"
  | "notEmpty"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "isExactly"
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

export interface ColumnCondition {
  op: ConditionOp;
  operand: string; // ignored for "none" | "empty" | "notEmpty"
}

export interface ColumnFilter {
  condition: ColumnCondition;
  excluded: string[]; // distinct values UNCHECKED; "" = (Blanks)
}

/** colAnchor (0-indexed) → ColumnFilter. */
export type SheetFilters = Record<number, ColumnFilter>;

/**
 * Test a cell value against a named condition.
 * All string ops are case-insensitive. `value` is the cell text (already "" for blanks).
 */
export function conditionMatches(value: string, cond: ColumnCondition): boolean {
  const a = value;
  const b = cond.operand;
  switch (cond.op) {
    case "none":
      return true;
    case "empty":
      return a.trim() === "";
    case "notEmpty":
      return a.trim() !== "";
    case "contains":
      return a.toLowerCase().includes(b.toLowerCase());
    case "notContains":
      return !a.toLowerCase().includes(b.toLowerCase());
    case "startsWith":
      return a.toLowerCase().startsWith(b.toLowerCase());
    case "endsWith":
      return a.toLowerCase().endsWith(b.toLowerCase());
    case "isExactly":
      return a.toLowerCase() === b.toLowerCase();
    case "eq":
      return a.toLowerCase() === b.toLowerCase();
    case "neq":
      return a.toLowerCase() !== b.toLowerCase();
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      // An empty cell never satisfies a numeric/ordering comparison.
      if (a.trim() === "") return false;
      const na = Number(a);
      const nb = Number(b);
      // Numeric path only when both are non-empty finite numbers. Number("") is
      // 0 (finite) but an empty cell must never satisfy a numeric comparison.
      if (
        b.trim() !== "" &&
        Number.isFinite(na) &&
        Number.isFinite(nb)
      ) {
        const diff = na - nb;
        if (cond.op === "gt") return diff > 0;
        if (cond.op === "gte") return diff >= 0;
        if (cond.op === "lt") return diff < 0;
        return diff <= 0;
      }
      const lc = a.toLowerCase().localeCompare(b.toLowerCase());
      if (cond.op === "gt") return lc > 0;
      if (cond.op === "gte") return lc >= 0;
      if (cond.op === "lt") return lc < 0;
      return lc <= 0;
    }
  }
}

/** A condition is active iff its op is not "none". */
export function conditionActive(c: ColumnCondition): boolean {
  return c.op !== "none";
}

/** 0-indexed set of every row in any real (non-1x1) merge. Input MergeRange is 1-indexed. */
export function buildMergedRowSet(merges: MergeRange[]): Set<number> {
  const set = new Set<number>();
  for (const m of merges) {
    const r1 = Math.min(m.r1, m.r2);
    const r2 = Math.max(m.r1, m.r2);
    const c1 = Math.min(m.c1, m.c2);
    const c2 = Math.max(m.c1, m.c2);
    if (r2 - r1 + 1 === 1 && c2 - c1 + 1 === 1) continue;
    for (let r = r1; r <= r2; r++) set.add(r - 1); // 1-indexed → 0-indexed
  }
  return set;
}

/**
 * Build filter groups (0-indexed columns). A horizontal merge anchored in the
 * header row forms one spanning group; every other column is a singleton.
 * Every column yields a group — merged columns are filterable (their merged
 * rows are exempted later via mergedRowSet, not here).
 */
export function headerGroups(
  mi: MergeInfo,
  headerRow: number | null,
  totalCols: number,
): HeaderGroup[] {
  const groups: HeaderGroup[] = [];
  if (headerRow === null) {
    for (let c = 0; c < totalCols; c++) {
      groups.push({ anchorCol: c, cols: [c] });
    }
    return groups;
  }
  const consumed = new Set<number>();
  for (let c = 0; c < totalCols; c++) {
    if (consumed.has(c)) continue;
    // anchors keys are 1-indexed → add 1 to the 0-indexed (headerRow, c).
    const anchor = mi.anchors.get(`${headerRow + 1}:${c + 1}`);
    if (anchor && isHorizontalOnlyMerge(anchor)) {
      const end = c + anchor.colSpan - 1;
      const cols: number[] = [];
      for (let cc = c; cc <= end && cc < totalCols; cc++) {
        consumed.add(cc);
        cols.push(cc);
      }
      if (cols.length > 0) groups.push({ anchorCol: c, cols });
    } else {
      groups.push({ anchorCol: c, cols: [c] });
    }
  }
  return groups;
}

/** True if ANY surviving column in the group matches the condition. */
export function groupMatches(
  sheet: SheetModel,
  r: number,
  group: HeaderGroup,
  cond: ColumnCondition,
): boolean {
  for (const c of group.cols) {
    const cell = sheet.rows[r]?.[c];
    const val = cell ? cellText(cell) : "";
    if (conditionMatches(val, cond)) return true;
  }
  return false;
}

/**
 * Collect distinct cell values across the group's surviving cols over DATA rows
 * only (rows after headerRow), skipping rows in mergedRowSet.
 * Returns sorted unique values with "" (Blanks) first if present.
 */
export function columnDistinctValues(
  sheet: SheetModel,
  group: HeaderGroup,
  headerRow: number | null,
  totalRows: number,
  mergedRowSet: Set<number>,
): string[] {
  const seen = new Set<string>();
  const startRow = (headerRow ?? -1) + 1;
  for (let r = startRow; r < totalRows; r++) {
    if (mergedRowSet.has(r)) continue;
    for (const col of group.cols) {
      const c = sheet.rows[r]?.[col];
      const val = c ? cellText(c) : "";
      seen.add(val);
    }
  }
  const values = [...seen];
  values.sort((a, b) => {
    if (a === "" && b === "") return 0;
    if (a === "") return -1;
    if (b === "") return 1;
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });
  return values;
}

export function hasActiveFilters(filters: SheetFilters | undefined): boolean {
  if (!filters) return false;
  for (const cf of Object.values(filters)) {
    if (conditionActive(cf.condition) || cf.excluded.length > 0) return true;
  }
  return false;
}

/**
 * AND across all groups that have an active filter.
 * Each group's filter has two parts (both must pass):
 *   1. Condition part: if condition is active (op !== "none"), at least one col
 *      in group must match conditionMatches.
 *   2. Checklist part: if excluded.length > 0, at least one col in group must
 *      have a value NOT in the excluded set.
 */
export function rowPasses(
  sheet: SheetModel,
  r: number,
  groups: HeaderGroup[],
  filters: SheetFilters,
): boolean {
  for (const group of groups) {
    const cf = filters[group.anchorCol];
    if (cf === undefined) continue;
    const isActive = conditionActive(cf.condition) || cf.excluded.length > 0;
    if (!isActive) continue;

    // Condition part
    if (conditionActive(cf.condition)) {
      if (!groupMatches(sheet, r, group, cf.condition)) return false;
    }

    // Checklist part
    if (cf.excluded.length > 0) {
      const excludedSet = new Set(cf.excluded);
      let anyNotExcluded = false;
      for (const col of group.cols) {
        const cell = sheet.rows[r]?.[col];
        const val = cell ? cellText(cell) : "";
        if (!excludedSet.has(val)) {
          anyNotExcluded = true;
          break;
        }
      }
      if (!anyNotExcluded) return false;
    }
  }
  return true;
}

/**
 * Visible row indices (0-indexed, in order). Header rows (r <= headerRow) and
 * merged rows are always kept; other rows kept only if they pass all active
 * filters. Returns 0..totalRows-1 unchanged when no filter is active.
 */
export function computeVisibleRows(
  sheet: SheetModel,
  mergedRowSet: Set<number>,
  headerRow: number | null,
  groups: HeaderGroup[],
  filters: SheetFilters,
  totalRows: number,
): number[] {
  if (!hasActiveFilters(filters)) {
    const all: number[] = [];
    for (let r = 0; r < totalRows; r++) all.push(r);
    return all;
  }
  const boundary = headerRow ?? -1;
  const result: number[] = [];
  for (let r = 0; r < totalRows; r++) {
    if (r <= boundary) {
      result.push(r); // header region always visible
    } else if (mergedRowSet.has(r)) {
      result.push(r); // merged rows exempt from filtering
    } else if (rowPasses(sheet, r, groups, filters)) {
      result.push(r);
    }
  }
  return result;
}
