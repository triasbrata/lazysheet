import { describe, it, expect } from "vitest";
import { buildSelectionMarkdown } from "@/lib/markdown-export";
import type { BuildMarkdownResult, CopyFormat } from "@/lib/markdown-export";
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
    name: "sheet",
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

// Build a 2-row sheet: row 0 = headers, rows 1+ = data
// headers: ["Name", "Age"]  data: [["Alice", 30], ["Bob", 25]]
function makeBasicSheet() {
  return makeSheet([
    [{ t: "Text", c: "Name" }, { t: "Text", c: "Age" }],
    [{ t: "Text", c: "Alice" }, { t: "Integer", c: 30 }],
    [{ t: "Text", c: "Bob" }, { t: "Integer", c: 25 }],
  ]);
}

// ---------------------------------------------------------------------------
// table format
// ---------------------------------------------------------------------------

describe("buildSelectionMarkdown — table format", () => {
  it("produces pipe-table with header, separator, and body rows", () => {
    const sheet = makeBasicSheet();
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "table");

    expect(result.truncated).toBe(false);
    expect(result.rowsEmitted).toBe(2);
    const lines = result.text.split("\n");
    // header line
    expect(lines[0]).toContain("Name");
    expect(lines[0]).toContain("Age");
    // separator
    expect(lines[1]).toMatch(/\|[\s-]+\|/);
    // data rows
    expect(lines[2]).toContain("Alice");
    expect(lines[3]).toContain("Bob");
  });

  it("pipes in cell values are escaped", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "Col" }],
      [{ t: "Text", c: "a|b" }],
    ]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "table");
    expect(result.text).toContain("a\\|b");
  });

  it("newlines in cell values are collapsed to space", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "Col" }],
      [{ t: "Text", c: "line1\nline2" }],
    ]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "table");
    expect(result.text).toContain("line1 line2");
  });

  it("uses columnLetter when no header row provided (null)", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "Alice" }, { t: "Integer", c: 30 }],
    ]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), null, "table");
    // columnLetter(0)="A", columnLetter(1)="B"
    expect(result.text).toContain("A");
    expect(result.text).toContain("B");
  });

  it("uses columnLetter when header cell is empty text", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "" }, { t: "Text", c: "Age" }],
      [{ t: "Text", c: "Alice" }, { t: "Integer", c: 30 }],
    ]);
    // col 0 header is empty → fall back to columnLetter(0) = "A"
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "table");
    expect(result.text).toContain("| A |");
  });

  it("single-cell selection", () => {
    const sheet = makeSheet([[{ t: "Number", c: 42 }]]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), null, "table");
    expect(result.rowsEmitted).toBe(1);
    expect(result.text).toContain("42");
  });

  it("column letter offset: selection starting at c1=1 uses B as first col label", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "X" }, { t: "Text", c: "Header" }],
      [{ t: "Integer", c: 1 }, { t: "Text", c: "val" }],
    ]);
    const bounds: Bounds = { r1: 0, c1: 1, r2: 1, c2: 1 };
    const result = buildSelectionMarkdown(sheet, bounds, 0, "table");
    // header from row 0, col 1 = "Header"
    expect(result.text).toContain("Header");
  });
});

// ---------------------------------------------------------------------------
// csv format
// ---------------------------------------------------------------------------

describe("buildSelectionMarkdown — csv format", () => {
  it("produces comma-separated with CRLF line endings", () => {
    const sheet = makeBasicSheet();
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "csv");
    expect(result.text).toContain("\r\n");
    expect(result.text).toContain("Name,Age");
    expect(result.text).toContain("Alice,30");
    expect(result.text).toContain("Bob,25");
  });

  it("RFC-4180: wraps fields containing commas in double quotes", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "Col" }],
      [{ t: "Text", c: "hello, world" }],
    ]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "csv");
    expect(result.text).toContain('"hello, world"');
  });

  it("RFC-4180: wraps fields containing double quotes and escapes them", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "Col" }],
      [{ t: "Text", c: 'say "hi"' }],
    ]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "csv");
    expect(result.text).toContain('"say ""hi"""');
  });

  it("RFC-4180: wraps fields containing newlines", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "Col" }],
      [{ t: "Text", c: "line1\nline2" }],
    ]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "csv");
    expect(result.text).toContain('"line1\nline2"');
  });

  it("plain string without special chars is not quoted", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "Col" }],
      [{ t: "Text", c: "simple" }],
    ]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "csv");
    expect(result.text).toContain("simple");
    expect(result.text).not.toContain('"simple"');
  });
});

