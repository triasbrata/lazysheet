import { describe, it, expect } from "vitest";
import {
  conditionMatches,
  buildMergedRowSet,
  headerGroups,
  groupMatches,
  rowPasses,
  hasActiveFilters,
  computeVisibleRows,
  columnDistinctValues,
  type HeaderGroup,
  type ColumnFilter,
  type ConditionOp,
} from "./grid-filter";
import { buildMergeInfo } from "@/components/Grid/grid-utils";
import type { SheetModel, CellModel, MergeRange } from "@/lib/types";

// ── Fixtures ────────────────────────────────────────────────────────────
// NOTE: MergeRange is 1-INDEXED (backend convention; see grid-utils
// expandBoundsForMerges "Anchors are keyed 1-indexed"). sheet.rows, headerRow,
// and column indices are 0-indexed. These fixtures use 1-indexed merges on
// purpose to guard the boundary conversion inside grid-filter.
function cell(text: string): CellModel {
  return { v: { t: "Text", c: text } };
}

function makeSheet(grid: string[][], merges: MergeRange[] = []): SheetModel {
  const rows: CellModel[][] = grid.map((r) => r.map((t) => cell(t)));
  const maxCols = Math.max(0, ...grid.map((r) => r.length));
  return {
    name: "Sheet1",
    rows,
    merges,
    col_widths: Array(maxCols).fill(100),
    row_heights: Array(grid.length).fill(20),
    frozen_rows: 0,
    frozen_cols: 0,
    max_col: maxCols,
  };
}

// Helper to build a ColumnFilter using the new structured model
const cf = (op: ConditionOp, operand = "", excluded: string[] = []): ColumnFilter => ({
  condition: { op, operand },
  excluded,
});

