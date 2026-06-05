import { describe, it, expect } from "vitest";
import {
  computeGroupBySummary,
  resolveFields,
  buildValueHeader,
  formatGroupByMarkdown,
  formatGroupByTSV,
  MAX_GROUP_ROWS,
  SUBTOTAL_LABEL_SUFFIX,
  type GroupByOpts,
  type GroupByResult,
} from "./group-by-summary";
import type { Bounds } from "@/components/Grid/grid-utils";
import { numericValue, type SheetModel, type CellModel, type CellValue } from "@/lib/types";

// ── Fixtures ────────────────────────────────────────────────────────────
// Reproduces the reported bug: an xlsx "income" export where numeric columns
// (Subtotal after seller discounts, Subtotal before discounts, ...) arrive as
// formatted TEXT cells. The group-by summary then reports
// "No data to aggregate (N non-numeric value cells skipped)".
//
// Cell value variants used below:
//   num("135000")  -> { t: "Integer", c: 135000 }   (parsed as a real number)
//   numF(98.5)     -> { t: "Number",  c: 98.5 }      (real float)
//   txt("135000")  -> { t: "Text",    c: "135000" }  (THE BUG: numeric-looking text)
//   txt("APAC")    -> { t: "Text",    c: "APAC" }    (genuinely non-numeric)

function cell(v: CellValue): CellModel {
  return { v };
}
const num = (s: string): CellModel => cell({ t: "Integer", c: Number(s) });
const numF = (n: number): CellModel => cell({ t: "Number", c: n });
const txt = (s: string): CellModel => cell({ t: "Text", c: s });
const empty = (): CellModel => cell({ t: "Empty" });

function makeSheet(rows: CellModel[][]): SheetModel {
  const maxCols = Math.max(0, ...rows.map((r) => r.length));
  return {
    name: "income_20260302",
    rows,
    merges: [],
    col_widths: Array(maxCols).fill(100),
    row_heights: Array(rows.length).fill(20),
    frozen_rows: 0,
    frozen_cols: 0,
    max_col: maxCols,
  };
}

function boundsFor(sheet: SheetModel): Bounds {
  return { r1: 0, c1: 0, r2: sheet.rows.length - 1, c2: sheet.max_col - 1 };
}

// Columns mirror the screenshot subset H/I/J:
//   col 0 = "Subtotal after seller discounts"  (group-by key)
//   col 1 = "Subtotal before discounts"        (aggregate value)
//   col 2 = "Seller discounts"
const HEADER = [
  txt("Subtotal after seller discounts"),
  txt("Subtotal before discounts"),
  txt("Seller discounts"),
];

// Sample data taken from the reported sheet (after / before / seller-discount).
// Three distinct group keys: 98550, 180000, 110000.
const RAW: Array<[string, string, string]> = [
  ["98550", "135000", "-36450"],
  ["98550", "135000", "-36450"],
  ["180000", "240000", "-60000"],
  ["180000", "240000", "-60000"],
  ["180000", "240000", "-60000"],
  ["98550", "135000", "-36450"],
  ["110000", "110000", "0"],
];

// Expected SUM(before discounts) grouped by (after discounts):
//   98550  -> 135000 * 3 = 405000   (3 rows)
//   180000 -> 240000 * 3 = 720000   (3 rows)
//   110000 -> 110000     = 110000   (1 row)
const EXPECTED_SUM: Record<string, { value: number; count: number }> = {
  "98550": { value: 405000, count: 3 },
  "180000": { value: 720000, count: 3 },
  "110000": { value: 110000, count: 1 },
};

const SUM_OPTS: GroupByOpts = {
  aggFn: "sum",
  valueCol: 1,
  categoryCols: [0],
  excludeRow: 0, // header row excluded
};

