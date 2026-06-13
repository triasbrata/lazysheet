import { describe, it, expect } from "vitest";
import {
  buildSqlQuery,
  generateSqlWithProgress,
  sqlLiteral,
  quoteIdent,
  buildSkipComment,
  keyHasDuplicates,
  ansiUpsertSupported,
  SQL_ROWS_PER_INSERT,
  SQL_SKIP_COMMENT_CAP,
  type BuildSqlOptions,
  type SkippedRow,
} from "./sql-copy";
import type { CellValue, CellModel, SheetModel } from "@/lib/types";
import type { Bounds } from "@/components/Grid/grid-utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cv(v: CellValue): CellModel {
  return { v };
}

/** Wrap a CellValue[][] into a SheetModel. */
function makeSheet(rows: CellValue[][]): SheetModel {
  const cellRows: CellModel[][] = rows.map((row) => row.map((v) => cv(v)));
  const maxCol = Math.max(0, ...cellRows.map((r) => r.length));
  return {
    name: "test_sheet",
    rows: cellRows,
    col_widths: [],
    row_heights: [],
    merges: [],
    frozen_rows: 0,
    frozen_cols: 0,
    max_col: maxCol,
  };
}

/** Build a Bounds covering the entire sheet. */
function fullBounds(sheet: SheetModel): Bounds {
  return {
    r1: 0,
    c1: 0,
    r2: sheet.rows.length - 1,
    c2: sheet.max_col - 1,
  };
}

// ---------------------------------------------------------------------------
// 1. sqlLiteral × dialect
// ---------------------------------------------------------------------------

describe("sqlLiteral", () => {
  it("undefined → NULL", () => {
    expect(sqlLiteral(undefined, "mysql")).toBe("NULL");
  });

  it("Empty → NULL", () => {
    expect(sqlLiteral(cv({ t: "Empty" }), "mysql")).toBe("NULL");
  });

  it("Error → NULL", () => {
    expect(sqlLiteral(cv({ t: "Error", c: "#VALUE!" }), "mysql")).toBe("NULL");
  });

  it("Number raw value", () => {
    expect(sqlLiteral(cv({ t: "Number", c: 3.14 }), "mysql")).toBe("3.14");
    expect(sqlLiteral(cv({ t: "Integer", c: 42 }), "ansi")).toBe("42");
  });

  it("non-finite Number → NULL", () => {
    expect(sqlLiteral(cv({ t: "Number", c: Infinity }), "mysql")).toBe("NULL");
    expect(sqlLiteral(cv({ t: "Number", c: -Infinity }), "postgres")).toBe("NULL");
    expect(sqlLiteral(cv({ t: "Number", c: NaN }), "sqlite")).toBe("NULL");
  });

  it("Bool mysql/sqlite → 1/0", () => {
    expect(sqlLiteral(cv({ t: "Bool", c: true }), "mysql")).toBe("1");
    expect(sqlLiteral(cv({ t: "Bool", c: false }), "mysql")).toBe("0");
    expect(sqlLiteral(cv({ t: "Bool", c: true }), "sqlite")).toBe("1");
    expect(sqlLiteral(cv({ t: "Bool", c: false }), "sqlite")).toBe("0");
  });

  it("Bool postgres/ansi → TRUE/FALSE", () => {
    expect(sqlLiteral(cv({ t: "Bool", c: true }), "postgres")).toBe("TRUE");
    expect(sqlLiteral(cv({ t: "Bool", c: false }), "postgres")).toBe("FALSE");
    expect(sqlLiteral(cv({ t: "Bool", c: true }), "ansi")).toBe("TRUE");
    expect(sqlLiteral(cv({ t: "Bool", c: false }), "ansi")).toBe("FALSE");
  });

  it("Text with single-quote → doubled", () => {
    expect(sqlLiteral(cv({ t: "Text", c: "it's" }), "mysql")).toBe("'it''s'");
    expect(sqlLiteral(cv({ t: "Text", c: "it's" }), "postgres")).toBe("'it''s'");
  });

  it("mysql Text with backslash → escaped", () => {
    expect(sqlLiteral(cv({ t: "Text", c: "a\\b" }), "mysql")).toBe("'a\\\\b'");
    // postgres does NOT escape backslash
    expect(sqlLiteral(cv({ t: "Text", c: "a\\b" }), "postgres")).toBe("'a\\b'");
  });

  it("Date → quoted string", () => {
    expect(sqlLiteral(cv({ t: "Date", c: "2024-01-15" }), "mysql")).toBe("'2024-01-15'");
    expect(sqlLiteral(cv({ t: "Date", c: "2024-01-15" }), "postgres")).toBe("'2024-01-15'");
  });
});