// ── conditionMatches ─────────────────────────────────────────────────────
describe("conditionMatches", () => {
  it("none always returns true", () => {
    expect(conditionMatches("anything", { op: "none", operand: "" })).toBe(true);
    expect(conditionMatches("", { op: "none", operand: "" })).toBe(true);
  });

  it("empty: matches blank/whitespace-only strings", () => {
    expect(conditionMatches("", { op: "empty", operand: "" })).toBe(true);
    expect(conditionMatches("   ", { op: "empty", operand: "" })).toBe(true);
    expect(conditionMatches("a", { op: "empty", operand: "" })).toBe(false);
  });

  it("notEmpty: matches non-blank strings", () => {
    expect(conditionMatches("hello", { op: "notEmpty", operand: "" })).toBe(true);
    expect(conditionMatches("", { op: "notEmpty", operand: "" })).toBe(false);
    expect(conditionMatches("  ", { op: "notEmpty", operand: "" })).toBe(false);
  });

  it("contains: case-insensitive substring match", () => {
    expect(conditionMatches("Hello World", { op: "contains", operand: "world" })).toBe(true);
    expect(conditionMatches("Hello", { op: "contains", operand: "xyz" })).toBe(false);
    expect(conditionMatches("PARIS", { op: "contains", operand: "ari" })).toBe(true);
  });

  it("notContains: case-insensitive negated substring match", () => {
    expect(conditionMatches("Hello World", { op: "notContains", operand: "world" })).toBe(false);
    expect(conditionMatches("Hello", { op: "notContains", operand: "xyz" })).toBe(true);
  });

  it("startsWith: case-insensitive prefix match", () => {
    expect(conditionMatches("Paris", { op: "startsWith", operand: "Pa" })).toBe(true);
    expect(conditionMatches("Paris", { op: "startsWith", operand: "pa" })).toBe(true);
    expect(conditionMatches("Paris", { op: "startsWith", operand: "ris" })).toBe(false);
  });

  it("endsWith: case-insensitive suffix match", () => {
    expect(conditionMatches("Paris", { op: "endsWith", operand: "RIS" })).toBe(true);
    expect(conditionMatches("Paris", { op: "endsWith", operand: "Par" })).toBe(false);
  });

  it("isExactly: case-insensitive exact equality", () => {
    expect(conditionMatches("Paris", { op: "isExactly", operand: "paris" })).toBe(true);
    expect(conditionMatches("Paris", { op: "isExactly", operand: "PARIS" })).toBe(true);
    expect(conditionMatches("Paris", { op: "isExactly", operand: "Par" })).toBe(false);
  });

  it("eq: same as isExactly (case-insensitive exact equality)", () => {
    expect(conditionMatches("Paris", { op: "eq", operand: "paris" })).toBe(true);
    expect(conditionMatches("Paris", { op: "eq", operand: "PARIS" })).toBe(true);
    expect(conditionMatches("Paris", { op: "eq", operand: "Lyon" })).toBe(false);
  });

  it("neq: case-insensitive inequality", () => {
    expect(conditionMatches("Paris", { op: "neq", operand: "paris" })).toBe(false);
    expect(conditionMatches("Paris", { op: "neq", operand: "Lyon" })).toBe(true);
  });

  it("gt: numeric when both sides are numbers", () => {
    expect(conditionMatches("250", { op: "gt", operand: "100" })).toBe(true);
    expect(conditionMatches("50", { op: "gt", operand: "100" })).toBe(false);
    expect(conditionMatches("100", { op: "gt", operand: "100" })).toBe(false);
  });

  it("gt: string fallback when non-numeric", () => {
    expect(conditionMatches("banana", { op: "gt", operand: "apple" })).toBe(true);
    expect(conditionMatches("apple", { op: "gt", operand: "banana" })).toBe(false);
  });

  it("gte: numeric and boundary", () => {
    expect(conditionMatches("100", { op: "gte", operand: "100" })).toBe(true);
    expect(conditionMatches("101", { op: "gte", operand: "100" })).toBe(true);
    expect(conditionMatches("99", { op: "gte", operand: "100" })).toBe(false);
  });

  it("lt: numeric comparison", () => {
    expect(conditionMatches("99", { op: "lt", operand: "100" })).toBe(true);
    expect(conditionMatches("100", { op: "lt", operand: "100" })).toBe(false);
    expect(conditionMatches("101", { op: "lt", operand: "100" })).toBe(false);
  });

  it("lte: numeric and boundary", () => {
    expect(conditionMatches("100", { op: "lte", operand: "100" })).toBe(true);
    expect(conditionMatches("99", { op: "lte", operand: "100" })).toBe(true);
    expect(conditionMatches("101", { op: "lte", operand: "100" })).toBe(false);
  });

  it("empty cell never matches numeric gt/gte/lt/lte", () => {
    expect(conditionMatches("", { op: "gt", operand: "5" })).toBe(false);
    expect(conditionMatches("", { op: "gt", operand: "-1" })).toBe(false);
    expect(conditionMatches("", { op: "gte", operand: "0" })).toBe(false);
    expect(conditionMatches("", { op: "lt", operand: "100" })).toBe(false);
    expect(conditionMatches("", { op: "lte", operand: "100" })).toBe(false);
  });
});

// ── buildMergedRowSet (1-indexed input → 0-indexed output) ──────────────
describe("buildMergedRowSet", () => {
  it("adds all rows in a vertical merge span (1-idx 5..6 → 0-idx 4..5)", () => {
    const set = buildMergedRowSet([{ r1: 5, c1: 1, r2: 6, c2: 1 }]);
    expect(set.has(4)).toBe(true);
    expect(set.has(5)).toBe(true);
    expect(set.has(3)).toBe(false);
  });
  it("skips 1x1 (non-)merges", () => {
    const set = buildMergedRowSet([{ r1: 3, c1: 3, r2: 3, c2: 3 }]);
    expect(set.size).toBe(0);
  });
  it("horizontal-only merge still marks the row (1-idx 3 → 0-idx 2)", () => {
    const set = buildMergedRowSet([{ r1: 3, c1: 2, r2: 3, c2: 4 }]);
    expect(set.has(2)).toBe(true);
    expect([...set]).toEqual([2]);
  });
  it("normalises inverted r1/r2 order", () => {
    const set = buildMergedRowSet([{ r1: 6, c1: 1, r2: 5, c2: 1 }]);
    expect(set.has(4)).toBe(true);
    expect(set.has(5)).toBe(true);
  });
});