// ── Group 1: Happy path — values are REAL numbers ────────────────────────
// Guards correct behavior. Passes today; catches regressions in the fix.
describe("computeGroupBySummary — numeric value cells (happy path)", () => {
  const sheet = makeSheet([HEADER, ...RAW.map((r) => [num(r[0]), num(r[1]), num(r[2])])]);
  const bounds = boundsFor(sheet);

  it("SUM groups numeric values correctly", () => {
    const res = computeGroupBySummary(sheet, bounds, SUM_OPTS);
    expect(res.skippedNonNumeric).toBe(0);
    expect(res.totalRowsAggregated).toBe(7);
    expect(res.totalGroups).toBe(3);
    for (const row of res.rows) {
      const exp = EXPECTED_SUM[row.keys[0]];
      expect(exp, `unexpected group key ${row.keys[0]}`).toBeDefined();
      expect(row.value).toBe(exp.value);
      expect(row.count).toBe(exp.count);
    }
  });

  it("AVG averages within each group", () => {
    const res = computeGroupBySummary(sheet, bounds, { ...SUM_OPTS, aggFn: "avg" });
    const byKey = Object.fromEntries(res.rows.map((r) => [r.keys[0], r.value]));
    expect(byKey["98550"]).toBe(135000); // 405000 / 3
    expect(byKey["180000"]).toBe(240000); // 720000 / 3
    expect(byKey["110000"]).toBe(110000);
  });

  it("MIN / MAX pick group extremes", () => {
    const sheetMixed = makeSheet([
      HEADER,
      [num("98550"), num("100"), num("0")],
      [num("98550"), num("900"), num("0")],
    ]);
    const min = computeGroupBySummary(sheetMixed, boundsFor(sheetMixed), { ...SUM_OPTS, aggFn: "min" });
    const max = computeGroupBySummary(sheetMixed, boundsFor(sheetMixed), { ...SUM_OPTS, aggFn: "max" });
    expect(min.rows[0].value).toBe(100);
    expect(max.rows[0].value).toBe(900);
  });

  it("COUNT counts non-empty value cells (no numeric requirement)", () => {
    const res = computeGroupBySummary(sheet, bounds, { ...SUM_OPTS, aggFn: "count" });
    expect(res.totalRowsAggregated).toBe(7);
    const byKey = Object.fromEntries(res.rows.map((r) => [r.keys[0], r.value]));
    expect(byKey["98550"]).toBe(3);
    expect(byKey["180000"]).toBe(3);
    expect(byKey["110000"]).toBe(1);
  });

  it("real non-numeric text in value col IS skipped (correct)", () => {
    const sheetBad = makeSheet([
      HEADER,
      [num("98550"), txt("N/A"), num("0")],
      [num("98550"), num("135000"), num("0")],
    ]);
    const res = computeGroupBySummary(sheetBad, boundsFor(sheetBad), SUM_OPTS);
    expect(res.skippedNonNumeric).toBe(1);
    expect(res.totalRowsAggregated).toBe(1);
    expect(res.rows[0].value).toBe(135000);
  });
});

// ── Group 2: Regression — numeric text (xlsx format) is coerced ──────────
// The reported "income" export stored numbers as formatted Text. The fix
// coerces numeric-looking Text into real numbers so grouping/aggregation
// works, while genuinely non-numeric text is still skipped.
describe("numeric text values (xlsx format) are coerced and aggregated", () => {
  const sheet = makeSheet([HEADER, ...RAW.map((r) => [txt(r[0]), txt(r[1]), txt(r[2])])]);
  const bounds = boundsFor(sheet);

  it("SUM aggregates text-numeric values just like real numbers", () => {
    const res = computeGroupBySummary(sheet, bounds, SUM_OPTS);
    expect(res.skippedNonNumeric).toBe(0);
    expect(res.totalRowsAggregated).toBe(7);
    expect(res.totalGroups).toBe(3);
    const byKey = Object.fromEntries(res.rows.map((r) => [r.keys[0], r.value]));
    expect(byKey["98550"]).toBe(405000);
    expect(byKey["180000"]).toBe(720000);
    expect(byKey["110000"]).toBe(110000);
  });

  it("mixed: coerce numeric text, skip only genuine non-numeric", () => {
    const mixed = makeSheet([
      HEADER,
      [txt("98550"), txt("135000"), txt("0")], // coercible
      [txt("98550"), txt("not-a-number"), txt("0")], // genuinely non-numeric -> skip
      [txt("98550"), numF(135000.5), txt("0")], // already numeric
    ]);
    const res = computeGroupBySummary(mixed, boundsFor(mixed), SUM_OPTS);
    expect(res.skippedNonNumeric).toBe(1);
    expect(res.totalRowsAggregated).toBe(2);
    expect(res.rows[0].value).toBe(270000.5); // 135000 + 135000.5
  });

  it("does NOT coerce empty / whitespace text into 0", () => {
    const withBlanks = makeSheet([
      HEADER,
      [txt("98550"), txt("135000"), txt("0")],
      [txt("98550"), empty(), txt("0")], // empty -> skipped, not 0
      [txt("98550"), txt("   "), txt("0")], // whitespace -> skipped, not 0
    ]);
    const res = computeGroupBySummary(withBlanks, boundsFor(withBlanks), SUM_OPTS);
    expect(res.skippedNonNumeric).toBe(2);
    expect(res.totalRowsAggregated).toBe(1);
    expect(res.rows[0].value).toBe(135000);
  });
});

// ── Group 3: numericValue — thousand separators & decimals ───────────────
// Real xlsx exports store numbers as text WITH separators ("98,550").
// numericValue coerces these; currency / letters / parens are NOT coerced
// (they need explicit currency/locale config).
describe("numericValue: separators and decimals", () => {
  const cases: Array<[string, number | null]> = [
    ["98550", 98550],
    [" 135000", 135000], // leading space (xlsx text)
    ["98 550", 98550], // space as thousand separator
    ["98,550", 98550], // single comma, 3 digits -> thousand
    ["135,000", 135000],
    ["-36,450", -36450], // negative thousand
    ["1,234,567", 1234567], // multiple commas -> thousand
    ["1.234.567", 1234567], // multiple dots -> thousand (EU)
    ["1,234.56", 1234.56], // comma=thousand, dot=decimal (US)
    ["1.234,56", 1234.56], // dot=thousand, comma=decimal (EU)
    ["98.5", 98.5], // single dot, 1 digit -> decimal
    ["98,55", 98.55], // single comma, 2 digits -> decimal
    ["12.345", 12345], // AMBIGUOUS: 3 digits -> thousand (documented)
    // NOT coerced -> null (skipped):
    ["Rp98550", null], // currency prefix
    ["98550%", null], // suffix
    ["(36,450)", null], // accounting negative
    ["N/A", null],
    ["buyer_0", null],
    ["", null],
    ["   ", null],
    ["2026-03-02", null], // date-like
  ];
  for (const [input, expected] of cases) {
    it(`"${input}" -> ${expected}`, () => {
      expect(numericValue({ t: "Text", c: input })).toBe(expected);
    });
  }

  it("real numeric cell values pass through", () => {
    expect(numericValue({ t: "Integer", c: 135000 })).toBe(135000);
    expect(numericValue({ t: "Number", c: 98.5 })).toBe(98.5);
    expect(numericValue({ t: "Empty" })).toBeNull();
  });
});

