import type { SheetModel } from "@/lib/types";
import { cellText } from "@/lib/types";
import { columnLetter, type Bounds } from "@/components/Grid/grid-utils";
import { STATS_CELL_CAP, formatStatNumber } from "@/lib/selection-stats";

export type AggFn = "sum" | "avg" | "min" | "max" | "count";

export interface FieldDescriptor {
  col: number;
  label: string;
}

export interface ResolvedFields {
  fields: FieldDescriptor[];
  excludeRow: number | null;
  fromMarkedHeader: boolean;
}

export interface GroupByOpts {
  aggFn: AggFn;
  valueCol: number;
  categoryCol: number;
  excludeRow: number | null;
}

export interface GroupByRow {
  key: string;
  display: string;
  value: number;
  count: number;
}

export interface GroupByResult {
  rows: GroupByRow[];
  skippedNonNumeric: number;
  skippedNoCategory: number;
  tooLarge: boolean;
  truncated: boolean;
  totalGroups: number;
  totalRowsAggregated: number;
}

export const MAX_GROUP_ROWS = 200;
const BLANK_DISPLAY = "(blank)";

export function resolveFields(
  sheet: SheetModel,
  bounds: Bounds,
  markedHeaderRow: number | null,
  treatFirstRowAsHeader: boolean,
): ResolvedFields {
  const fields: FieldDescriptor[] = [];
  const labelFromRow = (rowIdx: number, col: number): string => {
    const cell = sheet.rows[rowIdx]?.[col];
    const txt = cell ? cellText(cell).trim() : "";
    return txt || columnLetter(col);
  };

  const markedInside =
    markedHeaderRow !== null &&
    markedHeaderRow >= bounds.r1 &&
    markedHeaderRow <= bounds.r2;

  if (markedHeaderRow !== null) {
    for (let c = bounds.c1; c <= bounds.c2; c++) {
      fields.push({ col: c, label: labelFromRow(markedHeaderRow, c) });
    }
    return {
      fields,
      excludeRow: markedInside ? markedHeaderRow : null,
      fromMarkedHeader: true,
    };
  }

  if (treatFirstRowAsHeader) {
    for (let c = bounds.c1; c <= bounds.c2; c++) {
      fields.push({ col: c, label: labelFromRow(bounds.r1, c) });
    }
    return {
      fields,
      excludeRow: bounds.r1,
      fromMarkedHeader: false,
    };
  }

  for (let c = bounds.c1; c <= bounds.c2; c++) {
    fields.push({ col: c, label: columnLetter(c) });
  }
  return { fields, excludeRow: null, fromMarkedHeader: false };
}

interface Accumulator {
  sum: number;
  n: number;
  min: number;
  max: number;
  count: number;
}

function newAcc(): Accumulator {
  return {
    sum: 0,
    n: 0,
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
    count: 0,
  };
}

function isNumericCellValue(
  v: { t: string; c?: unknown },
): v is { t: "Number" | "Integer"; c: number } {
  return v.t === "Number" || v.t === "Integer";
}

export function computeGroupBySummary(
  sheet: SheetModel,
  bounds: Bounds,
  opts: GroupByOpts,
): GroupByResult {
  const totalCells =
    (bounds.r2 - bounds.r1 + 1) * (bounds.c2 - bounds.c1 + 1);
  if (totalCells > STATS_CELL_CAP) {
    return {
      rows: [],
      skippedNonNumeric: 0,
      skippedNoCategory: 0,
      tooLarge: true,
      truncated: false,
      totalGroups: 0,
      totalRowsAggregated: 0,
    };
  }

  const accs = new Map<string, Accumulator>();
  let skippedNonNumeric = 0;
  let totalRowsAggregated = 0;
  const needsNumeric = opts.aggFn !== "count";

  for (let r = bounds.r1; r <= bounds.r2; r++) {
    if (opts.excludeRow !== null && r === opts.excludeRow) continue;
    const row = sheet.rows[r];

    const catCell = row?.[opts.categoryCol];
    const key = catCell ? cellText(catCell) : "";

    if (needsNumeric) {
      const valCell = row?.[opts.valueCol];
      if (!valCell || !isNumericCellValue(valCell.v)) {
        skippedNonNumeric++;
        continue;
      }
      const n = valCell.v.c;
      if (!Number.isFinite(n)) {
        skippedNonNumeric++;
        continue;
      }
      let acc = accs.get(key);
      if (!acc) {
        acc = newAcc();
        accs.set(key, acc);
      }
      acc.sum += n;
      acc.n++;
      if (n < acc.min) acc.min = n;
      if (n > acc.max) acc.max = n;
      acc.count++;
      totalRowsAggregated++;
    } else {
      // count semantics: count any non-empty value cell in the value column.
      // If valueCol == categoryCol, that's a count-of-self.
      const valCell = row?.[opts.valueCol];
      const isEmpty = !valCell || valCell.v.t === "Empty";
      if (isEmpty) continue;
      let acc = accs.get(key);
      if (!acc) {
        acc = newAcc();
        accs.set(key, acc);
      }
      acc.count++;
      totalRowsAggregated++;
    }
  }

  const rows: GroupByRow[] = [];
  for (const [key, acc] of accs) {
    let value: number;
    switch (opts.aggFn) {
      case "sum":
        value = acc.sum;
        break;
      case "avg":
        value = acc.n > 0 ? acc.sum / acc.n : 0;
        break;
      case "min":
        value = acc.n > 0 ? acc.min : 0;
        break;
      case "max":
        value = acc.n > 0 ? acc.max : 0;
        break;
      case "count":
        value = acc.count;
        break;
    }
    rows.push({
      key,
      display: key === "" ? BLANK_DISPLAY : key,
      value,
      count: acc.count,
    });
  }

  rows.sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    return a.key.localeCompare(b.key);
  });

  const totalGroups = rows.length;
  const truncated = totalGroups > MAX_GROUP_ROWS;
  const finalRows = truncated ? rows.slice(0, MAX_GROUP_ROWS) : rows;

  return {
    rows: finalRows,
    skippedNonNumeric,
    skippedNoCategory: 0,
    tooLarge: false,
    truncated,
    totalGroups,
    totalRowsAggregated,
  };
}

// Local table-cell escape — kept independent from markdown-export.ts so the
// two lib modules can evolve without coupling.
function escapeForPipeTable(v: string): string {
  return v.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function escapeForTSV(v: string): string {
  return v.replace(/[\t\r\n]/g, " ");
}

export function buildValueHeader(aggFn: AggFn, valueLabel: string): string {
  if (aggFn === "count") return "COUNT";
  return `${aggFn.toUpperCase()}(${valueLabel})`;
}

export function formatGroupByMarkdown(
  result: GroupByResult,
  catLabel: string,
  valueHeader: string,
): string {
  const head = `| ${escapeForPipeTable(catLabel)} | ${escapeForPipeTable(valueHeader)} |`;
  const sep = `| --- | --- |`;
  const body = result.rows.map(
    (r) =>
      `| ${escapeForPipeTable(r.display)} | ${escapeForPipeTable(formatStatNumber(r.value))} |`,
  );
  return [head, sep, ...body].join("\n");
}

export function formatGroupByTSV(
  result: GroupByResult,
  catLabel: string,
  valueHeader: string,
): string {
  const head = `${escapeForTSV(catLabel)}\t${escapeForTSV(valueHeader)}`;
  const body = result.rows.map(
    (r) =>
      `${escapeForTSV(r.display)}\t${escapeForTSV(formatStatNumber(r.value))}`,
  );
  return [head, ...body].join("\n");
}