// ── headerGroups (headerRow 0-indexed; merge keys 1-indexed) ────────────
describe("headerGroups", () => {
  it("all singletons when no merges", () => {
    const mi = buildMergeInfo([]);
    const groups = headerGroups(mi, 0, 3);
    expect(groups).toEqual([
      { anchorCol: 0, cols: [0] },
      { anchorCol: 1, cols: [1] },
      { anchorCol: 2, cols: [2] },
    ]);
  });
  it("groups a horizontal header merge", () => {
    // headerRow 0 (0-idx) → 1-idx row 1. Merge cols 1..3 (1-idx) → 0-idx 0..2.
    const mi = buildMergeInfo([{ r1: 1, c1: 1, r2: 1, c2: 3 }]);
    const groups = headerGroups(mi, 0, 3);
    expect(groups).toEqual([{ anchorCol: 0, cols: [0, 1, 2] }]);
  });
  it("merged-into-data col is now a filterable singleton", () => {
    // vertical merge {r1:5,c1:2,r2:6,c2:2} (1-indexed) → 0-idx col 1, rows 4-5
    const mi = buildMergeInfo([{ r1: 5, c1: 2, r2: 6, c2: 2 }]);
    const groups = headerGroups(mi, 2, 4);
    // every column 0..3 present as a singleton (none dropped)
    expect(groups).toEqual([
      { anchorCol: 0, cols: [0] },
      { anchorCol: 1, cols: [1] },
      { anchorCol: 2, cols: [2] },
      { anchorCol: 3, cols: [3] },
    ]);
  });
});

// ── groupMatches ────────────────────────────────────────────────────────
describe("groupMatches", () => {
  const sheet = makeSheet([
    ["John", "Paris", "100"],
    ["Jane", "Lyon", "200"],
  ]);
  it("matches if any col in group matches", () => {
    const group: HeaderGroup = { anchorCol: 0, cols: [0, 1] };
    expect(
      groupMatches(sheet, 0, group, { op: "contains", operand: "paris" }),
    ).toBe(true);
  });
  it("no match when none match", () => {
    const group: HeaderGroup = { anchorCol: 0, cols: [0, 1] };
    expect(
      groupMatches(sheet, 0, group, { op: "contains", operand: "xyz" }),
    ).toBe(false);
  });
});