// ── End-to-end: grouping aggregates comma-formatted text ─────────────────
describe("computeGroupBySummary aggregates comma-formatted text", () => {
  const sheet = makeSheet([
    HEADER,
    [txt("98,550"), txt("135,000"), txt("-36,450")],
    [txt("98,550"), txt("135,000"), txt("-36,450")],
    [txt("180,000"), txt("240,000"), txt("-60,000")],
  ]);
  it("SUM groups comma-thousand text correctly", () => {
    const res = computeGroupBySummary(sheet, boundsFor(sheet), SUM_OPTS);
    expect(res.skippedNonNumeric).toBe(0);
    expect(res.totalRowsAggregated).toBe(3);
    const byKey = Object.fromEntries(res.rows.map((r) => [r.keys[0], r.value]));
    expect(byKey["98,550"]).toBe(270000); // 135000 * 2
    expect(byKey["180,000"]).toBe(240000);
  });
});

// ── resolveFields ────────────────────────────────────────────────────────────

describe("resolveFields — marked header row", () => {
  const sheet = makeSheet([
    [txt("Region"), txt("Value")],
    [txt("APAC"), num("100")],
    [txt("EMEA"), num("200")],
  ]);
  const bounds: Bounds = { r1: 0, c1: 0, r2: 2, c2: 1 };

  it("markedHeaderRow inside bounds → uses row labels, excludeRow = markedRow", () => {
    const res = resolveFields(sheet, bounds, 0, false);
    expect(res.fromMarkedHeader).toBe(true);
    expect(res.fields.map((f) => f.label)).toEqual(["Region", "Value"]);
    expect(res.excludeRow).toBe(0); // inside bounds
  });

  it("markedHeaderRow outside bounds → fromMarkedHeader true, excludeRow = null", () => {
    // markedRow = 5 is outside bounds.r2 = 2
    const res = resolveFields(sheet, bounds, 5, false);
    expect(res.fromMarkedHeader).toBe(true);
    expect(res.excludeRow).toBeNull();
  });

  it("empty cell in header row falls back to columnLetter", () => {
    const sheetSparse = makeSheet([
      [txt("Region"), empty()], // col 1 is empty
      [txt("APAC"), num("100")],
    ]);
    const res = resolveFields(sheetSparse, { r1: 0, c1: 0, r2: 1, c2: 1 }, 0, false);
    expect(res.fields[1].label).toBe("B"); // fallback to columnLetter(1)
  });
});

describe("resolveFields — treatFirstRowAsHeader", () => {
  const sheet = makeSheet([
    [txt("Cat"), txt("Amount")],
    [txt("A"), num("10")],
  ]);
  const bounds: Bounds = { r1: 0, c1: 0, r2: 1, c2: 1 };

  it("no marked header + treatFirstRowAsHeader → uses first row, excludeRow = r1", () => {
    const res = resolveFields(sheet, bounds, null, true);
    expect(res.fromMarkedHeader).toBe(false);
    expect(res.fields.map((f) => f.label)).toEqual(["Cat", "Amount"]);
    expect(res.excludeRow).toBe(0);
  });
});

describe("resolveFields — no header", () => {
  const sheet = makeSheet([
    [txt("A"), num("10")],
    [txt("B"), num("20")],
  ]);
  const bounds: Bounds = { r1: 0, c1: 0, r2: 1, c2: 1 };

  it("no header at all → columnLetter labels, excludeRow = null", () => {
    const res = resolveFields(sheet, bounds, null, false);
    expect(res.fromMarkedHeader).toBe(false);
    expect(res.fields.map((f) => f.label)).toEqual(["A", "B"]);
    expect(res.excludeRow).toBeNull();
  });
});

// ── buildValueHeader ──────────────────────────────────────────────────────────

describe("buildValueHeader", () => {
  it("count -> 'COUNT' ignoring valueLabel", () => {
    expect(buildValueHeader("count", "Amount")).toBe("COUNT");
  });

  it("sum -> 'SUM(Amount)'", () => {
    expect(buildValueHeader("sum", "Amount")).toBe("SUM(Amount)");
  });

  it("avg -> 'AVG(Revenue)'", () => {
    expect(buildValueHeader("avg", "Revenue")).toBe("AVG(Revenue)");
  });

  it("min -> 'MIN(Price)'", () => {
    expect(buildValueHeader("min", "Price")).toBe("MIN(Price)");
  });

  it("max -> 'MAX(Score)'", () => {
    expect(buildValueHeader("max", "Score")).toBe("MAX(Score)");
  });
});

