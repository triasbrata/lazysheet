import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGridFilters } from "./useGridFilters";
import type { SheetModel, CellModel, MergeRange } from "@/lib/types";
import type { SheetFilters } from "@/lib/grid-filter";
import type { Selection } from "./grid-utils";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCell(text: string): CellModel {
  return { v: { t: "Text", c: text } };
}

function makeSheet(overrides: Partial<SheetModel> = {}): SheetModel {
  const NUM_ROWS = 10;
  const NUM_COLS = 5;
  const rows: CellModel[][] = Array.from({ length: NUM_ROWS }, (_, r) =>
    Array.from({ length: NUM_COLS }, (_, c) =>
      r === 0 ? makeCell(`H${c}`) : makeCell(`R${r}C${c}`),
    ),
  );
  return {
    name: "Sheet1",
    rows,
    col_widths: Array.from({ length: NUM_COLS }, () => 80),
    row_heights: Array.from({ length: NUM_ROWS }, () => 24),
    merges: [],
    frozen_rows: 0,
    frozen_cols: 0,
    max_col: NUM_COLS,
    ...overrides,
  };
}

function makeSelection(
  r1: number,
  c1: number,
  r2 = r1,
  c2 = c1,
  mode: Selection["mode"] = "cell",
): Selection {
  return {
    anchor: { row: r1, col: c1 },
    focus: { row: r2, col: c2 },
    mode,
    scroll: "none",
    nonce: 1,
  };
}

// Default opts that produce a minimal valid hook call.
function defaultOpts(overrides: Partial<Parameters<typeof useGridFilters>[0]> = {}) {
  const sheet = overrides.sheet ?? makeSheet();
  return {
    sheet,
    headerRow: null as number | null,
    totalRows: sheet.rows.length,
    totalCols: sheet.max_col,
    filters: undefined as SheetFilters | undefined,
    selection: null as Selection | null | undefined,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useGridFilters — merges map built from sheet.merges", () => {
  it("produces empty anchors/absorbed maps when sheet has no merges", () => {
    const { result } = renderHook(() => useGridFilters(defaultOpts()));
    expect(result.current.merges.anchors.size).toBe(0);
    expect(result.current.merges.absorbed.size).toBe(0);
  });

  it("registers a horizontal merge anchor (1-indexed key)", () => {
    // A horizontal merge spanning row 2 cols 2-3 (0-indexed) → 1-indexed key "3:3"
    const merges: MergeRange[] = [{ r1: 3, c1: 3, r2: 3, c2: 4 }];
    const sheet = makeSheet({ merges });
    const { result } = renderHook(() =>
      useGridFilters(defaultOpts({ sheet, totalRows: sheet.rows.length })),
    );
    // Anchor key is 1-indexed
    expect(result.current.merges.anchors.has("3:3")).toBe(true);
    const span = result.current.merges.anchors.get("3:3");
    expect(span?.colSpan).toBe(2);
    expect(span?.rowSpan).toBe(1);
  });

  it("registers a vertical merge anchor and its absorbed rows", () => {
    // Vertical merge: rows 2-3 (1-indexed), col 1 (1-indexed)
    const merges: MergeRange[] = [{ r1: 2, c1: 1, r2: 3, c2: 1 }];
    const sheet = makeSheet({ merges });
    const { result } = renderHook(() =>
      useGridFilters(defaultOpts({ sheet, totalRows: sheet.rows.length })),
    );
    expect(result.current.merges.anchors.has("2:1")).toBe(true);
    // "3:1" is absorbed by "2:1"
    expect(result.current.merges.absorbed.get("3:1")).toBe("2:1");
  });
});