// ---------------------------------------------------------------------------
// 2. numberToPlainString via sqlLiteral (no scientific notation)
// ---------------------------------------------------------------------------

describe("numberToPlainString via sqlLiteral", () => {
  it("1e21 → plain integer string without exponent", () => {
    const result = sqlLiteral(cv({ t: "Number", c: 1e21 }), "ansi");
    expect(result).toBe("1000000000000000000000");
    expect(result).not.toMatch(/e/i);
  });

  it("1e-7 → non-exponent decimal string", () => {
    const result = sqlLiteral(cv({ t: "Number", c: 1e-7 }), "ansi");
    expect(result).not.toMatch(/e/i);
    expect(Number(result)).toBeCloseTo(1e-7, 15);
  });
});

// ---------------------------------------------------------------------------
// 3. quoteIdent
// ---------------------------------------------------------------------------

describe("quoteIdent", () => {
  it("mysql uses backtick quoting", () => {
    expect(quoteIdent("users", "mysql")).toBe("`users`");
  });

  it("mysql escapes inner backtick by doubling", () => {
    expect(quoteIdent("my`table", "mysql")).toBe("`my``table`");
  });

  it("postgres uses double-quote", () => {
    expect(quoteIdent("Users", "postgres")).toBe('"Users"');
  });

  it('postgres escapes inner double-quote by doubling', () => {
    expect(quoteIdent('my"table', "postgres")).toBe('"my""table"');
  });

  it('dotted schema.users → mysql `schema`.`users`', () => {
    expect(quoteIdent("schema.users", "mysql")).toBe("`schema`.`users`");
  });

  it('dotted schema.users → postgres "schema"."users"', () => {
    expect(quoteIdent("schema.users", "postgres")).toBe('"schema"."users"');
  });
});

// ---------------------------------------------------------------------------
// 4. INSERT: 2 data rows + header row → single multi-row statement
// ---------------------------------------------------------------------------

describe("buildSqlQuery INSERT basic", () => {
  const sheet = makeSheet([
    [{ t: "Text", c: "id" }, { t: "Text", c: "name" }, { t: "Text", c: "age" }],
    [{ t: "Integer", c: 1 }, { t: "Text", c: "Alice" }, { t: "Integer", c: 30 }],
    [{ t: "Integer", c: 2 }, { t: "Text", c: "Bob" }, { t: "Integer", c: 25 }],
  ]);

  const opts: BuildSqlOptions = {
    sheet,
    bounds: fullBounds(sheet),
    headerRowIdx: 0,
    kind: "insert",
    tableName: "users",
    dialect: "mysql",
    keyCols: [],
  };

  it("emits a single INSERT … VALUES statement", () => {
    const result = buildSqlQuery(opts);
    expect(result.rowsEmitted).toBe(2);
    expect(result.text).toContain("INSERT INTO");
    // Only one INSERT statement
    expect((result.text.match(/INSERT INTO/g) ?? []).length).toBe(1);
  });

  it("includes quoted column names from header", () => {
    const result = buildSqlQuery(opts);
    expect(result.text).toContain("`id`");
    expect(result.text).toContain("`name`");
    expect(result.text).toContain("`age`");
  });

  it("includes values from both data rows", () => {
    const result = buildSqlQuery(opts);
    expect(result.text).toContain("'Alice'");
    expect(result.text).toContain("'Bob'");
    expect(result.text).toContain("30");
    expect(result.text).toContain("25");
  });
});

// ---------------------------------------------------------------------------
// 5. INSERT batching: 1001 data rows → 3 INSERT statements
// ---------------------------------------------------------------------------