// ── computeGroupBySummary — tooLarge / empty categoryCols ────────────────────

describe("computeGroupBySummary — edge cases", () => {
  it("tooLarge: bounds exceeding STATS_CELL_CAP returns tooLarge=true", () => {
    // 1001 rows × 101 cols = 101,101 > 100,000
    const sheet = makeSheet(Array(1001).fill([]));
    const bounds: Bounds = { r1: 0, c1: 0, r2: 1000, c2: 100 };
    const res = computeGroupBySummary(sheet, bounds, {
      aggFn: "sum",
      valueCol: 0,
      categoryCols: [1],
      excludeRow: null,
    });
    expect(res.tooLarge).toBe(true);
    expect(res.rows).toHaveLength(0);
  });

  it("empty categoryCols → returns zeros, no rows", () => {
    const sheet = makeSheet([[num("1"), num("2")]]);
    const bounds: Bounds = { r1: 0, c1: 0, r2: 0, c2: 1 };
    const res = computeGroupBySummary(sheet, bounds, {
      aggFn: "sum",
      valueCol: 1,
      categoryCols: [],
      excludeRow: null,
    });
    expect(res.rows).toHaveLength(0);
    expect(res.tooLarge).toBe(false);
    expect(res.totalGroups).toBe(0);
  });

  it("categoryCols clamped to MAX_CATEGORY_FIELDS (6) when more provided", () => {
    // Provide 8 category columns; only first 6 should be used.
    const rowData = [num("1"), num("2"), num("3"), num("4"), num("5"), num("6"), num("7"), num("8"), num("9")];
    const sheet = makeSheet([rowData, rowData]);
    const bounds: Bounds = { r1: 0, c1: 0, r2: 1, c2: 8 };
    const res = computeGroupBySummary(sheet, bounds, {
      aggFn: "sum",
      valueCol: 8,
      categoryCols: [0, 1, 2, 3, 4, 5, 6, 7], // 8 cols, only 6 used
      excludeRow: null,
    });
    // Should not throw and should produce results with at most 6-level grouping
    expect(res.tooLarge).toBe(false);
    // Each row key tuple is at most 6 elements
    for (const row of res.rows) {
      expect(row.keys.length).toBeLessThanOrEqual(6);
    }
  });

  it("empty sheet (no data rows after excludeRow) → zero aggregated rows", () => {
    const sheet = makeSheet([[txt("Header"), txt("Value")]]);
    const bounds: Bounds = { r1: 0, c1: 0, r2: 0, c2: 1 };
    const res = computeGroupBySummary(sheet, bounds, {
      aggFn: "sum",
      valueCol: 1,
      categoryCols: [0],
      excludeRow: 0,
    });
    expect(res.rows).toHaveLength(0);
    expect(res.totalRowsAggregated).toBe(0);
  });

  it("truncated: more than MAX_GROUP_ROWS groups triggers truncated=true", () => {
    // Create MAX_GROUP_ROWS+1 unique category keys, each with a numeric value
    const rows: CellModel[][] = Array.from({ length: MAX_GROUP_ROWS + 1 }, (_, i) => [
      txt(`key${i}`),
      num(`${i + 1}`),
    ]);
    const sheet = makeSheet(rows);
    const bounds: Bounds = { r1: 0, c1: 0, r2: rows.length - 1, c2: 1 };
    const res = computeGroupBySummary(sheet, bounds, {
      aggFn: "sum",
      valueCol: 1,
      categoryCols: [0],
      excludeRow: null,
    });
    expect(res.truncated).toBe(true);
    expect(res.totalGroups).toBe(MAX_GROUP_ROWS + 1);
    expect(res.rows.length).toBe(MAX_GROUP_ROWS);
  });

  it("blank category key → display shown as '(blank)'", () => {
    const sheet = makeSheet([
      [empty(), num("100")],
      [txt(""), num("200")],
    ]);
    const bounds: Bounds = { r1: 0, c1: 0, r2: 1, c2: 1 };
    const res = computeGroupBySummary(sheet, bounds, {
      aggFn: "sum",
      valueCol: 1,
      categoryCols: [0],
      excludeRow: null,
    });
    expect(res.rows).toHaveLength(1); // both map to same key ""
    expect(res.rows[0].displays[0]).toBe("(blank)");
  });

  it("count: skips rows where valueCol is empty", () => {
    const sheet = makeSheet([
      [txt("A"), num("10")],
      [txt("A"), empty()], // empty value skipped in count
      [txt("A"), txt("x")], // non-empty text counts
    ]);
    const bounds: Bounds = { r1: 0, c1: 0, r2: 2, c2: 1 };
    const res = computeGroupBySummary(sheet, bounds, {
      aggFn: "count",
      valueCol: 1,
      categoryCols: [0],
      excludeRow: null,
    });
    expect(res.totalRowsAggregated).toBe(2);
    expect(res.rows[0].value).toBe(2); // count returns acc.count
  });

  it("min/max with single group: min picks minimum, max picks maximum", () => {
    const sheet = makeSheet([
      [txt("G"), num("50")],
      [txt("G"), num("10")],
      [txt("G"), num("90")],
    ]);
    const bounds: Bounds = { r1: 0, c1: 0, r2: 2, c2: 1 };
    const minRes = computeGroupBySummary(sheet, bounds, {
      aggFn: "min", valueCol: 1, categoryCols: [0], excludeRow: null,
    });
    const maxRes = computeGroupBySummary(sheet, bounds, {
      aggFn: "max", valueCol: 1, categoryCols: [0], excludeRow: null,
    });
    expect(minRes.rows[0].value).toBe(10);
    expect(maxRes.rows[0].value).toBe(90);
  });

  it("avg: averages correctly within a group", () => {
    const sheet = makeSheet([
      [txt("G"), num("20")],
      [txt("G"), num("40")],
      [txt("G"), num("60")],
    ]);
    const bounds: Bounds = { r1: 0, c1: 0, r2: 2, c2: 1 };
    const res = computeGroupBySummary(sheet, bounds, {
      aggFn: "avg", valueCol: 1, categoryCols: [0], excludeRow: null,
    });
    expect(res.rows[0].value).toBe(40); // (20+40+60)/3
  });
});

