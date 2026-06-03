import type { SqlDialect, QueryKind } from "@/lib/sql-copy";

// Persisted preferences for the Copy-as-Query (SQL) feature. Stores the
// chosen SQL dialect globally, per-sheet table name, and the last-used key
// columns per (file, sheet, kind).
// Mirrors the pattern in copy-format-pref.ts (try/catch, type guard, defaults).
export const SQL_DIALECT_KEY = "lazysheet:sql-dialect";
export const SQL_TABLE_NAME_PREFIX = "lazysheet:sql-table:"; // + `${fileName}::${sheetName}`
export const SQL_KEY_COLS_PREFIX = "lazysheet:sql-keys:"; // + `${fileName}::${sheetName}::${kind}`
export const DEFAULT_SQL_DIALECT: SqlDialect = "mysql";

export function isSqlDialect(v: unknown): v is SqlDialect {
  return v === "mysql" || v === "postgres" || v === "sqlite" || v === "ansi";
}

export function readStoredDialect(): SqlDialect {
  try {
    const v = localStorage.getItem(SQL_DIALECT_KEY);
    if (isSqlDialect(v)) return v;
  } catch {
    // Storage disabled or quota — fall back to default.
  }
  return DEFAULT_SQL_DIALECT;
}

export function writeStoredDialect(d: SqlDialect): void {
  try {
    localStorage.setItem(SQL_DIALECT_KEY, d);
  } catch {
    // Storage disabled or quota — ignore.
  }
}

export function readStoredTableName(fileName: string, sheetName: string): string | null {
  try {
    return localStorage.getItem(SQL_TABLE_NAME_PREFIX + `${fileName}::${sheetName}`);
  } catch {
    return null;
  }
}

export function writeStoredTableName(fileName: string, sheetName: string, table: string): void {
  try {
    localStorage.setItem(SQL_TABLE_NAME_PREFIX + `${fileName}::${sheetName}`, table);
  } catch {
    // Storage disabled or quota — ignore.
  }
}

/** Last-used key columns (absolute indices) for UPDATE/UPSERT, per (file, sheet, kind). */
export function readStoredKeyCols(
  fileName: string,
  sheetName: string,
  kind: QueryKind,
): number[] | null {
  try {
    const raw = localStorage.getItem(
      SQL_KEY_COLS_PREFIX + `${fileName}::${sheetName}::${kind}`,
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
      return parsed as number[];
    }
  } catch {
    // Bad JSON / storage disabled — treat as none.
  }
  return null;
}

export function writeStoredKeyCols(
  fileName: string,
  sheetName: string,
  kind: QueryKind,
  cols: number[],
): void {
  try {
    localStorage.setItem(
      SQL_KEY_COLS_PREFIX + `${fileName}::${sheetName}::${kind}`,
      JSON.stringify(cols),
    );
  } catch {
    // Storage disabled or quota — ignore.
  }
}

/** Remove a trailing ".<ext>" extension from a file name.
 *  "data.xlsx" → "data", "my.data.csv" → "my.data",
 *  ".hidden" → ".hidden", "noext" → "noext"
 */
export function stripExt(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot > 0) return fileName.slice(0, dot);
  return fileName;
}

/** Coerce an arbitrary string into a safe SQL identifier.
 *  - trim whitespace
 *  - replace non-[A-Za-z0-9_] chars with "_"
 *  - collapse consecutive "_" to a single "_"
 *  - strip leading/trailing "_"
 *  - if result is empty or starts with a digit, prefix "t_"
 *
 *  sanitize("my data") → "my_data"
 *  sanitize("123")     → "t_123"
 *  sanitize("a__b")    → "a_b"
 *  sanitize("")        → "t_"
 */
export function sanitizeTableName(raw: string): string {
  let s = raw.trim();
  s = s.replace(/[^A-Za-z0-9_]/g, "_");
  s = s.replace(/_+/g, "_");
  s = s.replace(/^_+|_+$/g, "");
  if (s === "" || /^\d/.test(s)) s = "t_" + s;
  return s;
}