describe("useGridFilters — visibleRowIndices respects active column filters", () => {
  it("returns all rows when no filters are active", () => {
    const sheet = makeSheet();
    const { result } = renderHook(() =>
      useGridFilters(defaultOpts({ sheet, totalRows: sheet.rows.length })),
    );
    expect(result.current.visibleRowIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("hides rows that do not match an active filter (headerRow=0)", () => {
    // Row 0 is header; rows 1-9 have values "R<r>C0". Filter to show only R1C0.
    const sheet = makeSheet();
    const filters: SheetFilters = {
      0: { condition: { op: "isExactly", operand: "R1C0" }, excluded: [] },
    };
    const { result } = renderHook(() =>
      useGridFilters(
        defaultOpts({
          sheet,
          headerRow: 0,
          totalRows: sheet.rows.length,
          filters,
        }),
      ),
    );
    // Header row (0) always visible; only row 1 passes the filter.
    expect(result.current.visibleRowIndices).toContain(0); // header always shown
    expect(result.current.visibleRowIndices).toContain(1); // passes filter
    // Other data rows should be absent
    expect(result.current.visibleRowIndices).not.toContain(2);
    expect(result.current.visibleRowIndices).not.toContain(5);
  });

  it("exempts merge-straddling rows from filtering", () => {
    // Vertical merge spanning rows 2-3 (0-indexed) → those rows are in mergedRowSet.
    // A strict filter that should hide everything should still keep merged rows.
    const merges: MergeRange[] = [{ r1: 3, c1: 1, r2: 4, c2: 1 }]; // 1-indexed → 0-indexed rows 2-3
    const sheet = makeSheet({ merges });
    const filters: SheetFilters = {
      0: { condition: { op: "isExactly", operand: "NOMATCH" }, excluded: [] },
    };
    const { result } = renderHook(() =>
      useGridFilters(
        defaultOpts({
          sheet,
          headerRow: 0,
          totalRows: sheet.rows.length,
          filters,
        }),
      ),
    );
    // Merged rows (0-indexed 2 and 3) must remain visible despite the filter.
    expect(result.current.visibleRowIndices).toContain(2);
    expect(result.current.visibleRowIndices).toContain(3);
  });
});

describe("useGridFilters — visiblePos is the inverse index of visibleRowIndices", () => {
  it("maps each row index to its position in visibleRowIndices (no filter)", () => {
    const { result } = renderHook(() => useGridFilters(defaultOpts()));
    const { visibleRowIndices, visiblePos } = result.current;
    visibleRowIndices.forEach((r, i) => {
      expect(visiblePos.get(r)).toBe(i);
    });
  });

  it("maps filtered row indices correctly", () => {
    const sheet = makeSheet();
    const filters: SheetFilters = {
      0: { condition: { op: "isExactly", operand: "R3C0" }, excluded: [] },
    };
    const { result } = renderHook(() =>
      useGridFilters(
        defaultOpts({
          sheet,
          headerRow: 0,
          totalRows: sheet.rows.length,
          filters,
        }),
      ),
    );
    const { visibleRowIndices, visiblePos } = result.current;
    // Inverse: every entry in visiblePos must correctly resolve back to the same position
    visibleRowIndices.forEach((r, i) => {
      expect(visiblePos.get(r)).toBe(i);
    });
  });
});

describe("useGridFilters — expandedBounds expands selection over merges", () => {
  it("returns null when selection is null", () => {
    const { result } = renderHook(() =>
      useGridFilters(defaultOpts({ selection: null })),
    );
    expect(result.current.expandedBounds).toBeNull();
  });

  it("returns single-cell bounds for a single-cell selection with no merges", () => {
    const selection = makeSelection(2, 3);
    const { result } = renderHook(() =>
      useGridFilters(defaultOpts({ selection })),
    );
    const b = result.current.expandedBounds;
    expect(b).not.toBeNull();
    expect(b?.r1).toBe(2);
    expect(b?.r2).toBe(2);
    expect(b?.c1).toBe(3);
    expect(b?.c2).toBe(3);
  });

  it("expands bounds when selection clips a horizontal merge", () => {
    // Horizontal merge: row 2, cols 2-3 (0-indexed) → 1-indexed key "3:3"
    const merges: MergeRange[] = [{ r1: 3, c1: 3, r2: 3, c2: 4 }];
    const sheet = makeSheet({ merges });
    // Selection covers row 2, col 2 only — but col 3 is absorbed so bounds should expand.
    const selection = makeSelection(2, 2, 2, 2);
    const { result } = renderHook(() =>
      useGridFilters(
        defaultOpts({
          sheet,
          totalRows: sheet.rows.length,
          selection,
        }),
      ),
    );
    const b = result.current.expandedBounds;
    // Bounds must include col 3 (the absorbed cell).
    expect(b?.c2).toBeGreaterThanOrEqual(3);
  });

  it("returns range bounds for a multi-cell selection with no merges", () => {
    const selection = makeSelection(0, 0, 3, 4);
    const { result } = renderHook(() =>
      useGridFilters(defaultOpts({ selection })),
    );
    const b = result.current.expandedBounds;
    expect(b?.r1).toBe(0);
    expect(b?.r2).toBe(3);
    expect(b?.c1).toBe(0);
    expect(b?.c2).toBe(4);
  });
});

describe("useGridFilters — openFilterDistinct lazy/populated on setOpenFilter", () => {
  it("is empty when openFilter is null (initial state)", () => {
    const { result } = renderHook(() =>
      useGridFilters(defaultOpts({ headerRow: 0 })),
    );
    expect(result.current.openFilter).toBeNull();
    expect(result.current.openFilterDistinct).toEqual([]);
  });

  it("populates openFilterDistinct when setOpenFilter is called with a column", () => {
    const sheet = makeSheet();
    const { result } = renderHook(() =>
      useGridFilters(
        defaultOpts({ sheet, headerRow: 0, totalRows: sheet.rows.length }),
      ),
    );

    act(() => {
      result.current.setOpenFilter({ col: 0, source: "row" });
    });

    expect(result.current.openFilter).toEqual({ col: 0, source: "row" });
    // Column 0 has values H0 (header) + R1C0..R9C0; distinct data values after header
    expect(result.current.openFilterDistinct.length).toBeGreaterThan(0);
    // Data rows produce values like "R1C0", "R2C0", etc.
    expect(result.current.openFilterDistinct).toContain("R1C0");
  });

  it("returns empty distinct when setOpenFilter references an unknown column (no group)", () => {
    // headerRow=null means all cols are singleton groups. Use a col index beyond totalCols.
    const { result } = renderHook(() =>
      useGridFilters(defaultOpts({ headerRow: null })),
    );

    act(() => {
      result.current.setOpenFilter({ col: 999, source: "band" });
    });

    // groupByAnchor won't have col 999 → openFilterDistinct should be []
    expect(result.current.openFilterDistinct).toEqual([]);
  });

  it("resets to empty when setOpenFilter is called with null", () => {
    const sheet = makeSheet();
    const { result } = renderHook(() =>
      useGridFilters(
        defaultOpts({ sheet, headerRow: 0, totalRows: sheet.rows.length }),
      ),
    );

    act(() => {
      result.current.setOpenFilter({ col: 0, source: "row" });
    });
    expect(result.current.openFilterDistinct.length).toBeGreaterThan(0);

    act(() => {
      result.current.setOpenFilter(null);
    });
    expect(result.current.openFilter).toBeNull();
    expect(result.current.openFilterDistinct).toEqual([]);
  });
});