// ── Multi-level grouping & subtotals ─────────────────────────────────────────

describe("computeGroupBySummary — multi-level grouping", () => {
  // Region (col 0), Country (col 1), Revenue (col 2)
  const sheet = makeSheet([
    [txt("APAC"), txt("SG"), num("100")],
    [txt("APAC"), txt("ID"), num("200")],
    [txt("APAC"), txt("SG"), num("150")],
    [txt("EMEA"), txt("DE"), num("300")],
    [txt("EMEA"), txt("FR"), num("400")],
  ]);
  const bounds: Bounds = { r1: 0, c1: 0, r2: 4, c2: 2 };

  const MULTI_OPTS: GroupByOpts = {
    aggFn: "sum",
    valueCol: 2,
    categoryCols: [0, 1],
    excludeRow: null,
  };

  it("multi-level sum groups correctly without subtotals", () => {
    const res = computeGroupBySummary(sheet, bounds, MULTI_OPTS);
    expect(res.tooLarge).toBe(false);
    expect(res.totalGroups).toBe(4); // APAC/SG, APAC/ID, EMEA/DE, EMEA/FR
    // Each row has 2 keys
    for (const row of res.rows) {
      expect(row.keys).toHaveLength(2);
    }
    // Check APAC/SG sums correctly
    const apacSg = res.rows.find((r) => r.keys[0] === "APAC" && r.keys[1] === "SG");
    expect(apacSg?.value).toBe(250); // 100 + 150
  });

  it("multi-level with subtotals inserts subtotal rows", () => {
    const res = computeGroupBySummary(sheet, bounds, { ...MULTI_OPTS, includeSubtotals: true });
    // Should have leaf rows + 2 subtotal rows (one per top-level group: APAC, EMEA)
    expect(res.rows.length).toBeGreaterThan(res.totalGroups);
    const subtotals = res.rows.filter((r) => r.subtotalDepth !== undefined);
    expect(subtotals.length).toBeGreaterThan(0);
  });

  it("subtotal row has subtotalDepth=0 for top-level grouping in 2-level setup", () => {
    const res = computeGroupBySummary(sheet, bounds, { ...MULTI_OPTS, includeSubtotals: true });
    const subtotals = res.rows.filter((r) => r.subtotalDepth !== undefined);
    for (const st of subtotals) {
      expect(st.subtotalDepth).toBe(0); // only one parent level for 2-col grouping
    }
  });

  it("subtotal row APAC sums all APAC leaves", () => {
    const res = computeGroupBySummary(sheet, bounds, { ...MULTI_OPTS, includeSubtotals: true });
    const apacSubtotal = res.rows.find((r) => r.subtotalDepth === 0 && r.keys[0] === "APAC");
    expect(apacSubtotal).toBeDefined();
    expect(apacSubtotal!.value).toBe(450); // 100+150+200
  });

  it("multi-level with subtotals but categoryCols.length===1 → no subtotals inserted", () => {
    const singleCatOpts: GroupByOpts = {
      aggFn: "sum",
      valueCol: 2,
      categoryCols: [0],
      excludeRow: null,
      includeSubtotals: true,
    };
    const res = computeGroupBySummary(sheet, bounds, singleCatOpts);
    // single category → subtotals not applied even with includeSubtotals=true
    const subtotals = res.rows.filter((r) => r.subtotalDepth !== undefined);
    expect(subtotals).toHaveLength(0);
  });

  it("depth-first sort: same-region rows are contiguous (grouped together)", () => {
    const res = computeGroupBySummary(sheet, bounds, MULTI_OPTS);
    const regions = res.rows.map((r) => r.keys[0]);
    // All rows sharing a top-level key must be contiguous.
    // Find contiguous spans for each key.
    const firstApac = regions.indexOf("APAC");
    const lastApac = regions.lastIndexOf("APAC");
    const firstEmea = regions.indexOf("EMEA");
    const lastEmea = regions.lastIndexOf("EMEA");
    // APAC rows form a contiguous block
    for (let i = firstApac; i <= lastApac; i++) {
      expect(regions[i]).toBe("APAC");
    }
    // EMEA rows form a contiguous block
    for (let i = firstEmea; i <= lastEmea; i++) {
      expect(regions[i]).toBe("EMEA");
    }
    // No interleaving: the two spans don't overlap
    expect(lastApac < firstEmea || lastEmea < firstApac).toBe(true);
  });

  it("multi-level avg rollup uses weighted average across leaves", () => {
    const res = computeGroupBySummary(sheet, bounds, {
      ...MULTI_OPTS,
      aggFn: "avg",
      includeSubtotals: true,
    });
    const apacSubtotal = res.rows.find((r) => r.subtotalDepth === 0 && r.keys[0] === "APAC");
    expect(apacSubtotal).toBeDefined();
    // APAC: 3 rows summing to 450, so weighted avg = 450/3 = 150
    expect(apacSubtotal!.value).toBe(150);
  });

  it("multi-level min rollup picks minimum of leaf values", () => {
    const res = computeGroupBySummary(sheet, bounds, {
      ...MULTI_OPTS,
      aggFn: "min",
      includeSubtotals: true,
    });
    const apacSubtotal = res.rows.find((r) => r.subtotalDepth === 0 && r.keys[0] === "APAC");
    // APAC leaf values: SG=250 (summed), ID=200. But with min, leaves are min of their own rows.
    // Actually in multi-level: APAC/SG leaf value = min(100,150)=100; APAC/ID leaf=200.
    // Subtotal min = min(100, 200) = 100.
    expect(apacSubtotal!.value).toBe(100);
  });

  it("multi-level max rollup picks maximum of leaf values", () => {
    const res = computeGroupBySummary(sheet, bounds, {
      ...MULTI_OPTS,
      aggFn: "max",
      includeSubtotals: true,
    });
    const emeaSubtotal = res.rows.find((r) => r.subtotalDepth === 0 && r.keys[0] === "EMEA");
    // EMEA/DE=300, EMEA/FR=400. Max subtotal = 400.
    expect(emeaSubtotal!.value).toBe(400);
  });

  it("multi-level count rollup sums counts", () => {
    const res = computeGroupBySummary(sheet, bounds, {
      ...MULTI_OPTS,
      aggFn: "count",
      includeSubtotals: true,
    });
    const apacSubtotal = res.rows.find((r) => r.subtotalDepth === 0 && r.keys[0] === "APAC");
    // APAC has 3 data rows
    expect(apacSubtotal!.count).toBe(3);
  });
});

