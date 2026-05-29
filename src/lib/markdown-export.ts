import type { SheetModel } from "@/lib/types";
import { cellText } from "@/lib/types";
import { columnLetter, type Bounds } from "@/components/Grid/grid-utils";

// Soft cap on cells processed. Beyond this, output is truncated and the caller
// can warn the user. Keeps the synchronous string concat from stalling the UI
// on huge selections.
const MAX_CELLS = 100_000;

export interface BuildMarkdownResult {
  text: string;
  rowsEmitted: number;
  truncated: boolean;
}

export type CopyFormat =
  | "inline" | "title" | "table" | "ascii" | "csv" | "tsv" | "plain";
/** @deprecated use CopyFormat */
export type MarkdownFormat = CopyFormat;

// Pipe-table escape: pipes break columns; newlines break rows.
function escapeForTable(v: string): string {
  return v.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

// Single-line collapse for ASCII column-width math.
function flattenForAscii(v: string): string {
  return v.replace(/\r?\n/g, " ");
}

// RFC-4180: wrap in double-quotes if field contains comma, double-quote, CR, or LF; double any inner quote.
function escapeCsv(v: string): string {
  if (/[",\r\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}

// TSV: lossy — tabs and newlines collapse to a single space.
function escapeTsv(v: string): string {
  return v.replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

interface Matrix {
  headers: string[];
  dataRows: string[][];
  rowsEmitted: number;
  truncated: boolean;
}

function buildMatrix(
  sheet: SheetModel,
  bounds: Bounds,
  headerRowIdx: number | null,
): Matrix {
  const headerRow =
    headerRowIdx != null && sheet.rows[headerRowIdx]
      ? sheet.rows[headerRowIdx]
      : null;

  const headerLabel = (c: number): string => {
    if (headerRow) {
      const cell = headerRow[c];
      if (cell) {
        const t = cellText(cell);
        if (t.length > 0) return t;
      }
    }
    return columnLetter(c);
  };

  const cols: number[] = [];
  for (let c = bounds.c1; c <= bounds.c2; c++) cols.push(c);
  const headers = cols.map(headerLabel);

  const dataRows: string[][] = [];
  let cellsSeen = 0;
  let truncated = false;
  for (let r = bounds.r1; r <= bounds.r2; r++) {
    if (r === headerRowIdx) continue;
    const row = sheet.rows[r];
    const out: string[] = [];
    for (const c of cols) {
      if (cellsSeen >= MAX_CELLS) {
        truncated = true;
        break;
      }
      cellsSeen++;
      const cell = row?.[c];
      out.push(cell ? cellText(cell) : "");
    }
    dataRows.push(out);
    if (truncated) break;
  }

  return { headers, dataRows, rowsEmitted: dataRows.length, truncated };
}

/**
 * Build a markdown/text export of the cells in `bounds` from `sheet`.
 *
 * Formats:
 *  - "inline": `<header>: <value>` per cell, blank line between rows.
 *  - "title": `### <header>\n<value>` per cell, `---` between rows.
 *  - "table": GitHub-flavored markdown pipe table.
 *  - "ascii": fixed-width ASCII table with `+---+` borders.
 *  - "csv": RFC-4180 comma-separated values with CRLF line endings.
 *  - "tsv": tab-separated values; tabs/newlines in cells collapse to space.
 *  - "plain": tab-separated values with no escaping (raw cellText).
 *
 * Header source:
 *  - `headerRowIdx` provided AND row exists AND cell at (headerRowIdx, c) has text → use cellText.
 *  - else → columnLetter(c).
 *
 * Header row is skipped from data rows.
 */
export function buildSelectionMarkdown(
  sheet: SheetModel,
  bounds: Bounds,
  headerRowIdx: number | null,
  format: CopyFormat = "inline",
): BuildMarkdownResult {
  const headerRow =
    headerRowIdx != null && sheet.rows[headerRowIdx]
      ? sheet.rows[headerRowIdx]
      : null;

  const headerLabel = (c: number): string => {
    if (headerRow) {
      const cell = headerRow[c];
      if (cell) {
        const t = cellText(cell);
        if (t.length > 0) return t;
      }
    }
    return columnLetter(c);
  };

  // Table/ASCII/CSV/TSV/plain formats — collect into a matrix first, then render.
  if (
    format === "table" ||
    format === "ascii" ||
    format === "csv" ||
    format === "tsv" ||
    format === "plain"
  ) {
    const matrix = buildMatrix(sheet, bounds, headerRowIdx);
    const { headers, dataRows, rowsEmitted, truncated } = matrix;

    if (format === "table") {
      const cols: number[] = [];
      for (let c = bounds.c1; c <= bounds.c2; c++) cols.push(c);
      const headerLine =
        "| " + headers.map(escapeForTable).join(" | ") + " |";
      const sepLine = "| " + cols.map(() => "---").join(" | ") + " |";
      const bodyLines = dataRows.map(
        (row) => "| " + row.map(escapeForTable).join(" | ") + " |",
      );
      return {
        text: [headerLine, sepLine, ...bodyLines].join("\n"),
        rowsEmitted,
        truncated,
      };
    }

    if (format === "ascii") {
      const flatHeaders = headers.map(flattenForAscii);
      const flatRows = dataRows.map((row) => row.map(flattenForAscii));
      const widths = headers.map((_, i) => {
        let w = flatHeaders[i].length;
        for (const row of flatRows) {
          if (row[i] && row[i].length > w) w = row[i].length;
        }
        return w;
      });
      const border =
        "+" + widths.map((w) => "-".repeat(w + 2)).join("+") + "+";
      const renderRow = (row: string[]) =>
        "|" +
        row
          .map((cell, i) => " " + (cell ?? "").padEnd(widths[i], " ") + " ")
          .join("|") +
        "|";
      const lines = [
        border,
        renderRow(flatHeaders),
        border,
        ...flatRows.map(renderRow),
        border,
      ];
      return {
        text: lines.join("\n"),
        rowsEmitted,
        truncated,
      };
    }

    if (format === "csv") {
      const headerLine = headers.map(escapeCsv).join(",");
      const bodyLines = dataRows.map((row) => row.map(escapeCsv).join(","));
      return {
        text: [headerLine, ...bodyLines].join("\r\n"),
        rowsEmitted,
        truncated,
      };
    }

    if (format === "tsv") {
      const headerLine = headers.map(escapeTsv).join("\t");
      const bodyLines = dataRows.map((row) => row.map(escapeTsv).join("\t"));
      return {
        text: [headerLine, ...bodyLines].join("\n"),
        rowsEmitted,
        truncated,
      };
    }

    // plain
    const headerLine = headers.join("\t");
    const bodyLines = dataRows.map((row) => row.join("\t"));
    return {
      text: [headerLine, ...bodyLines].join("\n"),
      rowsEmitted,
      truncated,
    };
  }

  // inline / title — per-cell line emission with row blocks.
  const blocks: string[] = [];
  let cellsSeen = 0;
  let truncated = false;
  let rowsEmitted = 0;

  for (let r = bounds.r1; r <= bounds.r2; r++) {
    if (r === headerRowIdx) continue;
    const row = sheet.rows[r];
    const cellParts: string[] = [];
    for (let c = bounds.c1; c <= bounds.c2; c++) {
      if (cellsSeen >= MAX_CELLS) {
        truncated = true;
        break;
      }
      cellsSeen++;
      const cell = row?.[c];
      const value = cell ? cellText(cell) : "";
      if (format === "title") {
        cellParts.push(`### ${headerLabel(c)}\n${value}`);
      } else {
        cellParts.push(`${headerLabel(c)}: ${value}`);
      }
    }
    if (cellParts.length > 0) {
      const sep = format === "title" ? "\n\n" : "\n";
      blocks.push(cellParts.join(sep));
      rowsEmitted++;
    }
    if (truncated) break;
  }

  const rowSep = format === "title" ? "\n\n---\n\n" : "\n\n";
  return {
    text: blocks.join(rowSep).replace(/\s+$/, ""),
    rowsEmitted,
    truncated,
  };
}
