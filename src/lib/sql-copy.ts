import type { CellModel, SheetModel } from "@/lib/types";
import { cellText } from "@/lib/types";
import type { Bounds } from "@/components/Grid/grid-utils";

// Soft cap on cells processed. Beyond this, output is truncated and the caller
// can warn the user. Keeps the synchronous string concat from stalling the UI
// on huge selections.
const MAX_CELLS = 100_000;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type QueryKind = "insert" | "update" | "upsert";
export type SqlDialect = "mysql" | "postgres" | "sqlite" | "ansi";

export interface SqlColumn {
  index: number;
  name: string;
}

export interface BuildSqlOptions {
  sheet: SheetModel;
  bounds: Bounds;
  headerRowIdx: number;
  kind: QueryKind;
  tableName: string;
  dialect: SqlDialect;
  /** ABSOLUTE column indices used as key / WHERE columns */
  keyCols: number[];
  rowFilter?: (r: number) => boolean;
}

export type SkipReason = { kind: "empty" } | { kind: "null-key"; cols: string[] };

export interface SkippedRow {
  /** 1-based sheet row number */
  rowNumber: number;
  reason: SkipReason;
}

export interface BuildSqlResult {
  text: string;
  rowsEmitted: number;
  truncated: boolean;
  skippedRows: SkippedRow[];
}