// ── 3-level grouping (depthFirstSortNext multi-level) ────────────────────────

describe("computeGroupBySummary — 3-level grouping with subtotals", () => {
  // Region, Country, City, Revenue
  const sheet = makeSheet([
    [txt("APAC"), txt("SG"), txt("Downtown"), num("100")],
    [txt("APAC"), txt("SG"), txt("Uptown"), num("50")],
    [txt("APAC"), txt("ID"), txt("Jakarta"), num("200")],
    [txt("EMEA"), txt("DE"), txt("Berlin"), num("300")],
    [txt("EMEA"), txt("DE"), txt("Munich"), num("150")],
    [txt("EMEA"), txt("FR"), txt("Paris"), num("400")],
  ]);
  const bounds: Bounds = { r1: 0, c1: 0, r2: 5, c2: 3 };

  const THREE_LEVEL_OPTS: GroupByOpts = {
    aggFn: "sum",
    valueCol: 3,
    categoryCols: [0, 1, 2],
    excludeRow: null,
    includeSubtotals: true,
  };

  it("produces leaf rows plus subtotals at depth 0 and 1", () => {
    const res = computeGroupBySummary(sheet, bounds, THREE_LEVEL_OPTS);
    expect(res.totalGroups).toBe(6); // 6 unique leaf combinations
    const depth0 = res.rows.filter((r) => r.subtotalDepth === 0);
    const depth1 = res.rows.filter((r) => r.subtotalDepth === 1);
    expect(depth0.length).toBeGreaterThan(0); // region-level subtotals
    expect(depth1.length).toBeGreaterThan(0); // country-level subtotals
  });

  it("EMEA/DE subtotal sums Berlin+Munich = 450", () => {
    const res = computeGroupBySummary(sheet, bounds, THREE_LEVEL_OPTS);
    const deSub = res.rows.find(
      (r) => r.subtotalDepth === 1 && r.keys[0] === "EMEA" && r.keys[1] === "DE",
    );
    expect(deSub).toBeDefined();
    expect(deSub!.value).toBe(450);
  });

  it("EMEA subtotal sums all EMEA rows = 850", () => {
    const res = computeGroupBySummary(sheet, bounds, THREE_LEVEL_OPTS);
    const emeaSub = res.rows.find((r) => r.subtotalDepth === 0 && r.keys[0] === "EMEA");
    expect(emeaSub).toBeDefined();
    expect(emeaSub!.value).toBe(850);
  });

  it("subtotal display label has SUBTOTAL_LABEL_SUFFIX appended at subtotalDepth", () => {
    const res = computeGroupBySummary(sheet, bounds, THREE_LEVEL_OPTS);
    // The formatting applies " total" suffix in displaysForOutput called by formatGroupByMarkdown
    const md = formatGroupByMarkdown(res, ["Region", "Country", "City"], "SUM(Revenue)");
    expect(md).toContain(SUBTOTAL_LABEL_SUFFIX);
  });
});