// ── rowPasses ───────────────────────────────────────────────────────────
describe("rowPasses", () => {
  const sheet = makeSheet([
    ["John", "Paris", "100"],
    ["Jane", "Lyon", "200"],
  ]);

  it("ANDs multiple active condition filters", () => {
    const groups: HeaderGroup[] = [
      { anchorCol: 0, cols: [0] },
      { anchorCol: 2, cols: [2] },
    ];
    const filters = {
      0: cf("startsWith", "Jo"),
      2: cf("gt", "50"),
    };
    expect(rowPasses(sheet, 0, groups, filters)).toBe(true);
  });

  it("fails when one condition filter fails", () => {
    const groups: HeaderGroup[] = [
      { anchorCol: 0, cols: [0] },
      { anchorCol: 2, cols: [2] },
    ];
    const filters = {
      0: cf("startsWith", "Jo"),
      2: cf("gt", "500"),
    };
    expect(rowPasses(sheet, 0, groups, filters)).toBe(false);
  });

  it("checklist exclusion: row hidden when its value is excluded", () => {
    const groups: HeaderGroup[] = [{ anchorCol: 0, cols: [0] }];
    // exclude "John" → row 0 should not pass
    const filters = { 0: cf("none", "", ["John"]) };
    expect(rowPasses(sheet, 0, groups, filters)).toBe(false);
    // row 1 has "Jane" which is not excluded → passes
    expect(rowPasses(sheet, 1, groups, filters)).toBe(true);
  });

  it("checklist exclusion passes when value not excluded", () => {
    const groups: HeaderGroup[] = [{ anchorCol: 0, cols: [0] }];
    const filters = { 0: cf("none", "", ["Jane"]) };
    expect(rowPasses(sheet, 0, groups, filters)).toBe(true);
  });

  it("condition AND checklist: row must pass both", () => {
    // row 0: John, Paris, 100 — startsWith "Jo" passes condition, but exclude "John" → fails checklist
    const groups: HeaderGroup[] = [{ anchorCol: 0, cols: [0] }];
    const filters = { 0: cf("startsWith", "Jo", ["John"]) };
    expect(rowPasses(sheet, 0, groups, filters)).toBe(false);
  });

  it("condition AND checklist: passes when both satisfied", () => {
    // row 1: Jane, Lyon, 200 — startsWith "Ja" matches condition, "Jane" NOT in excluded ["John"] → passes
    const groups: HeaderGroup[] = [{ anchorCol: 0, cols: [0] }];
    const filters = { 0: cf("startsWith", "Ja", ["John"]) };
    expect(rowPasses(sheet, 1, groups, filters)).toBe(true);
  });

  it("inactive filter (op=none, no exclusions) does not constrain row", () => {
    const groups: HeaderGroup[] = [{ anchorCol: 0, cols: [0] }];
    const filters = { 0: cf("none", "", []) };
    expect(rowPasses(sheet, 0, groups, filters)).toBe(true);
    expect(rowPasses(sheet, 1, groups, filters)).toBe(true);
  });

  it("missing filter for group means no constraint", () => {
    const groups: HeaderGroup[] = [
      { anchorCol: 0, cols: [0] },
      { anchorCol: 1, cols: [1] },
    ];
    // Only filter on col 0; col 1 has no filter → no constraint from col 1
    const filters = { 0: cf("startsWith", "Jo") };
    expect(rowPasses(sheet, 0, groups, filters)).toBe(true);
    expect(rowPasses(sheet, 1, groups, filters)).toBe(false);
  });
});

// ── hasActiveFilters ────────────────────────────────────────────────────
describe("hasActiveFilters", () => {
  it("false for undefined", () => {
    expect(hasActiveFilters(undefined)).toBe(false);
  });
  it("false for empty object", () => {
    expect(hasActiveFilters({})).toBe(false);
  });
  it("false when all filters have op=none and no exclusions", () => {
    expect(hasActiveFilters({ 0: cf("none"), 1: cf("none") })).toBe(false);
    expect(hasActiveFilters({ 0: cf("none", "", []) })).toBe(false);
  });
  it("true when any condition is active (op !== none)", () => {
    expect(hasActiveFilters({ 0: cf("contains", "x") })).toBe(true);
    expect(hasActiveFilters({ 0: cf("none"), 1: cf("startsWith", "abc") })).toBe(true);
  });
  it("true when any excluded list is non-empty", () => {
    expect(hasActiveFilters({ 0: cf("none", "", ["A"]) })).toBe(true);
  });
  it("true when both condition and excluded present", () => {
    expect(hasActiveFilters({ 0: cf("contains", "foo", ["bar"]) })).toBe(true);
  });
});

