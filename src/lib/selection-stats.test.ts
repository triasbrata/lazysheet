import { describe, it, expect } from "vitest";
import {
  computeSelectionStats,
  formatStatNumber,
  STATS_CELL_CAP,
} from "@/lib/selection-stats";
import type { SheetModel, CellModel, CellValue } from "@/lib/types";
import type { Bounds } from "@/components/Grid/grid-utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cv(v: CellValue): CellModel {
  return { v };
}

function makeSheet(rows: CellValue[][]): SheetModel {
  const cellRows: CellModel[][] = rows.map((row) => row.map(cv));
  const maxCol = Math.max(0, ...cellRows.map((r) => r.length));
  return {
    name: "test",
    rows: cellRows,
    col_widths: [],
    row_heights: [],
    merges: [],
    frozen_rows: 0,
    frozen_cols: 0,
    max_col: maxCol,
  };
}

function fullBounds(sheet: SheetModel): Bounds {
  return {
    r1: 0,
    c1: 0,
    r2: sheet.rows.length - 1,
    c2: sheet.max_col - 1,
  };
}

// ---------------------------------------------------------------------------
// STATS_CELL_CAP export
// ---------------------------------------------------------------------------

describe("STATS_CELL_CAP", () => {
  it("is 100_000", () => {
    expect(STATS_CELL_CAP).toBe(100_000);
  });
});

// ---------------------------------------------------------------------------
// computeSelectionStats
// ---------------------------------------------------------------------------

