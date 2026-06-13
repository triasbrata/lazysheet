import { describe, it, expect } from "vitest";
import {
  selectionRowSpan,
  columnLetter,
  colWidth,
  rowHeight,
  clampResize,
  effectiveColWidth,
  effectiveRowHeight,
  sheetFingerprint,
  buildMergeInfo,
  isHorizontalOnlyMerge,
  resolveActiveCoords,
  mergeSpanAt,
  nextVisibleCol,
  nextVisibleRow,
  firstVisibleCol,
  lastVisibleCol,
  firstVisibleRow,
  lastVisibleRow,
  selectionBounds,
  expandBoundsForMerges,
  boundsInclude,
  formatSelectionRef,
  sampleRowIndices,
  selectionColRange,
  selectionRowRange,
  changedRowIndices,
  parseA1,
  computeCellHighlight,
  DEFAULT_COL_WIDTH,
  DEFAULT_ROW_HEIGHT,
  MIN_RESIZE_PX,
  MAX_RESIZE_PX,
  type Selection,
  type Bounds,
} from "./grid-utils";
import type { SheetModel } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSheet(
  rows: number,
  cols: number,
  opts?: { col_widths?: number[]; row_heights?: number[] },
): SheetModel {
  return {
    name: "Sheet1",
    rows: Array.from({ length: rows }, () => []),
    merges: [],
    col_widths: opts?.col_widths ?? Array(cols).fill(80),
    row_heights: opts?.row_heights ?? Array(rows).fill(20),
    frozen_rows: 0,
    frozen_cols: 0,
    max_col: cols,
  };
}

function makeSelection(
  anchorRow: number,
  anchorCol: number,
  focusRow: number,
  focusCol: number,
  mode: Selection["mode"] = "cell",
): Selection {
  return { anchor: { row: anchorRow, col: anchorCol }, focus: { row: focusRow, col: focusCol }, mode, nonce: 0 };
}

// ── selectionRowSpan ─────────────────────────────────────────────────────────

