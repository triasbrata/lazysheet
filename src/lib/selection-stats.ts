import type { SheetModel } from "@/lib/types";
import type { Bounds } from "@/components/Grid/grid-utils";

export interface SelectionStats {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
}

export const STATS_CELL_CAP = 100_000;

export function computeSelectionStats(
  sheet: SheetModel,
  bounds: Bounds,
): SelectionStats | null {
  const totalCells =
    (bounds.r2 - bounds.r1 + 1) * (bounds.c2 - bounds.c1 + 1);
  if (totalCells > STATS_CELL_CAP) return null;

  let count = 0;
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let r = bounds.r1; r <= bounds.r2; r++) {
    const row = sheet.rows[r];
    if (!row) continue;
    for (let c = bounds.c1; c <= bounds.c2; c++) {
      const cell = row[c];
      if (!cell) continue;
      if (cell.v.t === "Number" || cell.v.t === "Integer") {
        const n = cell.v.c;
        if (!Number.isFinite(n)) continue;
        count++;
        sum += n;
        if (n < min) min = n;
        if (n > max) max = n;
      }
    }
  }

  if (count === 0) return null;

  return { count, sum, avg: sum / count, min, max };
}

const intFormatter = new Intl.NumberFormat();
const floatFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 4,
});

export function formatStatNumber(n: number): string {
  if (Number.isInteger(n)) return intFormatter.format(n);
  return floatFormatter.format(n);
}