// ── formatGroupByMarkdown ─────────────────────────────────────────────────────

describe("formatGroupByMarkdown", () => {
  it("produces header, separator, and body rows in pipe-table format", () => {
    const result: GroupByResult = {
      rows: [
        { keys: ["APAC"], displays: ["APAC"], value: 450, count: 3 },
        { keys: ["EMEA"], displays: ["EMEA"], value: 700, count: 2 },
      ],
      skippedNonNumeric: 0,
      skippedNoCategory: 0,
      tooLarge: false,
      truncated: false,
      totalGroups: 2,
      totalRowsAggregated: 5,
    };
    const md = formatGroupByMarkdown(result, ["Region"], "SUM(Revenue)");
    const lines = md.split("\n");
    expect(lines[0]).toContain("Region");
    expect(lines[0]).toContain("SUM(Revenue)");
    expect(lines[1]).toBe("| --- | --- |");
    expect(lines[2]).toContain("APAC");
    expect(lines[3]).toContain("EMEA");
  });

  it("escapes pipe characters in cell values", () => {
    const result: GroupByResult = {
      rows: [{ keys: ["A|B"], displays: ["A|B"], value: 10, count: 1 }],
      skippedNonNumeric: 0, skippedNoCategory: 0, tooLarge: false,
      truncated: false, totalGroups: 1, totalRowsAggregated: 1,
    };
    const md = formatGroupByMarkdown(result, ["Cat"], "SUM(V)");
    expect(md).toContain("A\\|B");
  });

  it("escapes newlines in header values", () => {
    const result: GroupByResult = {
      rows: [{ keys: ["X"], displays: ["X"], value: 5, count: 1 }],
      skippedNonNumeric: 0, skippedNoCategory: 0, tooLarge: false,
      truncated: false, totalGroups: 1, totalRowsAggregated: 1,
    };
    const md = formatGroupByMarkdown(result, ["Cat\nHeader"], "SUM(V)");
    expect(md).not.toContain("\n\n"); // newline in header escaped to space
    expect(md.split("\n")[0]).not.toMatch(/Cat\n/);
  });

  it("subtotal row gets SUBTOTAL_LABEL_SUFFIX in display", () => {
    const result: GroupByResult = {
      rows: [
        { keys: ["APAC", "SG"], displays: ["APAC", "SG"], value: 250, count: 2 },
        { keys: ["APAC", ""], displays: ["APAC", ""], value: 250, count: 2, subtotalDepth: 0 },
      ],
      skippedNonNumeric: 0, skippedNoCategory: 0, tooLarge: false,
      truncated: false, totalGroups: 1, totalRowsAggregated: 2,
    };
    const md = formatGroupByMarkdown(result, ["Region", "Country"], "SUM(V)");
    expect(md).toContain("APAC" + SUBTOTAL_LABEL_SUFFIX);
  });

  it("empty rows -> only header and separator lines", () => {
    const result: GroupByResult = {
      rows: [],
      skippedNonNumeric: 0, skippedNoCategory: 0, tooLarge: false,
      truncated: false, totalGroups: 0, totalRowsAggregated: 0,
    };
    const md = formatGroupByMarkdown(result, ["Cat"], "COUNT");
    const lines = md.split("\n");
    expect(lines).toHaveLength(2); // only header + separator
  });
});

// ── formatGroupByTSV ──────────────────────────────────────────────────────────

describe("formatGroupByTSV", () => {
  it("produces tab-separated header and body rows", () => {
    const result: GroupByResult = {
      rows: [
        { keys: ["APAC"], displays: ["APAC"], value: 450, count: 3 },
      ],
      skippedNonNumeric: 0, skippedNoCategory: 0, tooLarge: false,
      truncated: false, totalGroups: 1, totalRowsAggregated: 3,
    };
    const tsv = formatGroupByTSV(result, ["Region"], "SUM(Revenue)");
    const lines = tsv.split("\n");
    expect(lines[0]).toBe("Region\tSUM(Revenue)");
    expect(lines[1]).toContain("APAC");
  });

  it("replaces tab characters in cell values with space", () => {
    const result: GroupByResult = {
      rows: [{ keys: ["A\tB"], displays: ["A\tB"], value: 10, count: 1 }],
      skippedNonNumeric: 0, skippedNoCategory: 0, tooLarge: false,
      truncated: false, totalGroups: 1, totalRowsAggregated: 1,
    };
    const tsv = formatGroupByTSV(result, ["Cat"], "SUM(V)");
    // Tab in value replaced with space
    const dataLine = tsv.split("\n")[1];
    expect(dataLine).not.toContain("A\tB");
    expect(dataLine).toContain("A B");
  });

  it("replaces newlines in cell values with space", () => {
    const result: GroupByResult = {
      rows: [{ keys: ["X\nY"], displays: ["X\nY"], value: 5, count: 1 }],
      skippedNonNumeric: 0, skippedNoCategory: 0, tooLarge: false,
      truncated: false, totalGroups: 1, totalRowsAggregated: 1,
    };
    const tsv = formatGroupByTSV(result, ["Cat"], "SUM(V)");
    const lines = tsv.split("\n");
    // Should only be 2 lines: header + one data row (newline in value replaced with space)
    expect(lines).toHaveLength(2);
  });

  it("subtotal row gets suffix in TSV output", () => {
    const result: GroupByResult = {
      rows: [
        { keys: ["APAC", "SG"], displays: ["APAC", "SG"], value: 250, count: 2 },
        { keys: ["APAC", ""], displays: ["APAC", ""], value: 250, count: 2, subtotalDepth: 0 },
      ],
      skippedNonNumeric: 0, skippedNoCategory: 0, tooLarge: false,
      truncated: false, totalGroups: 1, totalRowsAggregated: 2,
    };
    const tsv = formatGroupByTSV(result, ["Region", "Country"], "SUM(V)");
    expect(tsv).toContain("APAC" + SUBTOTAL_LABEL_SUFFIX);
  });
});

