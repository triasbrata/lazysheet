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

export type MarkdownFormat = "inline" | "title" | "table" | "ascii";

// Pipe-table escape: pipes break columns; newlines break rows.
function escapeForTable(v: string): string {
  return v.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

// Single-line collapse for ASCII column-width math.
function flattenForAscii(v: string): string {
  return v.replace(/\r?\n/g, " ");
}

/**
 * Build a markdown/text export of the cells in `bounds` from `sheet`.
 *
 * Formats:
 *  - "inline": `<header>: <value>` per cell, blank line between rows.
 *  - "title": `### <header>\n<value>` per cell, `---` between rows.
 *  - "table": GitHub-flavored markdown pipe table.
 *  - "ascii": fixed-width ASCII table with `+---+` borders.
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
  format: MarkdownFormat = "inline",
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

  // Table/ASCII formats — collect into a matrix first, then render.
  if (format === "table" || format === "ascii") {
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

    if (format === "table") {
      const headerLine =
        "| " + headers.map(escapeForTable).join(" | ") + " |";
      const sepLine = "| " + cols.map(() => "---").join(" | ") + " |";
      const bodyLines = dataRows.map(
        (row) => "| " + row.map(escapeForTable).join(" | ") + " |",
      );
      return {
        text: [headerLine, sepLine, ...bodyLines].join("\n"),
        rowsEmitted: dataRows.length,
        truncated,
      };
    }

    // ASCII
    const flatHeaders = headers.map(flattenForAscii);
    const flatRows = dataRows.map((row) => row.map(flattenForAscii));
    const widths = cols.map((_, i) => {
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
      rowsEmitted: dataRows.length,
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