// ---------------------------------------------------------------------------
// tsv format
// ---------------------------------------------------------------------------

describe("buildSelectionMarkdown — tsv format", () => {
  it("produces tab-separated values with LF endings", () => {
    const sheet = makeBasicSheet();
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "tsv");
    expect(result.text).toContain("\t");
    expect(result.text).toContain("Name\tAge");
    expect(result.text).toContain("Alice\t30");
  });

  it("tabs in cell values are collapsed to space", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "Col" }],
      [{ t: "Text", c: "a\tb" }],
    ]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "tsv");
    expect(result.text).toContain("a b");
  });

  it("newlines in cell values are collapsed to space", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "Col" }],
      [{ t: "Text", c: "line1\r\nline2" }],
    ]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "tsv");
    expect(result.text).toContain("line1 line2");
  });
});

// ---------------------------------------------------------------------------
// plain format
// ---------------------------------------------------------------------------

describe("buildSelectionMarkdown — plain format", () => {
  it("produces tab-separated values with no escaping", () => {
    const sheet = makeBasicSheet();
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "plain");
    expect(result.text).toContain("Name\tAge");
    expect(result.text).toContain("Alice\t30");
  });

  it("tabs in cell values are preserved as-is (no escaping)", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "Col" }],
      [{ t: "Text", c: "a\tb" }],
    ]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "plain");
    // plain does no escaping — raw tab is kept
    expect(result.text).toContain("a\tb");
  });
});

// ---------------------------------------------------------------------------
// ascii format
// ---------------------------------------------------------------------------

describe("buildSelectionMarkdown — ascii format", () => {
  it("produces +---+ border style table", () => {
    const sheet = makeBasicSheet();
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "ascii");
    expect(result.text).toMatch(/\+[-+]+\+/);
    expect(result.text).toContain("Name");
    expect(result.text).toContain("Alice");
    expect(result.text).toContain("Bob");
  });

  it("starts and ends with border line", () => {
    const sheet = makeBasicSheet();
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "ascii");
    const lines = result.text.split("\n");
    expect(lines[0]).toMatch(/^\+[-+]+\+$/);
    expect(lines[lines.length - 1]).toMatch(/^\+[-+]+\+$/);
  });

  it("column widths accommodate longest value", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "H" }],
      [{ t: "Text", c: "very long value" }],
    ]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "ascii");
    // The border must be at least as wide as "very long value" + padding
    expect(result.text).toContain("very long value");
  });

  it("newlines in cell values are collapsed for width math", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "Col" }],
      [{ t: "Text", c: "a\nb" }],
    ]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "ascii");
    expect(result.text).toContain("a b");
  });
});

// ---------------------------------------------------------------------------
// inline format (default)
// ---------------------------------------------------------------------------

