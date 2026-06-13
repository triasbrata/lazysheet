import type { SheetModel } from "@/lib/types";
import { Cell } from "./Cell";
import { isHorizontalOnlyMerge, type MergeInfo } from "./grid-utils";

export interface MergeLayerProps {
  merges: MergeInfo;
  measurements: ReadonlyArray<{
    index: number;
    start: number;
    end: number;
    size: number;
  }>;
  // Maps an absolute row index → its position in the (possibly filtered)
  // visible row list. `measurements` is indexed by virtual position, not by
  // absolute row, so vertical merges must translate. Identity when no filter
  // is active. Merged rows are always visible (filter exemption), so an
  // anchor/end lookup is defined whenever the merge itself is.
  visiblePos: Map<number, number>;
  sheet: SheetModel;
  widths: number[];
  cumColX: number[];
  leftOffset: number;
  cellHighlight: (
    r: number,
    c: number,
  ) => "anchor" | "selected" | "match" | null;
  headerRow: number | null;
}

export function MergeLayer({
  merges,
  measurements,
  visiblePos,
  sheet,
  widths,
  cumColX,
  leftOffset,
  cellHighlight,
  headerRow,
}: MergeLayerProps) {
  if (merges.anchors.size === 0) return null;
  const entries = Array.from(merges.anchors.entries());
  return (
    <>
      {entries.map(([key, span]) => {
        if (isHorizontalOnlyMerge(span)) return null;
        const [r1Str, c1Str] = key.split(":");
        const r1 = parseInt(r1Str, 10) - 1;
        const c1 = parseInt(c1Str, 10) - 1;
        const r2 = r1 + span.rowSpan - 1;
        const startPos = visiblePos.get(r1);
        const endPos = visiblePos.get(r2);
        if (startPos === undefined || endPos === undefined) return null;
        const startMeas = measurements[startPos];
        const endMeas = measurements[endPos];
        if (!startMeas || !endMeas) return null;
        const top = startMeas.start;
        const height = endMeas.end - startMeas.start;
        const left = leftOffset + (cumColX[c1] ?? 0);
        const width = widths
          .slice(c1, c1 + span.colSpan)
          .reduce((a, b) => a + b, 0);
        const cell = sheet.rows[r1]?.[c1];
        const clip = cell?.s?.wrap === true;
        return (
          <Cell
            key={key}
            cell={cell}
            width={width}
            minHeight={height}
            spanWidth={width}
            spanHeight={height}
            rowSpan={span.rowSpan}
            colSpan={span.colSpan}
            isMerged
            absolute
            absoluteTop={top}
            absoluteLeft={left}
            clipOverflow={clip}
            dataRow={r1}
            dataCol={c1}
            highlight={cellHighlight(r1, c1)}
            inHeaderRow={r1 === headerRow}
          />
        );
      })}
    </>
  );
}