export interface SqlProgress {
  done: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum data rows per INSERT … VALUES statement */
export const SQL_ROWS_PER_INSERT = 500;

/** Above this row count, use the async progress variant */
export const SQL_ASYNC_THRESHOLD = 5000;

/** Yield the event loop every N rows in the async path */
export const PROGRESS_YIELD_ROWS = 2000;

/** Max skipped-row annotations to emit in the leading comment block */
export const SQL_SKIP_COMMENT_CAP = 50;

// ---------------------------------------------------------------------------
// Identifier quoting
// ---------------------------------------------------------------------------

/** Quote a single identifier segment (no dots). */
function quoteIdentSegment(seg: string, dialect: SqlDialect): string {
  if (dialect === "mysql") {
    return "`" + seg.replace(/`/g, "``") + "`";
  }
  // postgres | sqlite | ansi → double-quote
  return '"' + seg.replace(/"/g, '""') + '"';
}

/**
 * Quote an identifier for use in SQL. Splits on "." to support schema.table
 * notation; column names are single-segment so they use the same path.
 */
export function quoteIdent(name: string, dialect: SqlDialect): string {
  return name
    .split(".")
    .map((seg) => quoteIdentSegment(seg, dialect))
    .join(".");
}

// ---------------------------------------------------------------------------
// Literal serialisation
// ---------------------------------------------------------------------------

/**
 * Convert a number to a plain decimal string without scientific notation.
 * Precision beyond 2^53 is not guaranteed (JS number limitation).
 */
function numberToPlainString(n: number): string {
  const s = String(n);
  if (!s.includes("e") && !s.includes("E")) return s;
  if (Number.isInteger(n)) return BigInt(n).toString();
  // Fixed-point with enough digits; strip trailing zeros and a lone trailing dot.
  return n.toFixed(20).replace(/\.?0+$/, "");
}

/**
 * Serialise a cell value as a SQL literal suitable for embedding in a
 * statement. Returns "NULL" for missing / empty / error / non-finite cells.
 */
export function sqlLiteral(
  cell: CellModel | undefined,
  dialect: SqlDialect,
): string {
  if (cell === undefined) return "NULL";
  const v = cell.v;
  if (v.t === "Empty" || v.t === "Error") return "NULL";

  if (v.t === "Number" || v.t === "Integer") {
    if (!Number.isFinite(v.c)) return "NULL";
    return numberToPlainString(v.c);
  }

  if (v.t === "Bool") {
    if (dialect === "mysql" || dialect === "sqlite") {
      return v.c ? "1" : "0";
    }
    // postgres | ansi
    return v.c ? "TRUE" : "FALSE";
  }

  // Text | Date → string literal
  let s = v.c;
  s = s.replace(/'/g, "''");
  if (dialect === "mysql") s = s.replace(/\\/g, "\\\\");
  return "'" + s + "'";
}

// ---------------------------------------------------------------------------
// Column metadata
// ---------------------------------------------------------------------------

/**
 * Return one SqlColumn per column in bounds.c1..bounds.c2.
 * `name` is the raw header cell text (may be "" — the caller guarantees
 * uniqueness and non-empty values for use as SQL identifiers upstream).
 */
export function sqlColumns(
  sheet: SheetModel,
  bounds: Bounds,
  headerRowIdx: number,
): SqlColumn[] {
  const headerRow = sheet.rows[headerRowIdx];
  const result: SqlColumn[] = [];
  for (let c = bounds.c1; c <= bounds.c2; c++) {
    const cell = headerRow?.[c];
    const name = cell ? cellText(cell) : "";
    result.push({ index: c, name });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Internal row collection
// ---------------------------------------------------------------------------

interface CollectedRow {
  rowNumber: number; // 1-based
  cells: (CellModel | undefined)[]; // positional, length === cols.length
}

interface CollectResult {
  rows: CollectedRow[];
  skippedRows: SkippedRow[];
  truncated: boolean;
}

/** Return true when every element in the array is missing or has v.t "Empty". */
function isRowAllEmpty(cells: (CellModel | undefined)[]): boolean {
  return cells.every((c) => c === undefined || c.v.t === "Empty");
}

/**
 * Iterate the data rows in bounds, apply filters, enforce MAX_CELLS, and
 * collect rows suitable for SQL generation.
 */
function collectRows(opts: BuildSqlOptions): CollectResult {
  const { sheet, bounds, headerRowIdx, kind, dialect, keyCols, rowFilter } =
    opts;

  // Absolute column indices for the selection
  const cols: number[] = [];
  for (let c = bounds.c1; c <= bounds.c2; c++) cols.push(c);

  // Header labels indexed by absolute column (for null-key messages)
  const colLabels = sqlColumns(sheet, bounds, headerRowIdx);
  const labelByAbsCol: Record<number, string> = {};
  for (const sc of colLabels) labelByAbsCol[sc.index] = sc.name;

  const rows: CollectedRow[] = [];
  const skippedRows: SkippedRow[] = [];
  let cellsSeen = 0;
  let truncated = false;

  for (let r = bounds.r1; r <= bounds.r2; r++) {
    if (r === headerRowIdx) continue;
    if (rowFilter && !rowFilter(r)) continue;

    if (cellsSeen >= MAX_CELLS) {
      truncated = true;
      break;
    }

    const rowCells = cols.map((c) => sheet.rows[r]?.[c]);
    cellsSeen += cols.length;

    if (isRowAllEmpty(rowCells)) {
      skippedRows.push({ rowNumber: r + 1, reason: { kind: "empty" } });
      continue;
    }

    // For UPDATE, rows with NULL key columns cannot be matched — skip them.
    if (kind === "update") {
      const nullKeyCols = keyCols.filter(
        (c) => sqlLiteral(sheet.rows[r]?.[c], dialect) === "NULL",
      );
      if (nullKeyCols.length > 0) {
        skippedRows.push({
          rowNumber: r + 1,
          reason: {
            kind: "null-key",
            cols: nullKeyCols.map((c) => labelByAbsCol[c] ?? ""),
          },
        });
        continue;
      }
    }

    rows.push({ rowNumber: r + 1, cells: rowCells });
  }

  return { rows, skippedRows, truncated };
}

// ---------------------------------------------------------------------------
// Position mapping (absolute → positional)
// ---------------------------------------------------------------------------

interface PosMap {
  keyPos: number[];
  nonKeyPos: number[];
}

function buildPosMap(cols: number[], keyCols: number[]): PosMap {
  const keyPosSet = new Set<number>();
  const keyPos: number[] = [];
  for (const c of keyCols) {
    const pos = cols.indexOf(c);
    if (pos !== -1) {
      keyPos.push(pos);
      keyPosSet.add(pos);
    }
  }
  const nonKeyPos: number[] = [];
  for (let i = 0; i < cols.length; i++) {
    if (!keyPosSet.has(i)) nonKeyPos.push(i);
  }
  return { keyPos, nonKeyPos };
}

// ---------------------------------------------------------------------------
// Statement builders (position-based)
// ---------------------------------------------------------------------------

function tupleStr(
  row: CollectedRow,
  dialect: SqlDialect,
): string {
  return (
    "(" +
    row.cells.map((cell) => sqlLiteral(cell, dialect)).join(", ") +
    ")"
  );
}

function insertChunkStmt(
  tbl: string,
  colIdents: string[],
  tuples: string[],
): string {
  return (
    `INSERT INTO ${tbl} (${colIdents.join(", ")}) VALUES\n` +
    tuples.join(",\n") +
    ";"
  );
}

function upsertChunkStmt(
  tbl: string,
  colIdents: string[],
  tuples: string[],
  keyPos: number[],
  nonKeyPos: number[],
  dialect: SqlDialect,
): string {
  const base =
    `INSERT INTO ${tbl} (${colIdents.join(", ")}) VALUES\n` +
    tuples.join(",\n");

  if (dialect === "mysql") {
    const updateClauses = nonKeyPos
      .map((p) => `${colIdents[p]}=VALUES(${colIdents[p]})`)
      .join(", ");
    return base + "\nON DUPLICATE KEY UPDATE " + updateClauses + ";";
  }

  // postgres | sqlite
  const conflictCols = keyPos.map((p) => colIdents[p]).join(", ");
  const setClauses = nonKeyPos
    .map((p) => `${colIdents[p]}=EXCLUDED.${colIdents[p]}`)
    .join(", ");
  return (
    base +
    "\nON CONFLICT (" +
    conflictCols +
    ") DO UPDATE SET " +
    setClauses +
    ";"
  );
}

function updateStmt(
  tbl: string,
  row: CollectedRow,
  colIdents: string[],
  keyPos: number[],
  nonKeyPos: number[],
  dialect: SqlDialect,
): string {
  const setClauses = nonKeyPos
    .map((p) => `${colIdents[p]}=${sqlLiteral(row.cells[p], dialect)}`)
    .join(", ");
  const whereClauses = keyPos
    .map((p) => `${colIdents[p]}=${sqlLiteral(row.cells[p], dialect)}`)
    .join(" AND ");
  return `UPDATE ${tbl} SET ${setClauses} WHERE ${whereClauses};`;
}

// ---------------------------------------------------------------------------
// Skip comment block
// ---------------------------------------------------------------------------

/**
 * Build the leading SQL comment block describing any skipped rows.
 * Returns "" when there are no skipped rows.
 */
export function buildSkipComment(skipped: SkippedRow[]): string {
  if (skipped.length === 0) return "";

  // Sanitise multi-line strings embedded in column names so they stay comments.
  const clean = (s: string): string => s.replace(/[\r\n]+/g, " ");

  const head = `-- Skipped ${skipped.length} row(s):`;
  const lines = skipped
    .slice(0, SQL_SKIP_COMMENT_CAP)
    .map((s) => {
      if (s.reason.kind === "empty") {
        return `--   row ${s.rowNumber}: all cells empty`;
      }
      return (
        `--   row ${s.rowNumber}: NULL key (` +
        s.reason.cols.map(clean).join(", ") +
        ")"
      );
    });

  if (skipped.length > SQL_SKIP_COMMENT_CAP) {
    lines.push(`--   ...and ${skipped.length - SQL_SKIP_COMMENT_CAP} more`);
  }

  return [head, ...lines, ""].join("\n");
}

// ---------------------------------------------------------------------------
// Body assembly
// ---------------------------------------------------------------------------

function assembleBody(
  kind: QueryKind,
  rows: CollectedRow[],
  tbl: string,
  colIdents: string[],
  keyPos: number[],
  nonKeyPos: number[],
  dialect: SqlDialect,
): string {
  if (kind === "update") {
    return rows
      .map((row) => updateStmt(tbl, row, colIdents, keyPos, nonKeyPos, dialect))
      .join("\n");
  }

  // insert | upsert — batch into chunks
  const chunks: string[] = [];
  for (let i = 0; i < rows.length; i += SQL_ROWS_PER_INSERT) {
    const chunk = rows.slice(i, i + SQL_ROWS_PER_INSERT);
    const tuples = chunk.map((row) => tupleStr(row, dialect));
    if (kind === "insert") {
      chunks.push(insertChunkStmt(tbl, colIdents, tuples));
    } else {
      chunks.push(
        upsertChunkStmt(tbl, colIdents, tuples, keyPos, nonKeyPos, dialect),
      );
    }
  }
  return chunks.join("\n\n");
}

// ---------------------------------------------------------------------------
// Main synchronous entry point
// ---------------------------------------------------------------------------

/**
 * Build a SQL INSERT / UPDATE / UPSERT statement (or batch of statements) from
 * a grid selection.
 */
export function buildSqlQuery(opts: BuildSqlOptions): BuildSqlResult {
  const { sheet, bounds, headerRowIdx, kind, tableName, dialect, keyCols } =
    opts;

  // Absolute column list for the selection
  const cols: number[] = [];
  for (let c = bounds.c1; c <= bounds.c2; c++) cols.push(c);

  // Quoted table identifier
  const tbl = quoteIdent(tableName, dialect);

  // Column identifiers from header labels
  const sqlCols = sqlColumns(sheet, bounds, headerRowIdx);
  const colIdents = sqlCols.map((sc) => quoteIdent(sc.name, dialect));

  // Position maps (computed once)
  const { keyPos, nonKeyPos } = buildPosMap(cols, keyCols);

  // Collect data rows
  const { rows, skippedRows, truncated } = collectRows(opts);

  // Assemble output
  const comment = buildSkipComment(skippedRows);
  const text =
    rows.length === 0
      ? ""
      : comment +
        assembleBody(kind, rows, tbl, colIdents, keyPos, nonKeyPos, dialect);

  return { text, rowsEmitted: rows.length, truncated, skippedRows };
}

// ---------------------------------------------------------------------------
// Async / progress entry point
// ---------------------------------------------------------------------------

/**
 * Async variant of buildSqlQuery that reports progress via `onProgress` and
 * periodically yields the event loop to keep the UI responsive.
 *
 * Respects an optional AbortSignal; throws a DOMException("Aborted",
 * "AbortError") if aborted mid-flight.
 */
export async function generateSqlWithProgress(
  opts: BuildSqlOptions,
  onProgress: (p: SqlProgress) => void,
  signal?: AbortSignal,
): Promise<BuildSqlResult> {
  const { sheet, bounds, headerRowIdx, kind, tableName, dialect, keyCols } =
    opts;

  const cols: number[] = [];
  for (let c = bounds.c1; c <= bounds.c2; c++) cols.push(c);

  const tbl = quoteIdent(tableName, dialect);
  const sqlCols = sqlColumns(sheet, bounds, headerRowIdx);
  const colIdents = sqlCols.map((sc) => quoteIdent(sc.name, dialect));
  const { keyPos, nonKeyPos } = buildPosMap(cols, keyCols);

  const { rows, skippedRows, truncated } = collectRows(opts);
  const total = rows.length;
  let done = 0;
  let sinceYield = 0;
  const parts: string[] = [];

  for (let i = 0; i < rows.length; i += SQL_ROWS_PER_INSERT) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const chunk = rows.slice(i, i + SQL_ROWS_PER_INSERT);

    if (kind === "insert") {
      const tuples = chunk.map((row) => tupleStr(row, dialect));
      parts.push(insertChunkStmt(tbl, colIdents, tuples));
    } else if (kind === "upsert") {
      const tuples = chunk.map((row) => tupleStr(row, dialect));
      parts.push(
        upsertChunkStmt(tbl, colIdents, tuples, keyPos, nonKeyPos, dialect),
      );
    } else {
      // update — one statement per row
      for (const row of chunk) {
        parts.push(
          updateStmt(tbl, row, colIdents, keyPos, nonKeyPos, dialect),
        );
      }
    }

    done += chunk.length;
    onProgress({ done, total });
    sinceYield += chunk.length;

    if (sinceYield >= PROGRESS_YIELD_ROWS) {
      await new Promise<void>((res) => setTimeout(res, 0));
      sinceYield = 0;
    }
  }

  const separator = kind === "update" ? "\n" : "\n\n";
  const body = parts.join(separator);
  const text =
    total === 0 ? "" : buildSkipComment(skippedRows) + body;

  return { text, rowsEmitted: total, truncated, skippedRows };
}

// ---------------------------------------------------------------------------
// Duplicate-key detection
// ---------------------------------------------------------------------------

/**
 * Return true if two or more emit-eligible data rows share the same composite
 * key value. Uses "ansi" quoting for key serialisation so the comparison is
 * dialect-neutral.
 */
export function keyHasDuplicates(
  sheet: SheetModel,
  bounds: Bounds,
  headerRowIdx: number,
  keyCols: number[],
  rowFilter?: (r: number) => boolean,
): boolean {
  const seen = new Set<string>();

  for (let r = bounds.r1; r <= bounds.r2; r++) {
    if (r === headerRowIdx) continue;
    if (rowFilter && !rowFilter(r)) continue;

    // Check if the row is all-empty — if so, skip (same rule as collectRows)
    const rowCells = keyCols.map((c) => sheet.rows[r]?.[c]);
    // Skip all-empty rows (same rule as collectRows)
    const fullRow: (CellModel | undefined)[] = [];
    for (let c = bounds.c1; c <= bounds.c2; c++) {
      fullRow.push(sheet.rows[r]?.[c]);
    }
    if (isRowAllEmpty(fullRow)) continue;

    const keyStr = rowCells
      .map((cell) => sqlLiteral(cell, "ansi"))
      .join(" ");

    if (seen.has(keyStr)) return true;
    seen.add(keyStr);
  }

  return false;
}

// ---------------------------------------------------------------------------
// Misc utilities
// ---------------------------------------------------------------------------

/**
 * ANSI SQL does not have a standard upsert syntax (no ON CONFLICT / ON
 * DUPLICATE KEY UPDATE). Always returns false so callers can gate the upsert
 * option for ansi dialect.
 */
export function ansiUpsertSupported(): false {
  return false;
}