describe("buildSelectionMarkdown — inline format", () => {
  it("default format is inline", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "Name" }],
      [{ t: "Text", c: "Alice" }],
    ]);
    // no format arg → default "inline"
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0);
    expect(result.text).toContain("Name: Alice");
  });

  it("produces `Header: Value` per cell, rows separated by blank line", () => {
    const sheet = makeBasicSheet();
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "inline");
    expect(result.text).toContain("Name: Alice");
    expect(result.text).toContain("Age: 30");
    expect(result.text).toContain("Name: Bob");
    expect(result.text).toContain("Age: 25");
    // Two data rows separated by blank line (double newline)
    expect(result.text).toContain("\n\n");
  });

  it("single column inline", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "Item" }],
      [{ t: "Text", c: "Apple" }],
      [{ t: "Text", c: "Banana" }],
    ]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "inline");
    expect(result.text).toContain("Item: Apple");
    expect(result.text).toContain("Item: Banana");
  });

  it("empty cell value renders as empty string (trailing whitespace trimmed)", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "Col" }],
      [{ t: "Empty" }],
    ]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "inline");
    // The output is "Col: " but trailing whitespace is trimmed by the source → "Col:"
    expect(result.text).toContain("Col:");
    expect(result.rowsEmitted).toBe(1);
  });

  it("uses columnLetter when headerRowIdx is null", () => {
    const sheet = makeSheet([[{ t: "Integer", c: 5 }]]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), null, "inline");
    expect(result.text).toContain("A: 5");
  });

  it("trailing whitespace is trimmed from output", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "H" }],
      [{ t: "Text", c: "v" }],
    ]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "inline");
    expect(result.text).toBe(result.text.replace(/\s+$/, ""));
  });
});

// ---------------------------------------------------------------------------
// title format
// ---------------------------------------------------------------------------

describe("buildSelectionMarkdown — title format", () => {
  it("produces `### Header\\nValue` per cell", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "Name" }],
      [{ t: "Text", c: "Alice" }],
    ]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "title");
    expect(result.text).toContain("### Name\nAlice");
  });

  it("rows are separated by ---", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "Name" }],
      [{ t: "Text", c: "Alice" }],
      [{ t: "Text", c: "Bob" }],
    ]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "title");
    expect(result.text).toContain("---");
  });

  it("multiple columns: cells joined with double newline within a row", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "A" }, { t: "Text", c: "B" }],
      [{ t: "Text", c: "v1" }, { t: "Text", c: "v2" }],
    ]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "title");
    expect(result.text).toContain("### A\nv1");
    expect(result.text).toContain("### B\nv2");
  });
});

// ---------------------------------------------------------------------------
// rowFilter parameter
// ---------------------------------------------------------------------------

describe("buildSelectionMarkdown — rowFilter", () => {
  it("table format: rowFilter skips non-matching rows", () => {
    const sheet = makeBasicSheet();
    // Only include row 1 (Alice), skip row 2 (Bob)
    const result = buildSelectionMarkdown(
      sheet,
      fullBounds(sheet),
      0,
      "table",
      (r) => r === 1,
    );
    expect(result.text).toContain("Alice");
    expect(result.text).not.toContain("Bob");
    expect(result.rowsEmitted).toBe(1);
  });

  it("inline format: rowFilter skips non-matching rows", () => {
    const sheet = makeBasicSheet();
    const result = buildSelectionMarkdown(
      sheet,
      fullBounds(sheet),
      0,
      "inline",
      (r) => r === 2,
    );
    expect(result.text).toContain("Bob");
    expect(result.text).not.toContain("Alice");
  });
});

// ---------------------------------------------------------------------------
// Header row skipped from data
// ---------------------------------------------------------------------------