// ── depthFirstSort tiebreak (equal value → localeCompare) ────────────────────

describe("computeGroupBySummary — depth-first sort tiebreak on equal values", () => {
  it("single-cat: groups with equal sum are sorted alphabetically by key", () => {
    // Two groups with same sum -> alphabetical tiebreak
    const sheet = makeSheet([
      [txt("Beta"), num("100")],
      [txt("Alpha"), num("100")],
    ]);
    const bounds: Bounds = { r1: 0, c1: 0, r2: 1, c2: 1 };
    const res = computeGroupBySummary(sheet, bounds, {
      aggFn: "sum", valueCol: 1, categoryCols: [0], excludeRow: null,
    });
    // Alpha < Beta lexicographically, so Alpha comes first when values are tied
    expect(res.rows[0].keys[0]).toBe("Alpha");
    expect(res.rows[1].keys[0]).toBe("Beta");
  });

  it("multi-cat: top-level groups with equal rollup sort alphabetically (depthFirstSort tiebreak)", () => {
    // Region BETA and ALPHA each have total 100
    const sheet = makeSheet([
      [txt("BETA"), txt("X"), num("100")],
      [txt("ALPHA"), txt("X"), num("100")],
    ]);
    const bounds: Bounds = { r1: 0, c1: 0, r2: 1, c2: 2 };
    const res = computeGroupBySummary(sheet, bounds, {
      aggFn: "sum", valueCol: 2, categoryCols: [0, 1], excludeRow: null,
    });
    // ALPHA < BETA alphabetically, both equal value -> ALPHA first
    expect(res.rows[0].keys[0]).toBe("ALPHA");
    expect(res.rows[1].keys[0]).toBe("BETA");
  });

  it("3-level: mid-level groups with equal rollup sort alphabetically (depthFirstSortNext tiebreak)", () => {
    // Region APAC, Country ZZ and AA both have total 50 -> AA comes first
    const sheet = makeSheet([
      [txt("APAC"), txt("ZZ"), txt("city1"), num("50")],
      [txt("APAC"), txt("AA"), txt("city2"), num("50")],
    ]);
    const bounds: Bounds = { r1: 0, c1: 0, r2: 1, c2: 3 };
    const res = computeGroupBySummary(sheet, bounds, {
      aggFn: "sum", valueCol: 3, categoryCols: [0, 1, 2], excludeRow: null,
    });
    // Both have value 50; AA < ZZ -> AA row first
    const countryOrder = res.rows.map((r) => r.keys[1]);
    expect(countryOrder.indexOf("AA")).toBeLessThan(countryOrder.indexOf("ZZ"));
  });
});

// ── rollupValue edge cases ────────────────────────────────────────────────────
// These are exercised indirectly through computeGroupBySummary with subtotals.

describe("rollupValue edge cases (via subtotals)", () => {
  it("min subtotal with zero leaves in group returns 0 (via single-group case)", () => {
    // A single leaf with no other siblings — its subtotal should equal its own value
    const sheet = makeSheet([
      [txt("APAC"), txt("SG"), num("100")],
    ]);
    const bounds: Bounds = { r1: 0, c1: 0, r2: 0, c2: 2 };
    // With 2 categories, subtotal will be inserted
    const res = computeGroupBySummary(sheet, bounds, {
      aggFn: "min",
      valueCol: 2,
      categoryCols: [0, 1],
      excludeRow: null,
      includeSubtotals: true,
    });
    const subtotal = res.rows.find((r) => r.subtotalDepth !== undefined);
    expect(subtotal!.value).toBe(100);
  });

  it("max subtotal: single leaf case propagates correctly", () => {
    const sheet = makeSheet([
      [txt("EMEA"), txt("FR"), num("400")],
    ]);
    const bounds: Bounds = { r1: 0, c1: 0, r2: 0, c2: 2 };
    const res = computeGroupBySummary(sheet, bounds, {
      aggFn: "max",
      valueCol: 2,
      categoryCols: [0, 1],
      excludeRow: null,
      includeSubtotals: true,
    });
    const subtotal = res.rows.find((r) => r.subtotalDepth !== undefined);
    expect(subtotal!.value).toBe(400);
  });
});