// ── computeVisibleRows ───────────────────────────────────────────────────
describe("computeVisibleRows", () => {
  it("returns all rows when no active filters (fast path)", () => {
    const sheet = makeSheet([["a"], ["b"], ["c"]]);
    expect(computeVisibleRows(sheet, new Set(), null, [], {}, 3)).toEqual([
      0, 1, 2,
    ]);
  });

  it("fast path: all filters inactive (op=none, no exclusions)", () => {
    const sheet = makeSheet([["Name"], ["John"], ["Jane"]]);
    const groups: HeaderGroup[] = [{ anchorCol: 0, cols: [0] }];
    expect(
      computeVisibleRows(sheet, new Set(), 0, groups, { 0: cf("none", "", []) }, 3),
    ).toEqual([0, 1, 2]);
  });

  it("keeps header region rows always", () => {
    const sheet = makeSheet([["Name"], ["John"], ["Jane"]]);
    const groups: HeaderGroup[] = [{ anchorCol: 0, cols: [0] }];
    const visible = computeVisibleRows(
      sheet,
      new Set(),
      0,
      groups,
      { 0: cf("contains", "zzz") },
      3,
    );
    expect(visible).toContain(0); // header always kept
  });

  it("keeps merged rows always", () => {
    const sheet = makeSheet([["Name"], ["John"], ["x"]]);
    const groups: HeaderGroup[] = [{ anchorCol: 0, cols: [0] }];
    const merged = new Set([2]); // 0-indexed row 2 is merged
    const visible = computeVisibleRows(
      sheet,
      merged,
      0,
      groups,
      { 0: cf("contains", "zzz") },
      3,
    );
    expect(visible).toContain(2); // merged row kept despite no match
  });

  it("drops unmerged rows that fail the condition filter", () => {
    const sheet = makeSheet([["Name"], ["John"], ["Jane"]]);
    const groups: HeaderGroup[] = [{ anchorCol: 0, cols: [0] }];
    const visible = computeVisibleRows(
      sheet,
      new Set(),
      0,
      groups,
      { 0: cf("contains", "john") },
      3,
    );
    expect(visible).toEqual([0, 1]); // header + John; Jane dropped
  });

  it("ANDs condition filters across columns", () => {
    const sheet = makeSheet([
      ["Name", "City"],
      ["John", "Paris"],
      ["John", "Lyon"],
    ]);
    const groups: HeaderGroup[] = [
      { anchorCol: 0, cols: [0] },
      { anchorCol: 1, cols: [1] },
    ];
    const visible = computeVisibleRows(
      sheet,
      new Set(),
      0,
      groups,
      { 0: cf("contains", "john"), 1: cf("contains", "paris") },
      3,
    );
    expect(visible).toEqual([0, 1]);
  });

  it("checklist exclusion hides unmerged rows with excluded value", () => {
    const sheet = makeSheet([
      ["Name"],
      ["Alice"],
      ["Bob"],
      ["Alice"],
    ]);
    const groups: HeaderGroup[] = [{ anchorCol: 0, cols: [0] }];
    // exclude "Alice" → rows 1 and 3 hidden; row 2 (Bob) kept; row 0 (header) kept
    const visible = computeVisibleRows(
      sheet,
      new Set(),
      0,
      groups,
      { 0: cf("none", "", ["Alice"]) },
      4,
    );
    expect(visible).toEqual([0, 2]);
  });

  it("checklist exclusion: header and merged rows kept even if value excluded", () => {
    const sheet = makeSheet([
      ["Name"],
      ["Alice"],
      ["Bob"],
    ]);
    const groups: HeaderGroup[] = [{ anchorCol: 0, cols: [0] }];
    const merged = new Set([2]); // row 2 is merged
    const visible = computeVisibleRows(
      sheet,
      merged,
      0,
      groups,
      { 0: cf("none", "", ["Bob"]) },
      3,
    );
    // header (0) always kept; merged row 2 always kept; row 1 (Alice) passes
    expect(visible).toContain(0);
    expect(visible).toContain(2);
    expect(visible).toContain(1);
  });

  it('(Blanks): excluded contains "" → rows with empty value hidden', () => {
    const sheet = makeSheet([
      ["Name"],
      ["Alice"],
      [""],
      ["Bob"],
    ]);
    const groups: HeaderGroup[] = [{ anchorCol: 0, cols: [0] }];
    const visible = computeVisibleRows(
      sheet,
      new Set(),
      0,
      groups,
      { 0: cf("none", "", [""]) },
      4,
    );
    // row 0 = header kept; row 1 (Alice) passes; row 2 (blank) excluded; row 3 (Bob) passes
    expect(visible).toEqual([0, 1, 3]);
  });

  it("condition + checklist AND: row must satisfy both", () => {
    const sheet = makeSheet([
      ["Name", "Score"],
      ["Alice", "90"],
      ["Bob", "80"],
      ["Alice", "70"],
    ]);
    const groups: HeaderGroup[] = [
      { anchorCol: 0, cols: [0] },
      { anchorCol: 1, cols: [1] },
    ];
    // condition: score > 75; checklist: exclude "Bob"
    const visible = computeVisibleRows(
      sheet,
      new Set(),
      0,
      groups,
      {
        0: cf("none", "", ["Bob"]),
        1: cf("gt", "75"),
      },
      4,
    );
    // row 0: header kept
    // row 1: Alice, 90 → not excluded, score>75 ✓ → kept
    // row 2: Bob, 80 → excluded by checklist → hidden
    // row 3: Alice, 70 → not excluded, but score 70 not >75 → hidden
    expect(visible).toEqual([0, 1]);
  });
});