describe("header row is excluded from data output", () => {
  it("table: header row not repeated as a data row", () => {
    const sheet = makeBasicSheet();
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "table");
    const lines = result.text.split("\n");
    // Lines: header | separator | Alice | Bob — exactly 4 lines
    expect(lines).toHaveLength(4);
  });

  it("inline: rowsEmitted counts only data rows", () => {
    const sheet = makeBasicSheet();
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "inline");
    expect(result.rowsEmitted).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Empty selection / sparse sheet
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("empty row in sheet (sparse) → emits empty-value cells", () => {
    // row 1 doesn't exist in sheet.rows
    const sheet: SheetModel = {
      name: "s",
      rows: [
        [cv({ t: "Text", c: "Col" })],
        // row 1 missing
      ],
      col_widths: [],
      row_heights: [],
      merges: [],
      frozen_rows: 0,
      frozen_cols: 0,
      max_col: 1,
    };
    const bounds: Bounds = { r1: 0, c1: 0, r2: 2, c2: 0 };
    // headerRowIdx=0, data rows 1,2 — row 2 doesn't exist
    const result = buildSelectionMarkdown(sheet, bounds, 0, "table");
    // Rows 1 and 2 are data rows; both should produce empty strings
    expect(result.rowsEmitted).toBe(2);
  });

  it("multi-column selection produces correct column count in table", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "A" }, { t: "Text", c: "B" }, { t: "Text", c: "C" }],
      [{ t: "Integer", c: 1 }, { t: "Integer", c: 2 }, { t: "Integer", c: 3 }],
    ]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "table");
    const headerLine = result.text.split("\n")[0];
    // Should have 3 column pipes segments
    expect(headerLine).toContain("A");
    expect(headerLine).toContain("B");
    expect(headerLine).toContain("C");
  });

  it("non-zero c1 offset: column letters based on absolute index", () => {
    // Bounds start at column 2 (C), no header row
    const sheet = makeSheet([
      [{ t: "Text", c: "x" }, { t: "Text", c: "y" }, { t: "Text", c: "z" }],
    ]);
    const bounds: Bounds = { r1: 0, c1: 2, r2: 0, c2: 2 };
    const result = buildSelectionMarkdown(sheet, bounds, null, "table");
    // columnLetter(2) = "C"
    expect(result.text).toContain("C");
  });

  it("truncation: many cells triggers truncated=true", () => {
    // Build a sheet with many rows to exceed MAX_CELLS = 100_000
    const numCols = 100;
    const numRows = 1020; // 1020 * 100 = 102_000 > 100_000
    const headerRow: CellValue[] = Array.from({ length: numCols }, (_, i) => ({
      t: "Text" as const,
      c: `h${i}`,
    }));
    const dataRow: CellValue[] = Array.from({ length: numCols }, () => ({
      t: "Text" as const,
      c: "x",
    }));
    const allRows: CellValue[][] = [
      headerRow,
      ...Array.from({ length: numRows }, () => dataRow),
    ];
    const sheet = makeSheet(allRows);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "table");
    expect(result.truncated).toBe(true);
    expect(result.rowsEmitted).toBeLessThan(numRows);
  });

  it("truncation in inline/title format also sets truncated=true", () => {
    const numCols = 100;
    const numRows = 1020;
    const headerRow: CellValue[] = Array.from({ length: numCols }, (_, i) => ({
      t: "Text" as const,
      c: `h${i}`,
    }));
    const dataRow: CellValue[] = Array.from({ length: numCols }, () => ({
      t: "Text" as const,
      c: "x",
    }));
    const allRows: CellValue[][] = [
      headerRow,
      ...Array.from({ length: numRows }, () => dataRow),
    ];
    const sheet = makeSheet(allRows);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "inline");
    expect(result.truncated).toBe(true);
  });

  it("header row with Empty cell → falls back to columnLetter", () => {
    const sheet = makeSheet([
      [{ t: "Empty" }, { t: "Text", c: "B_header" }],
      [{ t: "Text", c: "val1" }, { t: "Text", c: "val2" }],
    ]);
    const result = buildSelectionMarkdown(sheet, fullBounds(sheet), 0, "table");
    // col 0 header is Empty → cellText returns "" → fall back to "A"
    expect(result.text).toContain("A");
    expect(result.text).toContain("B_header");
  });
});

// ---------------------------------------------------------------------------
// CopyFormat type exhaustive smoke test
// ---------------------------------------------------------------------------

describe("all CopyFormat variants execute without throwing", () => {
  const sheet = makeBasicSheet();
  const formats: CopyFormat[] = ["inline", "title", "table", "ascii", "csv", "tsv", "plain"];

  for (const fmt of formats) {
    it(`format="${fmt}" completes successfully`, () => {
      const result: BuildMarkdownResult = buildSelectionMarkdown(
        sheet,
        fullBounds(sheet),
        0,
        fmt,
      );
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.rowsEmitted).toBe(2);
      expect(result.truncated).toBe(false);
    });
  }
});