describe("buildSqlQuery INSERT batching", () => {
  it(`1001 data rows with SQL_ROWS_PER_INSERT=${SQL_ROWS_PER_INSERT} → 3 INSERT statements`, () => {
    const headerRow: CellValue[] = [{ t: "Text", c: "val" }];
    const dataRows: CellValue[][] = Array.from({ length: 1001 }, (_, i) => [
      { t: "Integer", c: i },
    ]);
    const sheet = makeSheet([headerRow, ...dataRows]);

    const result = buildSqlQuery({
      sheet,
      bounds: fullBounds(sheet),
      headerRowIdx: 0,
      kind: "insert",
      tableName: "t",
      dialect: "ansi",
      keyCols: [],
    });

    expect(result.rowsEmitted).toBe(1001);
    expect((result.text.match(/INSERT INTO/g) ?? []).length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 6. UPDATE: key/non-key columns, NULL key → skip
// ---------------------------------------------------------------------------

describe("buildSqlQuery UPDATE", () => {
  // Columns: id(0), name(1), email(2)
  // keyCols = [0] (id)
  const sheet = makeSheet([
    [{ t: "Text", c: "id" }, { t: "Text", c: "name" }, { t: "Text", c: "email" }],
    [{ t: "Integer", c: 1 }, { t: "Text", c: "Alice" }, { t: "Text", c: "alice@example.com" }],
    [{ t: "Integer", c: 2 }, { t: "Text", c: "Bob" }, { t: "Text", c: "bob@example.com" }],
    // Row with NULL key — should be skipped
    [{ t: "Empty" }, { t: "Text", c: "Eve" }, { t: "Text", c: "eve@example.com" }],
  ]);

  const opts: BuildSqlOptions = {
    sheet,
    bounds: fullBounds(sheet),
    headerRowIdx: 0,
    kind: "update",
    tableName: "users",
    dialect: "postgres",
    keyCols: [0],
  };

  it("emits UPDATE for rows with valid key", () => {
    const result = buildSqlQuery(opts);
    expect(result.rowsEmitted).toBe(2);
    expect(result.text).toContain("UPDATE");
    expect(result.text).toContain("WHERE");
    expect(result.text).toContain("SET");
  });

  it("SET uses non-key columns", () => {
    const result = buildSqlQuery(opts);
    expect(result.text).toContain('"name"=');
    expect(result.text).toContain('"email"=');
  });

  it("WHERE uses key column", () => {
    const result = buildSqlQuery(opts);
    expect(result.text).toContain('"id"=1');
    expect(result.text).toContain('"id"=2');
  });

  it("row with Empty key is skipped and recorded", () => {
    const result = buildSqlQuery(opts);
    expect(result.skippedRows.length).toBe(1);
    expect(result.skippedRows[0].reason.kind).toBe("null-key");
  });
});

// ---------------------------------------------------------------------------
// 7. E1 position mapping (critical): absolute-index → positional
// ---------------------------------------------------------------------------

describe("E1 position mapping for UPDATE with non-leading keyCols", () => {
  // Columns A..F at absolute indices 0..5
  // Selection starts at c1=2 (col C), c2=5 (col F)
  // So positional cols in bounds: [2,3,4,5] = c,d,e,f
  // Header labels for those cols: "c","d","e","f"
  // keyCols=[4] → absolute col E (index 4), which is position 2 within the selection

  const allColsHeader: CellValue[] = [
    { t: "Text", c: "a" }, // col 0
    { t: "Text", c: "b" }, // col 1
    { t: "Text", c: "c" }, // col 2
    { t: "Text", c: "d" }, // col 3
    { t: "Text", c: "e" }, // col 4 — this is the key
    { t: "Text", c: "f" }, // col 5
  ];

  const dataRow: CellValue[] = [
    { t: "Text", c: "va" }, // col 0
    { t: "Text", c: "vb" }, // col 1
    { t: "Text", c: "vc" }, // col 2
    { t: "Text", c: "vd" }, // col 3
    { t: "Text", c: "ve" }, // col 4 — key value
    { t: "Text", c: "vf" }, // col 5
  ];

  const sheet = makeSheet([allColsHeader, dataRow]);

  const opts: BuildSqlOptions = {
    sheet,
    bounds: { r1: 0, c1: 2, r2: 1, c2: 5 }, // cols C..F only
    headerRowIdx: 0,
    kind: "update",
    tableName: "mytable",
    dialect: "ansi",
    keyCols: [4], // absolute col E (middle of selection)
  };

  it("WHERE uses column 'e' with value 've'", () => {
    const result = buildSqlQuery(opts);
    expect(result.rowsEmitted).toBe(1);
    expect(result.text).toContain('"e"=\'ve\'');
  });

  it("SET contains c, d, f with correct values — NOT shifted or undefined", () => {
    const result = buildSqlQuery(opts);
    expect(result.text).toContain('"c"=\'vc\'');
    expect(result.text).toContain('"d"=\'vd\'');
    expect(result.text).toContain('"f"=\'vf\'');
  });

  it("SET does NOT contain column 'e' (it is the key)", () => {
    const result = buildSqlQuery(opts);
    // The SET clause should not reassign the key column
    // Check that 'e' does not appear in the SET portion
    const setMatch = result.text.match(/SET (.+) WHERE/);
    expect(setMatch).toBeTruthy();
    const setClause = setMatch![1];
    // "e" should not appear in SET clause (it's in WHERE)
    expect(setClause).not.toMatch(/"e"=/);
  });
});

// ---------------------------------------------------------------------------
// 8. UPSERT mysql: ON DUPLICATE KEY UPDATE
// ---------------------------------------------------------------------------

describe("buildSqlQuery UPSERT mysql", () => {
  const sheet = makeSheet([
    [{ t: "Text", c: "id" }, { t: "Text", c: "name" }],
    [{ t: "Integer", c: 1 }, { t: "Text", c: "Alice" }],
  ]);

  it("generates ON DUPLICATE KEY UPDATE with VALUES()", () => {
    const result = buildSqlQuery({
      sheet,
      bounds: fullBounds(sheet),
      headerRowIdx: 0,
      kind: "upsert",
      tableName: "users",
      dialect: "mysql",
      keyCols: [0],
    });

    expect(result.text).toContain("ON DUPLICATE KEY UPDATE");
    expect(result.text).toContain("`name`=VALUES(`name`)");
    // Key column should not appear in the UPDATE part
    expect(result.text.split("ON DUPLICATE KEY UPDATE")[1]).not.toContain(
      "`id`=VALUES(`id`)"
    );
  });
});

// ---------------------------------------------------------------------------
// 9. UPSERT postgres: ON CONFLICT … DO UPDATE SET
// ---------------------------------------------------------------------------

describe("buildSqlQuery UPSERT postgres", () => {
  const sheet = makeSheet([
    [{ t: "Text", c: "id" }, { t: "Text", c: "name" }, { t: "Text", c: "email" }],
    [{ t: "Integer", c: 1 }, { t: "Text", c: "Alice" }, { t: "Text", c: "a@b.com" }],
  ]);

  it("generates ON CONFLICT (key) DO UPDATE SET nonkey=EXCLUDED.nonkey", () => {
    const result = buildSqlQuery({
      sheet,
      bounds: fullBounds(sheet),
      headerRowIdx: 0,
      kind: "upsert",
      tableName: "users",
      dialect: "postgres",
      keyCols: [0],
    });

    expect(result.text).toContain('ON CONFLICT ("id") DO UPDATE SET');
    expect(result.text).toContain('"name"=EXCLUDED."name"');
    expect(result.text).toContain('"email"=EXCLUDED."email"');
  });
});

// ---------------------------------------------------------------------------
// 10. D2: skip all-empty rows
// ---------------------------------------------------------------------------

describe("D2 skip all-empty rows", () => {
  const sheet = makeSheet([
    [{ t: "Text", c: "id" }, { t: "Text", c: "val" }],
    [{ t: "Integer", c: 1 }, { t: "Text", c: "hello" }],
    [{ t: "Empty" }, { t: "Empty" }], // fully empty → skip
    [{ t: "Integer", c: 3 }, { t: "Text", c: "world" }],
  ]);

  it("empty row is not emitted", () => {
    const result = buildSqlQuery({
      sheet,
      bounds: fullBounds(sheet),
      headerRowIdx: 0,
      kind: "insert",
      tableName: "t",
      dialect: "ansi",
      keyCols: [],
    });

    expect(result.rowsEmitted).toBe(2);
    expect(result.skippedRows.length).toBe(1);
    expect(result.skippedRows[0].reason.kind).toBe("empty");
  });
});

// ---------------------------------------------------------------------------
// 11. buildSkipComment
// ---------------------------------------------------------------------------

describe("buildSkipComment", () => {
  it("empty skips → empty string", () => {
    expect(buildSkipComment([])).toBe("");
  });

  it("2 skips → header + two detail lines", () => {
    const skipped: SkippedRow[] = [
      { rowNumber: 2, reason: { kind: "empty" } },
      { rowNumber: 4, reason: { kind: "null-key", cols: ["id"] } },
    ];
    const comment = buildSkipComment(skipped);
    expect(comment).toContain("-- Skipped 2 row(s):");
    expect(comment).toContain("--   row 2: all cells empty");
    expect(comment).toContain("--   row 4: NULL key (id)");
  });

  it(`more than SQL_SKIP_COMMENT_CAP=${SQL_SKIP_COMMENT_CAP} → "...and N more"`, () => {
    const skipped: SkippedRow[] = Array.from(
      { length: SQL_SKIP_COMMENT_CAP + 5 },
      (_, i) => ({ rowNumber: i + 2, reason: { kind: "empty" as const } })
    );
    const comment = buildSkipComment(skipped);
    expect(comment).toContain(`--   ...and 5 more`);
  });

  it("buildSqlQuery text starts with skip comment when skips exist", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "id" }, { t: "Text", c: "val" }],
      [{ t: "Empty" }, { t: "Empty" }], // skipped
      [{ t: "Integer", c: 1 }, { t: "Text", c: "a" }],
    ]);

    const result = buildSqlQuery({
      sheet,
      bounds: fullBounds(sheet),
      headerRowIdx: 0,
      kind: "insert",
      tableName: "t",
      dialect: "ansi",
      keyCols: [],
    });

    expect(result.text.startsWith("-- Skipped")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 12. E2: newline in header label → null-key comment stays single-line
// ---------------------------------------------------------------------------

describe("E2 newline in header label sanitized in comment", () => {
  // Build a sheet where the key column header contains a newline
  const sheetRows: CellModel[][] = [
    [
      cv({ t: "Text", c: "col\nwith\nnewline" }),  // col 0 — key col with newline in label
      cv({ t: "Text", c: "other" }),                 // col 1
    ],
    [
      cv({ t: "Empty" }),                            // null key → skip
      cv({ t: "Text", c: "value" }),
    ],
  ];
  const sheet: SheetModel = {
    name: "test",
    rows: sheetRows,
    col_widths: [],
    row_heights: [],
    merges: [],
    frozen_rows: 0,
    frozen_cols: 0,
    max_col: 2,
  };

  it("null-key skip comment has no raw newline inside the -- line", () => {
    const result = buildSqlQuery({
      sheet,
      bounds: fullBounds(sheet),
      headerRowIdx: 0,
      kind: "update",
      tableName: "t",
      dialect: "ansi",
      keyCols: [0],
    });

    // The comment block should exist
    expect(result.skippedRows.length).toBe(1);
    const comment = buildSkipComment(result.skippedRows);
    // Split into lines; every line that starts with "--" should not have a bare \n embedded
    const lines = comment.split("\n");
    for (const line of lines) {
      // If this is part of a comment line, there should be no embedded \n
      // (the split itself removes \n, so check the content doesn't have \r)
      expect(line).not.toContain("\r");
    }
    // The column label "col\nwith\nnewline" should be sanitized to spaces
    const nullKeyLine = lines.find((l) => l.includes("NULL key"));
    expect(nullKeyLine).toBeDefined();
    expect(nullKeyLine).toContain("col with newline");
  });
});

// ---------------------------------------------------------------------------
// 13. keyHasDuplicates
// ---------------------------------------------------------------------------

describe("keyHasDuplicates", () => {
  it("duplicate key combo → true", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "id" }, { t: "Text", c: "name" }],
      [{ t: "Integer", c: 1 }, { t: "Text", c: "Alice" }],
      [{ t: "Integer", c: 1 }, { t: "Text", c: "Bob" }], // duplicate id=1
    ]);

    expect(keyHasDuplicates(sheet, fullBounds(sheet), 0, [0])).toBe(true);
  });

  it("all unique → false", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "id" }, { t: "Text", c: "name" }],
      [{ t: "Integer", c: 1 }, { t: "Text", c: "Alice" }],
      [{ t: "Integer", c: 2 }, { t: "Text", c: "Bob" }],
    ]);

    expect(keyHasDuplicates(sheet, fullBounds(sheet), 0, [0])).toBe(false);
  });

  it("composite key — duplicate combo → true", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "a" }, { t: "Text", c: "b" }, { t: "Text", c: "c" }],
      [{ t: "Integer", c: 1 }, { t: "Integer", c: 2 }, { t: "Text", c: "x" }],
      [{ t: "Integer", c: 1 }, { t: "Integer", c: 2 }, { t: "Text", c: "y" }], // dup (1,2)
    ]);

    expect(keyHasDuplicates(sheet, fullBounds(sheet), 0, [0, 1])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 14. Truncation
// ---------------------------------------------------------------------------

describe("truncation", () => {
  it("more cells than MAX_CELLS → truncated true", () => {
    // MAX_CELLS = 100_000. Build a sheet with 101 cols × 1001 rows = 101_101 cells
    // (plus header row). This should trigger truncation.
    const numCols = 101;
    const numDataRows = 1001;

    const headerRow: CellValue[] = Array.from({ length: numCols }, (_, i) => ({
      t: "Text",
      c: `col${i}`,
    }));
    const dataRow: CellValue[] = Array.from({ length: numCols }, (_, i) => ({
      t: "Integer",
      c: i,
    }));
    const allRows: CellValue[][] = [
      headerRow,
      ...Array.from({ length: numDataRows }, () => dataRow),
    ];
    const sheet = makeSheet(allRows);

    const result = buildSqlQuery({
      sheet,
      bounds: fullBounds(sheet),
      headerRowIdx: 0,
      kind: "insert",
      tableName: "t",
      dialect: "ansi",
      keyCols: [],
    });

    expect(result.truncated).toBe(true);
    // rowsEmitted should be less than total data rows
    expect(result.rowsEmitted).toBeLessThan(numDataRows);
  });
});

// ---------------------------------------------------------------------------
// 15. generateSqlWithProgress
// ---------------------------------------------------------------------------

describe("generateSqlWithProgress", () => {
  const sheet = makeSheet([
    [{ t: "Text", c: "id" }, { t: "Text", c: "val" }],
    [{ t: "Integer", c: 1 }, { t: "Text", c: "a" }],
    [{ t: "Integer", c: 2 }, { t: "Text", c: "b" }],
  ]);

  const opts: BuildSqlOptions = {
    sheet,
    bounds: fullBounds(sheet),
    headerRowIdx: 0,
    kind: "insert",
    tableName: "t",
    dialect: "ansi",
    keyCols: [],
  };

  it("returns text identical to buildSqlQuery for same opts", async () => {
    const syncResult = buildSqlQuery(opts);
    const progressCalls: Array<{ done: number; total: number }> = [];

    const asyncResult = await generateSqlWithProgress(
      opts,
      (p) => progressCalls.push({ done: p.done, total: p.total })
    );

    expect(asyncResult.text).toBe(syncResult.text);
    expect(asyncResult.rowsEmitted).toBe(syncResult.rowsEmitted);
  });

  it("onProgress called with non-decreasing done up to total", async () => {
    const progressCalls: Array<{ done: number; total: number }> = [];

    await generateSqlWithProgress(opts, (p) =>
      progressCalls.push({ done: p.done, total: p.total })
    );

    expect(progressCalls.length).toBeGreaterThan(0);

    // done values should be non-decreasing
    for (let i = 1; i < progressCalls.length; i++) {
      expect(progressCalls[i].done).toBeGreaterThanOrEqual(progressCalls[i - 1].done);
    }

    // Last call should have done === total
    const last = progressCalls[progressCalls.length - 1];
    expect(last.done).toBe(last.total);
  });

  it("aborts with AbortError when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(); // pre-aborted

    await expect(
      generateSqlWithProgress(opts, () => {}, controller.signal)
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("matches buildSqlQuery for kind=update (one statement per row)", async () => {
    const updateOpts: BuildSqlOptions = {
      ...opts,
      kind: "update",
      dialect: "postgres",
      keyCols: [0],
    };
    const sync = buildSqlQuery(updateOpts);
    const asyncRes = await generateSqlWithProgress(updateOpts, () => {});
    expect(asyncRes.text).toBe(sync.text);
    expect(asyncRes.text).toContain("UPDATE");
  });

  it("matches buildSqlQuery for kind=upsert", async () => {
    const upsertOpts: BuildSqlOptions = {
      ...opts,
      kind: "upsert",
      dialect: "postgres",
      keyCols: [0],
    };
    const sync = buildSqlQuery(upsertOpts);
    const asyncRes = await generateSqlWithProgress(upsertOpts, () => {});
    expect(asyncRes.text).toBe(sync.text);
  });
});

describe("ansiUpsertSupported", () => {
  it("always returns false (ANSI has no standard upsert)", () => {
    expect(ansiUpsertSupported()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 16. C6 zero rows: only header → text === ""
// ---------------------------------------------------------------------------

describe("C6 zero rows (header-only selection)", () => {
  it("selection with only the header row → text is empty string", () => {
    const sheet = makeSheet([
      [{ t: "Text", c: "id" }, { t: "Text", c: "name" }],
    ]);

    const result = buildSqlQuery({
      sheet,
      bounds: { r1: 0, c1: 0, r2: 0, c2: 1 }, // only row 0 = header
      headerRowIdx: 0,
      kind: "insert",
      tableName: "t",
      dialect: "ansi",
      keyCols: [],
    });

    expect(result.text).toBe("");
    expect(result.rowsEmitted).toBe(0);
  });
});