// ── columnDistinctValues ─────────────────────────────────────────────────
describe("columnDistinctValues", () => {
  it("returns sorted distinct values with blanks first", () => {
    const sheet = makeSheet([
      ["Name"],
      ["Charlie"],
      ["Alice"],
      ["Bob"],
      ["Alice"],
      [""],
    ]);
    const group: HeaderGroup = { anchorCol: 0, cols: [0] };
    const result = columnDistinctValues(sheet, group, 0, 6, new Set());
    // blanks first, then case-insensitive alpha sort
    expect(result).toEqual(["", "Alice", "Bob", "Charlie"]);
  });

  it("skips header row (headerRow=0)", () => {
    const sheet = makeSheet([
      ["Name"],   // row 0 = header, "Name" must not appear
      ["Alpha"],
      ["Beta"],
    ]);
    const group: HeaderGroup = { anchorCol: 0, cols: [0] };
    const result = columnDistinctValues(sheet, group, 0, 3, new Set());
    expect(result).not.toContain("Name");
    expect(result).toEqual(["Alpha", "Beta"]);
  });

  it("skips merged rows", () => {
    const sheet = makeSheet([
      ["Name"],
      ["Alice"],
      ["MERGED_VALUE"],  // row 2 is merged — should be skipped
      ["Bob"],
    ]);
    const group: HeaderGroup = { anchorCol: 0, cols: [0] };
    const merged = new Set([2]); // 0-indexed row 2
    const result = columnDistinctValues(sheet, group, 0, 4, merged);
    expect(result).not.toContain("MERGED_VALUE");
    expect(result).toEqual(["Alice", "Bob"]);
  });

  it("no header (headerRow=null) — data starts from row 0", () => {
    const sheet = makeSheet([["Zebra"], ["Apple"], ["Mango"]]);
    const group: HeaderGroup = { anchorCol: 0, cols: [0] };
    const result = columnDistinctValues(sheet, group, null, 3, new Set());
    expect(result).toEqual(["Apple", "Mango", "Zebra"]);
  });

  it("merged header group with 2 surviving cols → union of distinct values", () => {
    const sheet = makeSheet([
      ["Header", "Header"],   // row 0 = header (merged)
      ["Alice", "Paris"],
      ["Bob", "Alice"],       // "Alice" appears in col 1 as well
      ["Charlie", "Lyon"],
    ]);
    // Group covering cols 0 and 1 (merged header)
    const group: HeaderGroup = { anchorCol: 0, cols: [0, 1] };
    const result = columnDistinctValues(sheet, group, 0, 4, new Set());
    // Union of col0: Alice, Bob, Charlie; col1: Paris, Alice, Lyon → deduplicated
    expect(result).toEqual(["Alice", "Bob", "Charlie", "Lyon", "Paris"]);
  });

  it("only blanks → returns ['']", () => {
    const sheet = makeSheet([["Name"], [""], [""]]);
    const group: HeaderGroup = { anchorCol: 0, cols: [0] };
    const result = columnDistinctValues(sheet, group, 0, 3, new Set());
    expect(result).toEqual([""]);
  });

  it("case-insensitive sort order (mixed case)", () => {
    const sheet = makeSheet([
      ["Name"],
      ["banana"],
      ["Apple"],
      ["cherry"],
    ]);
    const group: HeaderGroup = { anchorCol: 0, cols: [0] };
    const result = columnDistinctValues(sheet, group, 0, 4, new Set());
    expect(result).toEqual(["Apple", "banana", "cherry"]);
  });
});
