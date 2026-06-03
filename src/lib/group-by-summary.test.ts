import { describe, it, expect } from "vitest";
import { computeGroupBySummary, type GroupByOpts } from "./group-by-summary";
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