describe("selectionRowSpan", () => {
  const measurements = [
    { index: 0, start: 0, end: 20, size: 20 },
    { index: 1, start: 20, end: 48, size: 28 },
    { index: 2, start: 48, end: 70, size: 22 },
  ];

  it("identity: returns correct bounds when visiblePos maps absolute rows 1:1", () => {
    const visiblePos = new Map([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
    expect(selectionRowSpan(0, 2, visiblePos, measurements)).toEqual({
      top: 0,
      bottom: 70,
    });
  });

  it("filtered: translates absolute rows through visiblePos correctly", () => {
    const visiblePos = new Map([
      [19, 0],
      [56, 1],
      [93, 2],
    ]);
    expect(selectionRowSpan(19, 93, visiblePos, measurements)).toEqual({
      top: 0,
      bottom: 70,
    });
    expect(selectionRowSpan(56, 56, visiblePos, measurements)).toEqual({
      top: 20,
      bottom: 48,
    });
  });

  it("filtered-out bound: returns null when a bound row is not in visiblePos", () => {
    const visiblePos = new Map([
      [19, 0],
      [93, 2],
    ]);
    // row 56 is not in visiblePos
    expect(selectionRowSpan(19, 56, visiblePos, measurements)).toBeNull();
  });

  it("missing measurement: returns null when visiblePos maps to an out-of-range index", () => {
    const visiblePos = new Map([
      [19, 0],
      [56, 5], // index 5 does not exist in measurements
    ]);
    expect(selectionRowSpan(19, 56, visiblePos, measurements)).toBeNull();
  });
});

// ── columnLetter ─────────────────────────────────────────────────────────────

describe("columnLetter", () => {
  it("0 -> A", () => expect(columnLetter(0)).toBe("A"));
  it("1 -> B", () => expect(columnLetter(1)).toBe("B"));
  it("25 -> Z", () => expect(columnLetter(25)).toBe("Z"));
  it("26 -> AA", () => expect(columnLetter(26)).toBe("AA"));
  it("27 -> AB", () => expect(columnLetter(27)).toBe("AB"));
  it("51 -> AZ", () => expect(columnLetter(51)).toBe("AZ"));
  it("52 -> BA", () => expect(columnLetter(52)).toBe("BA"));
  it("701 -> ZZ", () => expect(columnLetter(701)).toBe("ZZ"));
  it("702 -> AAA", () => expect(columnLetter(702)).toBe("AAA"));
});

// ── colWidth / rowHeight ──────────────────────────────────────────────────────

describe("colWidth", () => {
  it("defined non-zero width is returned as-is when >= MIN_VISIBLE_PX", () => {
    const sheet = makeSheet(1, 3, { col_widths: [80, 100, 50] });
    expect(colWidth(sheet, 0)).toBe(80);
    expect(colWidth(sheet, 1)).toBe(100);
  });

  it("0 width (hidden column) returns 0", () => {
    const sheet = makeSheet(1, 3, { col_widths: [80, 0, 50] });
    expect(colWidth(sheet, 1)).toBe(0);
  });

  it("tiny non-zero width is clamped up to MIN_VISIBLE_PX (8)", () => {
    const sheet = makeSheet(1, 3, { col_widths: [80, 3, 50] });
    expect(colWidth(sheet, 1)).toBe(8);
  });

  it("undefined (beyond array) returns DEFAULT_COL_WIDTH", () => {
    const sheet = makeSheet(1, 2, { col_widths: [80] });
    expect(colWidth(sheet, 10)).toBe(DEFAULT_COL_WIDTH);
  });
});

describe("rowHeight", () => {
  it("defined non-zero height is returned as-is when >= MIN_VISIBLE_PX", () => {
    const sheet = makeSheet(3, 1, { row_heights: [20, 30, 16] });
    expect(rowHeight(sheet, 0)).toBe(20);
    expect(rowHeight(sheet, 2)).toBe(16);
  });

  it("0 height (hidden row) returns 0", () => {
    const sheet = makeSheet(3, 1, { row_heights: [20, 0, 16] });
    expect(rowHeight(sheet, 1)).toBe(0);
  });

  it("tiny non-zero height is clamped up to MIN_VISIBLE_PX", () => {
    const sheet = makeSheet(3, 1, { row_heights: [20, 2, 16] });
    expect(rowHeight(sheet, 1)).toBe(8);
  });

  it("undefined (beyond array) returns DEFAULT_ROW_HEIGHT", () => {
    const sheet = makeSheet(2, 1, { row_heights: [20] });
    expect(rowHeight(sheet, 5)).toBe(DEFAULT_ROW_HEIGHT);
  });
});

// ── clampResize ───────────────────────────────────────────────────────────────

describe("clampResize", () => {
  it("within range passes through", () => {
    expect(clampResize(100)).toBe(100);
    expect(clampResize(MIN_RESIZE_PX)).toBe(MIN_RESIZE_PX);
    expect(clampResize(MAX_RESIZE_PX)).toBe(MAX_RESIZE_PX);
  });

  it("below MIN_RESIZE_PX returns MIN_RESIZE_PX", () => {
    expect(clampResize(0)).toBe(MIN_RESIZE_PX);
    expect(clampResize(-10)).toBe(MIN_RESIZE_PX);
    expect(clampResize(MIN_RESIZE_PX - 1)).toBe(MIN_RESIZE_PX);
  });

  it("above MAX_RESIZE_PX returns MAX_RESIZE_PX", () => {
    expect(clampResize(MAX_RESIZE_PX + 1)).toBe(MAX_RESIZE_PX);
    expect(clampResize(99999)).toBe(MAX_RESIZE_PX);
  });
});

// ── effectiveColWidth / effectiveRowHeight ────────────────────────────────────

describe("effectiveColWidth", () => {
  it("no overrides -> falls back to colWidth", () => {
    const sheet = makeSheet(1, 3, { col_widths: [80, 100, 50] });
    expect(effectiveColWidth(sheet, 1)).toBe(100);
  });

  it("with override for that col -> uses override clamped to MIN_VISIBLE_PX", () => {
    const sheet = makeSheet(1, 3, { col_widths: [80, 100, 50] });
    expect(effectiveColWidth(sheet, 1, { 1: 200 })).toBe(200);
    expect(effectiveColWidth(sheet, 1, { 1: 3 })).toBe(8); // clamped to MIN_VISIBLE_PX
  });

  it("override for a different col does not affect target col", () => {
    const sheet = makeSheet(1, 3, { col_widths: [80, 100, 50] });
    expect(effectiveColWidth(sheet, 1, { 0: 200 })).toBe(100);
  });
});

describe("effectiveRowHeight", () => {
  it("no overrides -> falls back to rowHeight", () => {
    const sheet = makeSheet(3, 1, { row_heights: [20, 30, 16] });
    expect(effectiveRowHeight(sheet, 1)).toBe(30);
  });

  it("with override for that row -> uses override clamped to MIN_VISIBLE_PX", () => {
    const sheet = makeSheet(3, 1, { row_heights: [20, 30, 16] });
    expect(effectiveRowHeight(sheet, 1, { 1: 50 })).toBe(50);
    expect(effectiveRowHeight(sheet, 1, { 1: 2 })).toBe(8);
  });

  it("override for a different row does not affect target row", () => {
    const sheet = makeSheet(3, 1, { row_heights: [20, 30, 16] });
    expect(effectiveRowHeight(sheet, 1, { 0: 100 })).toBe(30);
  });
});

// ── sheetFingerprint ──────────────────────────────────────────────────────────

describe("sheetFingerprint", () => {
  it("encodes name:max_col:rowCount", () => {
    const sheet = makeSheet(10, 5);
    sheet.name = "Data";
    expect(sheetFingerprint(sheet)).toBe("Data:5:10");
  });

  it("changes when name changes", () => {
    const s1 = makeSheet(5, 3);
    s1.name = "Sheet1";
    const s2 = makeSheet(5, 3);
    s2.name = "Sheet2";
    expect(sheetFingerprint(s1)).not.toBe(sheetFingerprint(s2));
  });

  it("changes when col count changes", () => {
    const s1 = makeSheet(5, 3);
    const s2 = makeSheet(5, 4);
    expect(sheetFingerprint(s1)).not.toBe(sheetFingerprint(s2));
  });
});

// ── buildMergeInfo / isHorizontalOnlyMerge ────────────────────────────────────
//
// IMPORTANT: MergeRange uses 1-indexed values (as received from the backend).
// buildMergeInfo stores anchor keys as "${r1}:${c1}" (1-indexed).
// resolveActiveCoords/mergeSpanAt look up "${row+1}:${col+1}" (also 1-indexed).
// So a MergeRange {r1:1,c1:1,r2:2,c2:3} creates anchor key "1:1",
// found by mergeSpanAt(info, 0, 0) → key "1:1".

describe("buildMergeInfo", () => {
  it("empty merges -> empty maps", () => {
    const info = buildMergeInfo([]);
    expect(info.anchors.size).toBe(0);
    expect(info.absorbed.size).toBe(0);
  });

  it("1x1 merge is skipped (degenerate)", () => {
    const info = buildMergeInfo([{ r1: 1, c1: 1, r2: 1, c2: 1 }]);
    expect(info.anchors.size).toBe(0);
  });

  it("1x2 horizontal merge: anchor at r1:c1, absorbed cell listed", () => {
    // r1=1,c1=1,r2=1,c2=2 -> anchor "1:1" colSpan=2
    const info = buildMergeInfo([{ r1: 1, c1: 1, r2: 1, c2: 2 }]);
    expect(info.anchors.has("1:1")).toBe(true);
    expect(info.anchors.get("1:1")).toEqual({ rowSpan: 1, colSpan: 2 });
    expect(info.absorbed.has("1:2")).toBe(true);
    expect(info.absorbed.get("1:2")).toBe("1:1");
  });

  it("2x2 merge absorbs 3 non-anchor cells", () => {
    // r1=2,c1=3,r2=3,c2=4 -> anchor "2:3", 4 cells total, 3 absorbed
    const info = buildMergeInfo([{ r1: 2, c1: 3, r2: 3, c2: 4 }]);
    expect(info.anchors.has("2:3")).toBe(true);
    expect(info.absorbed.size).toBe(3);
  });

  it("un-ordered r1/r2 and c1/c2 are normalized to min/max", () => {
    // r1=3,c1=4,r2=1,c2=2 -> normalized r1=1,c1=2 -> anchor "1:2"
    const info = buildMergeInfo([{ r1: 3, c1: 4, r2: 1, c2: 2 }]);
    expect(info.anchors.has("1:2")).toBe(true);
  });
});

describe("isHorizontalOnlyMerge", () => {
  it("rowSpan=1 colSpan>1 -> true", () => {
    expect(isHorizontalOnlyMerge({ rowSpan: 1, colSpan: 3 })).toBe(true);
  });

  it("rowSpan>1 colSpan=1 -> false", () => {
    expect(isHorizontalOnlyMerge({ rowSpan: 2, colSpan: 1 })).toBe(false);
  });

  it("rowSpan>1 colSpan>1 -> false", () => {
    expect(isHorizontalOnlyMerge({ rowSpan: 2, colSpan: 2 })).toBe(false);
  });
});

// ── resolveActiveCoords / mergeSpanAt ─────────────────────────────────────────

describe("resolveActiveCoords", () => {
  // MergeRange 1-indexed: {r1:1,c1:1,r2:2,c2:3} = rows 0-1, cols 0-2 (0-indexed)
  const info = buildMergeInfo([{ r1: 1, c1: 1, r2: 2, c2: 3 }]);

  it("non-absorbed cell returns itself unchanged", () => {
    expect(resolveActiveCoords(info, 5, 5)).toEqual({ row: 5, col: 5 });
  });

  it("absorbed cell resolves to anchor 0-indexed coords", () => {
    // row=1,col=2 (0-indexed) -> key "2:3" (1-indexed) -> anchor "1:1" -> row=0,col=0
    const result = resolveActiveCoords(info, 1, 2);
    expect(result).toEqual({ row: 0, col: 0 });
  });

  it("anchor cell itself is not in absorbed, returns itself", () => {
    // row=0,col=0 is the anchor, not absorbed
    expect(resolveActiveCoords(info, 0, 0)).toEqual({ row: 0, col: 0 });
  });
});

describe("mergeSpanAt", () => {
  // MergeRange 1-indexed: {r1:1,c1:1,r2:2,c2:3} -> anchor "1:1" -> rowSpan=2, colSpan=3
  const info = buildMergeInfo([{ r1: 1, c1: 1, r2: 2, c2: 3 }]);

  it("anchor cell (0-indexed 0,0) returns its span", () => {
    // mergeSpanAt looks up "${0+1}:${0+1}" = "1:1" which is the anchor
    const span = mergeSpanAt(info, 0, 0);
    expect(span).toEqual({ rowSpan: 2, colSpan: 3 });
  });

  it("non-anchor non-absorbed cell returns {rowSpan:1,colSpan:1}", () => {
    expect(mergeSpanAt(info, 5, 5)).toEqual({ rowSpan: 1, colSpan: 1 });
  });
});

// ── nextVisibleCol / nextVisibleRow ───────────────────────────────────────────

describe("nextVisibleCol", () => {
  it("skips hidden col (width=0) and returns next visible", () => {
    const sheet = makeSheet(1, 5, { col_widths: [80, 0, 80, 80, 80] });
    expect(nextVisibleCol(sheet, 0, 1, 5)).toBe(2);
  });

  it("no visible col in direction returns startCol", () => {
    const sheet = makeSheet(1, 5, { col_widths: [80, 0, 0, 0, 0] });
    expect(nextVisibleCol(sheet, 0, 1, 5)).toBe(0);
  });

  it("moves left (-1 direction) skipping hidden cols", () => {
    const sheet = makeSheet(1, 5, { col_widths: [80, 80, 0, 80, 80] });
    expect(nextVisibleCol(sheet, 3, -1, 5)).toBe(1);
  });
});

describe("nextVisibleRow", () => {
  it("skips hidden row (height=0)", () => {
    const sheet = makeSheet(5, 1, { row_heights: [20, 0, 20, 20, 20] });
    expect(nextVisibleRow(sheet, 0, 1, 5)).toBe(2);
  });

  it("no visible row in direction returns startRow", () => {
    const sheet = makeSheet(5, 1, { row_heights: [0, 0, 0, 0, 20] });
    expect(nextVisibleRow(sheet, 4, -1, 5)).toBe(4);
  });
});

// ── firstVisibleCol/Row / lastVisibleCol/Row ──────────────────────────────────

describe("firstVisibleCol", () => {
  it("all visible -> 0", () => {
    const sheet = makeSheet(1, 4);
    expect(firstVisibleCol(sheet, 4)).toBe(0);
  });

  it("first hidden -> returns next visible", () => {
    const sheet = makeSheet(1, 4, { col_widths: [0, 0, 80, 80] });
    expect(firstVisibleCol(sheet, 4)).toBe(2);
  });

  it("all hidden -> returns 0 (fallback)", () => {
    const sheet = makeSheet(1, 3, { col_widths: [0, 0, 0] });
    expect(firstVisibleCol(sheet, 3)).toBe(0);
  });
});

describe("lastVisibleCol", () => {
  it("all visible -> last index", () => {
    const sheet = makeSheet(1, 4);
    expect(lastVisibleCol(sheet, 4)).toBe(3);
  });

  it("last hidden -> returns previous visible", () => {
    const sheet = makeSheet(1, 4, { col_widths: [80, 80, 0, 0] });
    expect(lastVisibleCol(sheet, 4)).toBe(1);
  });

  it("all hidden -> returns maxCol-1 (fallback)", () => {
    const sheet = makeSheet(1, 3, { col_widths: [0, 0, 0] });
    expect(lastVisibleCol(sheet, 3)).toBe(2);
  });
});

describe("firstVisibleRow", () => {
  it("all visible -> 0", () => {
    const sheet = makeSheet(4, 1);
    expect(firstVisibleRow(sheet, 4)).toBe(0);
  });

  it("first hidden -> returns next visible", () => {
    const sheet = makeSheet(4, 1, { row_heights: [0, 0, 20, 20] });
    expect(firstVisibleRow(sheet, 4)).toBe(2);
  });

  it("all hidden -> returns 0 (fallback)", () => {
    const sheet = makeSheet(3, 1, { row_heights: [0, 0, 0] });
    expect(firstVisibleRow(sheet, 3)).toBe(0);
  });
});

describe("lastVisibleRow", () => {
  it("all visible -> last index", () => {
    const sheet = makeSheet(4, 1);
    expect(lastVisibleRow(sheet, 4)).toBe(3);
  });

  it("last hidden -> returns previous visible", () => {
    const sheet = makeSheet(4, 1, { row_heights: [20, 20, 0, 0] });
    expect(lastVisibleRow(sheet, 4)).toBe(1);
  });

  it("all hidden -> returns maxRow-1 (fallback)", () => {
    const sheet = makeSheet(3, 1, { row_heights: [0, 0, 0] });
    expect(lastVisibleRow(sheet, 3)).toBe(2);
  });
});

// ── selectionBounds ───────────────────────────────────────────────────────────

describe("selectionBounds", () => {
  it("mode=all -> full sheet bounds", () => {
    const sel = makeSelection(0, 0, 0, 0, "all");
    expect(selectionBounds(sel, 10, 5)).toEqual({ r1: 0, c1: 0, r2: 9, c2: 4 });
  });

  it("mode=row -> full column range, clamped row range", () => {
    const sel = makeSelection(2, 0, 4, 0, "row");
    expect(selectionBounds(sel, 10, 5)).toEqual({ r1: 2, c1: 0, r2: 4, c2: 4 });
  });

  it("mode=row inverted anchor/focus -> normalized r1<=r2", () => {
    const sel = makeSelection(4, 0, 2, 0, "row");
    expect(selectionBounds(sel, 10, 5)).toEqual({ r1: 2, c1: 0, r2: 4, c2: 4 });
  });

  it("mode=col -> full row range, clamped col range", () => {
    const sel = makeSelection(0, 1, 0, 3, "col");
    expect(selectionBounds(sel, 10, 5)).toEqual({ r1: 0, c1: 1, r2: 9, c2: 3 });
  });

  it("mode=col inverted anchor/focus -> normalized c1<=c2", () => {
    const sel = makeSelection(0, 3, 0, 1, "col");
    expect(selectionBounds(sel, 10, 5)).toEqual({ r1: 0, c1: 1, r2: 9, c2: 3 });
  });

  it("mode=cell -> tight bounds around anchor/focus", () => {
    const sel = makeSelection(1, 2, 3, 4, "cell");
    expect(selectionBounds(sel, 10, 5)).toEqual({ r1: 1, c1: 2, r2: 3, c2: 4 });
  });

  it("mode=cell single cell -> r1==r2, c1==c2", () => {
    const sel = makeSelection(2, 3, 2, 3, "cell");
    expect(selectionBounds(sel, 10, 5)).toEqual({ r1: 2, c1: 3, r2: 2, c2: 3 });
  });
});

// ── expandBoundsForMerges ─────────────────────────────────────────────────────
//
// expandBoundsForMerges uses anchor keys from buildMergeInfo and converts
// them back to 0-indexed: ar = parseInt(arStr) - 1. So a MergeRange {r1:1,...}
// stores anchor key "1:..." and expands to ar = 0 (0-indexed).

describe("expandBoundsForMerges", () => {
  it("no merges -> bounds unchanged", () => {
    const info = buildMergeInfo([]);
    const b: Bounds = { r1: 1, c1: 1, r2: 3, c2: 3 };
    expect(expandBoundsForMerges(b, info)).toEqual(b);
  });

  it("merge fully inside bounds -> bounds unchanged", () => {
    // MergeRange {r1:2,c1:2,r2:3,c2:3} -> 0-indexed rows 1-2, cols 1-2
    const info = buildMergeInfo([{ r1: 2, c1: 2, r2: 3, c2: 3 }]);
    const b: Bounds = { r1: 0, c1: 0, r2: 5, c2: 5 };
    expect(expandBoundsForMerges(b, info)).toEqual(b);
  });

  it("merge partially intersecting expands bounds to fully contain it", () => {
    // MergeRange {r1:1,c1:1,r2:3,c2:1} -> 0-indexed rows 0-2, cols 0-0
    // Selection starts at row 1 (0-indexed), so it intersects row 1-2 of the merge
    // but misses the anchor at row 0 -> should expand r1 to 0
    const info = buildMergeInfo([{ r1: 1, c1: 1, r2: 3, c2: 1 }]);
    const b: Bounds = { r1: 1, c1: 0, r2: 3, c2: 2 };
    const expanded = expandBoundsForMerges(b, info);
    expect(expanded.r1).toBe(0); // anchor at 0-indexed row 0
  });

  it("merge anchor left of bounds expands c1 leftward", () => {
    // MergeRange {r1:2,c1:1,r2:2,c2:3} -> 0-indexed row 1, cols 0-2.
    // Selection covers row 1, cols 1-2 — intersects the merge but misses its
    // anchor at col 0 -> should expand c1 to 0.
    const info = buildMergeInfo([{ r1: 2, c1: 1, r2: 2, c2: 3 }]);
    const b: Bounds = { r1: 1, c1: 1, r2: 1, c2: 2 };
    const expanded = expandBoundsForMerges(b, info);
    expect(expanded.c1).toBe(0);
    expect(expanded.c2).toBe(2);
  });

  it("merge completely outside bounds -> bounds unchanged", () => {
    // MergeRange {r1:11,c1:11,...} -> 0-indexed rows 10-11, far from bounds
    const info = buildMergeInfo([{ r1: 11, c1: 11, r2: 13, c2: 13 }]);
    const b: Bounds = { r1: 0, c1: 0, r2: 3, c2: 3 };
    expect(expandBoundsForMerges(b, info)).toEqual(b);
  });
});

// ── boundsInclude ─────────────────────────────────────────────────────────────

describe("boundsInclude", () => {
  const b: Bounds = { r1: 2, c1: 3, r2: 5, c2: 7 };

  it("cell inside bounds -> true", () => {
    expect(boundsInclude(b, 3, 5)).toBe(true);
  });

  it("cell on boundary -> true", () => {
    expect(boundsInclude(b, 2, 3)).toBe(true);
    expect(boundsInclude(b, 5, 7)).toBe(true);
  });

  it("cell outside bounds -> false", () => {
    expect(boundsInclude(b, 1, 5)).toBe(false);
    expect(boundsInclude(b, 3, 8)).toBe(false);
    expect(boundsInclude(b, 6, 5)).toBe(false);
  });
});

// ── formatSelectionRef ────────────────────────────────────────────────────────

describe("formatSelectionRef", () => {
  it("mode=row single row -> '3:3'", () => {
    const sel = makeSelection(2, 0, 2, 0, "row");
    const b: Bounds = { r1: 2, c1: 0, r2: 2, c2: 9 };
    expect(formatSelectionRef(sel, b)).toBe("3:3");
  });

  it("mode=row multi-row -> '3:5'", () => {
    const sel = makeSelection(2, 0, 4, 0, "row");
    const b: Bounds = { r1: 2, c1: 0, r2: 4, c2: 9 };
    expect(formatSelectionRef(sel, b)).toBe("3:5");
  });

  it("mode=col single col -> 'A:A'", () => {
    const sel = makeSelection(0, 0, 0, 0, "col");
    const b: Bounds = { r1: 0, c1: 0, r2: 9, c2: 0 };
    expect(formatSelectionRef(sel, b)).toBe("A:A");
  });

  it("mode=col multi-col -> 'B:D'", () => {
    const sel = makeSelection(0, 1, 0, 3, "col");
    const b: Bounds = { r1: 0, c1: 1, r2: 9, c2: 3 };
    expect(formatSelectionRef(sel, b)).toBe("B:D");
  });

  it("mode=cell single cell -> 'C3'", () => {
    const sel = makeSelection(2, 2, 2, 2, "cell");
    const b: Bounds = { r1: 2, c1: 2, r2: 2, c2: 2 };
    expect(formatSelectionRef(sel, b)).toBe("C3");
  });

  it("mode=cell range -> 'B2:D5'", () => {
    const sel = makeSelection(1, 1, 4, 3, "cell");
    const b: Bounds = { r1: 1, c1: 1, r2: 4, c2: 3 };
    expect(formatSelectionRef(sel, b)).toBe("B2:D5");
  });
});

// ── sampleRowIndices ──────────────────────────────────────────────────────────

describe("sampleRowIndices", () => {
  it("total <= 0 -> []", () => {
    expect(sampleRowIndices(0)).toEqual([]);
    expect(sampleRowIndices(-1)).toEqual([]);
  });

  it("total <= cap -> returns all indices 0..total-1", () => {
    expect(sampleRowIndices(5, 10)).toEqual([0, 1, 2, 3, 4]);
    expect(sampleRowIndices(1, 10)).toEqual([0]);
  });

  it("total == cap -> returns all indices", () => {
    const result = sampleRowIndices(10, 10);
    expect(result).toHaveLength(10);
    expect(result[0]).toBe(0);
    expect(result[9]).toBe(9);
  });

  it("total > cap -> returns cap samples including first and last", () => {
    const result = sampleRowIndices(100, 5);
    expect(result).toHaveLength(5);
    expect(result[0]).toBe(0);
    expect(result[result.length - 1]).toBe(99);
  });

  it("large total with default cap -> includes 0 and total-1, no duplicates", () => {
    const result = sampleRowIndices(50000);
    expect(result[0]).toBe(0);
    expect(result[result.length - 1]).toBe(49999);
    const set = new Set(result);
    expect(set.size).toBe(result.length);
  });
});

// ── selectionColRange / selectionRowRange ─────────────────────────────────────

describe("selectionColRange", () => {
  it("null selection -> null", () => {
    expect(selectionColRange(null, 10)).toBeNull();
  });

  it("mode=cell -> null", () => {
    expect(selectionColRange(makeSelection(0, 0, 1, 1, "cell"), 10)).toBeNull();
  });

  it("mode=row -> null", () => {
    expect(selectionColRange(makeSelection(0, 0, 1, 0, "row"), 10)).toBeNull();
  });

  it("mode=col -> [c1, c2] normalized", () => {
    expect(selectionColRange(makeSelection(0, 3, 0, 1, "col"), 10)).toEqual([1, 3]);
  });

  it("mode=all -> [0, totalCols-1]", () => {
    expect(selectionColRange(makeSelection(0, 0, 0, 0, "all"), 10)).toEqual([0, 9]);
  });
});

describe("selectionRowRange", () => {
  it("null selection -> null", () => {
    expect(selectionRowRange(null, 10)).toBeNull();
  });

  it("mode=cell -> null", () => {
    expect(selectionRowRange(makeSelection(0, 0, 1, 1, "cell"), 10)).toBeNull();
  });

  it("mode=col -> null", () => {
    expect(selectionRowRange(makeSelection(0, 0, 0, 1, "col"), 10)).toBeNull();
  });

  it("mode=row -> [r1, r2] normalized", () => {
    expect(selectionRowRange(makeSelection(3, 0, 1, 0, "row"), 10)).toEqual([1, 3]);
  });

  it("mode=all -> [0, totalRows-1]", () => {
    expect(selectionRowRange(makeSelection(0, 0, 0, 0, "all"), 10)).toEqual([0, 9]);
  });
});

// ── changedRowIndices ─────────────────────────────────────────────────────────

describe("changedRowIndices", () => {
  it("both undefined -> []", () => {
    expect(changedRowIndices(undefined, undefined)).toEqual([]);
  });

  it("prev undefined, cur has entries -> all cur keys returned", () => {
    const result = changedRowIndices(undefined, { 3: 50, 7: 80 });
    expect(new Set(result)).toEqual(new Set([3, 7]));
  });

  it("cur undefined, prev has entries -> all prev keys returned", () => {
    const result = changedRowIndices({ 2: 30 }, undefined);
    expect(new Set(result)).toEqual(new Set([2]));
  });

  it("same keys same values -> []", () => {
    expect(changedRowIndices({ 1: 20, 2: 30 }, { 1: 20, 2: 30 })).toEqual([]);
  });

  it("changed value for key -> that key returned", () => {
    const result = changedRowIndices({ 1: 20, 2: 30 }, { 1: 25, 2: 30 });
    expect(result).toContain(1);
    expect(result).not.toContain(2);
  });

  it("key removed from cur -> that key returned", () => {
    const result = changedRowIndices({ 1: 20, 2: 30 }, { 2: 30 });
    expect(result).toContain(1);
  });

  it("new key added in cur -> that key returned", () => {
    const result = changedRowIndices({ 1: 20 }, { 1: 20, 5: 60 });
    expect(result).toContain(5);
  });
});

// ── parseA1 ───────────────────────────────────────────────────────────────────

describe("parseA1", () => {
  it("single letter + row -> {row, col} 0-indexed", () => {
    expect(parseA1("A1")).toEqual({ row: 0, col: 0 });
    expect(parseA1("B2")).toEqual({ row: 1, col: 1 });
    expect(parseA1("Z10")).toEqual({ row: 9, col: 25 });
  });

  it("multi-letter column -> correct col index", () => {
    expect(parseA1("AA1")).toEqual({ row: 0, col: 26 });
    expect(parseA1("AB1")).toEqual({ row: 0, col: 27 });
  });

  it("lowercase input is handled", () => {
    expect(parseA1("a1")).toEqual({ row: 0, col: 0 });
    expect(parseA1("b3")).toEqual({ row: 2, col: 1 });
  });

  it("leading/trailing whitespace trimmed", () => {
    expect(parseA1(" A1 ")).toEqual({ row: 0, col: 0 });
  });

  it("invalid format -> null", () => {
    expect(parseA1("1A")).toBeNull();
    expect(parseA1("")).toBeNull();
    expect(parseA1("A0")).toBeNull(); // row 0 is invalid (must be >=1)
    expect(parseA1("ABC")).toBeNull();
    expect(parseA1("123")).toBeNull();
  });
});

// ── computeCellHighlight ──────────────────────────────────────────────────────

describe("computeCellHighlight", () => {
  const noMatch = new Set<string>();

  it("anchor in multi-cell range -> 'selected' (blends with range tint)", () => {
    // expandedBounds covers rows 0-1, cols 0-1 (multi-cell)
    const bounds: Bounds = { r1: 0, c1: 0, r2: 1, c2: 1 };
    expect(
      computeCellHighlight(0, 0, {
        anchor: { row: 0, col: 0 },
        bounds,
        multi: true,
        matchSet: noMatch,
      }),
    ).toBe("selected");
  });

  it("anchor in single-cell selection -> 'anchor'", () => {
    const bounds: Bounds = { r1: 2, c1: 3, r2: 2, c2: 3 };
    expect(
      computeCellHighlight(2, 3, {
        anchor: { row: 2, col: 3 },
        bounds,
        multi: false,
        matchSet: noMatch,
      }),
    ).toBe("anchor");
  });

  it("non-anchor cell inside range -> 'selected'", () => {
    const bounds: Bounds = { r1: 0, c1: 0, r2: 2, c2: 2 };
    expect(
      computeCellHighlight(1, 1, {
        anchor: { row: 0, col: 0 },
        bounds,
        multi: true,
        matchSet: noMatch,
      }),
    ).toBe("selected");
  });

  it("cell in matchSet but not selected -> 'match'", () => {
    expect(
      computeCellHighlight(3, 5, {
        anchor: null,
        bounds: null,
        multi: false,
        matchSet: new Set(["3:5"]),
      }),
    ).toBe("match");
  });

  it("cell outside any range and not in matchSet -> null", () => {
    expect(
      computeCellHighlight(9, 9, {
        anchor: { row: 0, col: 0 },
        bounds: { r1: 0, c1: 0, r2: 2, c2: 2 },
        multi: true,
        matchSet: noMatch,
      }),
    ).toBeNull();
  });

  it("precedence: anchor wins over match (anchor+match on same cell -> anchor path)", () => {
    // anchor is single-cell, and matchSet also contains the anchor cell
    const bounds: Bounds = { r1: 1, c1: 1, r2: 1, c2: 1 };
    expect(
      computeCellHighlight(1, 1, {
        anchor: { row: 1, col: 1 },
        bounds,
        multi: false,
        matchSet: new Set(["1:1"]),
      }),
    ).toBe("anchor");
  });

  it("precedence: selected wins over match (non-anchor selected cell also in matchSet -> 'selected')", () => {
    const bounds: Bounds = { r1: 0, c1: 0, r2: 3, c2: 3 };
    expect(
      computeCellHighlight(2, 2, {
        anchor: { row: 0, col: 0 },
        bounds,
        multi: true,
        matchSet: new Set(["2:2"]),
      }),
    ).toBe("selected");
  });
});
