export type CellValue =
  | { t: "Empty" }
  | { t: "Text"; c: string }
  | { t: "Number"; c: number }
  | { t: "Integer"; c: number }
  | { t: "Bool"; c: boolean }
  | { t: "Date"; c: string }
  | { t: "Error"; c: string };

export interface CellStyle {
  bg?: string;
  fg?: string;
  bold?: boolean;
  italic?: boolean;
  wrap?: boolean;
  align_h?: string;
  align_v?: string;
  font_size?: number;
  font_name?: string;
}

export interface CellModel {
  v: CellValue;
  s?: CellStyle;
  h?: string;
  /** Formula source incl. leading "=", e.g. "=SUM(A1:A5)". Present only for formula cells (xlsx/xlsm). */
  f?: string;
}

export interface MergeRange {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export interface SheetSummary {
  name: string;
  index: number;
}

export interface SheetModel {
  name: string;
  rows: CellModel[][];
  col_widths: number[];
  row_heights: number[];
  merges: MergeRange[];
  frozen_rows: number;
  frozen_cols: number;
  max_col: number;
}

export interface WorkbookModel {
  path: string;
  file_name: string;
  sheets: SheetSummary[];
  active_sheet: SheetModel;
}

export function cellText(c: CellModel): string {
  switch (c.v.t) {
    case "Empty":
      return "";
    case "Text":
    case "Date":
    case "Error":
      return c.v.c;
    case "Number":
      return formatNumber(c.v.c);
    case "Integer":
      return String(c.v.c);
    case "Bool":
      return c.v.c ? "TRUE" : "FALSE";
  }
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

/**
 * Parse numeric-looking text that xlsx exports often store as Text, including
 * thousand separators and decimal commas/dots. Handles:
 *   "98550" "98,550" "1,234,567" "1.234.567" "1,234.56" "1.234,56" "98 550"
 * Returns null for currency symbols, letters, accounting parens, or anything
 * that is not a clean number — those need explicit currency/locale config and
 * are intentionally NOT coerced here.
 *
 * Ambiguity note: a single separator followed by exactly 3 digits (e.g.
 * "12.345") is treated as a THOUSAND separator (-> 12345), not a 3-decimal
 * value. Financial columns are separator-consistent, so this is the safe
 * default; revisit if a currency/locale setting is added.
 */
function parseNumericText(raw: string): number | null {
  let s = raw.trim();
  if (s === "") return null;
  s = s.replace(/\s/g, ""); // spaces as thousand separators ("98 550")
  if (s === "") return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  let normalized = s;

  if (hasComma && hasDot) {
    // The later-occurring separator is the decimal point; the other is grouping.
    const decSep = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const thouSep = decSep === "," ? "." : ",";
    normalized = s.split(thouSep).join("").replace(decSep, ".");
  } else if (hasComma || hasDot) {
    const sep = hasComma ? "," : ".";
    const occurrences = s.split(sep).length - 1;
    const digitsAfter = s.length - s.lastIndexOf(sep) - 1;
    if (occurrences > 1 || digitsAfter === 3) {
      normalized = s.split(sep).join(""); // grouping separator
    } else {
      normalized = s.replace(sep, "."); // decimal separator
    }
  }

  if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Returns a stable string key for a (row, col) pair, used to identify an
 * active edit cell without allocating a heap object.
 */
export function editKey(row: number, col: number): string {
  return `${row},${col}`;
}

/**
 * Coerce raw user-input text into the most appropriate CellValue variant.
 *
 * Rules (checked in order):
 *   1. "" → Empty
 *   2. Matches /^-?\d+$/ → Integer (parseInt)
 *   3. Finite float (Number(raw) is finite and non-NaN, trimmed non-empty) → Number
 *   4. "TRUE" / "FALSE" (case-insensitive) → Bool
 *   5. Anything else → Text (including "=…" formulas — not parsed in v1)
 */
export function coerceInput(raw: string): CellValue {
  if (raw === "") return { t: "Empty" };
  if (/^-?\d+$/.test(raw)) return { t: "Integer", c: parseInt(raw, 10) };
  const trimmed = raw.trim();
  if (trimmed !== "" && !Number.isNaN(Number(raw)) && Number.isFinite(Number(raw))) {
    return { t: "Number", c: Number(raw) };
  }
  const upper = raw.toUpperCase();
  if (upper === "TRUE") return { t: "Bool", c: true };
  if (upper === "FALSE") return { t: "Bool", c: false };
  return { t: "Text", c: raw };
}

/**
 * Returns true if `path` has a file extension that the app can write back to.
 * Writable extensions: xlsx, xlsm, csv, tsv, txt.
 * Returns false for undefined/null/empty paths, paths without an extension,
 * and any other extension (e.g. xls, ods).
 */
export function isWritableFormat(path?: string | null): boolean {
  if (!path) return false;
  const dot = path.lastIndexOf(".");
  if (dot === -1) return false;
  const ext = path.slice(dot + 1).toLowerCase();
  return ext === "xlsx" || ext === "xlsm" || ext === "csv" || ext === "tsv" || ext === "txt";
}

/**
 * Numeric value of a cell, coercing numeric-looking Text (e.g. xlsx exports
 * that store "135000" or "98,550" as formatted text) into a real number.
 * Returns null for empty/whitespace/non-numeric/non-finite cells — those are
 * NOT counted.
 */
export function numericValue(v: CellValue): number | null {
  if (v.t === "Number" || v.t === "Integer") {
    return Number.isFinite(v.c) ? v.c : null;
  }
  if (v.t === "Text") {
    return parseNumericText(v.c);
  }
  return null;
}