describe("computeSelectionStats", () => {
  it("single numeric cell", () => {
    const sheet = makeSheet([[{ t: "Number", c: 42 }]]);
    const result = computeSelectionStats(sheet, fullBounds(sheet));
    expect(result).not.toBeNull();
    expect(result!.count).toBe(1);
    expect(result!.sum).toBe(42);
    expect(result!.avg).toBe(42);
    expect(result!.min).toBe(42);
    expect(result!.max).toBe(42);
  });

  it("multiple numeric cells: correct sum/avg/min/max/count", () => {
    const sheet = makeSheet([
      [{ t: "Number", c: 10 }, { t: "Number", c: 20 }],
      [{ t: "Integer", c: 5 }, { t: "Number", c: 15 }],
    ]);
    const result = computeSelectionStats(sheet, fullBounds(sheet));
    expect(result).not.toBeNull();
    expect(result!.count).toBe(4);
    expect(result!.sum).toBe(50);
    expect(result!.avg).toBe(12.5);
    expect(result!.min).toBe(5);
    expect(result!.max).toBe(20);
  });

  it("mixed numeric + text: only numerics counted", () => {
    const sheet = makeSheet([
      [{ t: "Number", c: 100 }, { t: "Text", c: "hello" }],
      [{ t: "Text", c: "world" }, { t: "Integer", c: 50 }],
    ]);
    const result = computeSelectionStats(sheet, fullBounds(sheet));
    expect(result).not.toBeNull();
    expect(result!.count).toBe(2);
    expect(result!.sum).toBe(150);
    expect(result!.min).toBe(50);
    expect(result!.max).toBe(100);
  });

  it("text cells that look numeric (Text kind with numeric string) are counted", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "100" }, { t: "Text", c: "200" }],
    ]);
    const result = computeSelectionStats(sheet, fullBounds(sheet));
    expect(result).not.toBeNull();
    expect(result!.count).toBe(2);
    expect(result!.sum).toBe(300);
  });

  it("all empty cells → returns null", () => {
    const sheet = makeSheet([
      [{ t: "Empty" }, { t: "Empty" }],
      [{ t: "Empty" }, { t: "Empty" }],
    ]);
    const result = computeSelectionStats(sheet, fullBounds(sheet));
    expect(result).toBeNull();
  });

  it("all text (non-numeric) → returns null", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "foo" }, { t: "Text", c: "bar" }],
    ]);
    const result = computeSelectionStats(sheet, fullBounds(sheet));
    expect(result).toBeNull();
  });

  it("Bool, Date, Error cells → all return null for numeric (count stays 0)", () => {
    const sheet = makeSheet([
      [{ t: "Bool", c: true }, { t: "Date", c: "2024-01-01" }, { t: "Error", c: "#N/A" }],
    ]);
    const result = computeSelectionStats(sheet, fullBounds(sheet));
    expect(result).toBeNull();
  });

  it("negative numbers: correct min/max", () => {
    const sheet = makeSheet([
      [{ t: "Number", c: -10 }, { t: "Number", c: -5 }, { t: "Number", c: -1 }],
    ]);
    const result = computeSelectionStats(sheet, fullBounds(sheet));
    expect(result).not.toBeNull();
    expect(result!.min).toBe(-10);
    expect(result!.max).toBe(-1);
    expect(result!.sum).toBe(-16);
  });

  it("partial bounds: only counts cells in range", () => {
    const sheet = makeSheet([
      [{ t: "Number", c: 1 }, { t: "Number", c: 2 }, { t: "Number", c: 3 }],
      [{ t: "Number", c: 4 }, { t: "Number", c: 5 }, { t: "Number", c: 6 }],
    ]);
    // Only select col 1 (index 1), rows 0–1
    const bounds: Bounds = { r1: 0, c1: 1, r2: 1, c2: 1 };
    const result = computeSelectionStats(sheet, bounds);
    expect(result).not.toBeNull();
    expect(result!.count).toBe(2);
    expect(result!.sum).toBe(7); // 2 + 5
    expect(result!.min).toBe(2);
    expect(result!.max).toBe(5);
  });

  it("returns null when totalCells exceeds STATS_CELL_CAP", () => {
    // Create a bounds that exceeds the cap without building a huge sheet
    const sheet = makeSheet([[{ t: "Number", c: 1 }]]);
    // bounds that represent more than 100_000 cells
    const bigBounds: Bounds = {
      r1: 0,
      c1: 0,
      r2: 999,
      c2: 99, // 1000 * 100 = 100_000 — exactly at cap, not over
    };
    // Exactly at cap → not null (totalCells == STATS_CELL_CAP is NOT > cap)
    const atCap = computeSelectionStats(sheet, bigBounds);
    // The cell at (0,0) exists with value 1; rest are missing rows → count=1
    expect(atCap).not.toBeNull();
    expect(atCap!.count).toBe(1);

    // Over cap by 1 cell → returns null
    const overBounds: Bounds = {
      r1: 0,
      c1: 0,
      r2: 1000,
      c2: 99, // 1001 * 100 = 100_100 > 100_000
    };
    expect(computeSelectionStats(sheet, overBounds)).toBeNull();
  });

  it("missing row in sheet (sparse) → skips gracefully", () => {
    // Sheet has only row 0; bounds asks for rows 0..2
    const sheet = makeSheet([[{ t: "Number", c: 7 }]]);
    const bounds: Bounds = { r1: 0, c1: 0, r2: 2, c2: 0 };
    const result = computeSelectionStats(sheet, bounds);
    expect(result).not.toBeNull();
    expect(result!.count).toBe(1);
    expect(result!.sum).toBe(7);
  });

  it("missing cell in row (sparse) → skips gracefully", () => {
    const cellRows: CellModel[][] = [[cv({ t: "Number", c: 3 })]];
    // Row 0 exists but col 1 doesn't
    const sheet: SheetModel = {
      name: "s",
      rows: cellRows,
      col_widths: [],
      row_heights: [],
      merges: [],
      frozen_rows: 0,
      frozen_cols: 0,
      max_col: 2,
    };
    const bounds: Bounds = { r1: 0, c1: 0, r2: 0, c2: 1 };
    const result = computeSelectionStats(sheet, bounds);
    expect(result).not.toBeNull();
    expect(result!.count).toBe(1);
    expect(result!.sum).toBe(3);
  });

  it("Integer cell at value 0 is counted", () => {
    const sheet = makeSheet([[{ t: "Integer", c: 0 }]]);
    const result = computeSelectionStats(sheet, fullBounds(sheet));
    expect(result).not.toBeNull();
    expect(result!.count).toBe(1);
    expect(result!.sum).toBe(0);
    expect(result!.avg).toBe(0);
    expect(result!.min).toBe(0);
    expect(result!.max).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// formatStatNumber
// ---------------------------------------------------------------------------

describe("formatStatNumber", () => {
  it("integer → formatted without decimal", () => {
    // Intl.NumberFormat on an integer — should not have decimal point in en-US locale
    const result = formatStatNumber(42);
    expect(result).toBe("42");
  });

  it("zero → formatted as zero", () => {
    expect(formatStatNumber(0)).toBe("0");
  });

  it("negative integer", () => {
    const result = formatStatNumber(-100);
    expect(result).toBe("-100");
  });

  it("float → includes decimal", () => {
    const result = formatStatNumber(3.14);
    // The decimal separator varies by locale but must have some fractional part
    expect(result).toMatch(/3[.,]14/);
  });

  it("float with more than 4 decimals → capped at 4", () => {
    const result = formatStatNumber(1.123456789);
    // maximumFractionDigits: 4 → at most 4 digits after separator
    const decMatch = result.match(/[.,](\d+)$/);
    if (decMatch) {
      expect(decMatch[1].length).toBeLessThanOrEqual(4);
    }
  });

  it("large integer → grouped (e.g., 1,000,000 in en-US)", () => {
    const result = formatStatNumber(1_000_000);
    // In any locale, grouped format should be longer than "1000000"
    expect(result.length).toBeGreaterThan(7);
    // And should contain the digits
    expect(result.replace(/[\s,.']/g, "")).toBe("1000000");
  });

  it("negative float", () => {
    const result = formatStatNumber(-2.5);
    expect(result).toMatch(/-2[.,]5/);
  });
});
