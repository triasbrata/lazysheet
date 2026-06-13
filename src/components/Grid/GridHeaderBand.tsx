import type { ReactNode } from "react";
import { cellText, type SheetModel } from "@/lib/types";
import type { HeaderGroup } from "@/lib/grid-filter";
import {
  effectiveRowHeight,
  isHorizontalOnlyMerge,
  type FilterSource,
  type MergeInfo,
} from "./grid-utils";

export interface GridHeaderBandProps {
  /** 0-indexed header row */
  headerRow: number;
  /** Height of the sticky column-letter ruler (px) */
  headerHeight: number;
  /** Total body width (px) */
  bodyWidth: number;
  /** Width of the row-number column (px) */
  rowNumColWidth: number;
  /** Total number of columns */
  totalCols: number;
  /** Per-column widths array (px) */
  widths: number[];
  /** Sheet model (used to read header row cells + row height) */
  sheet: SheetModel;
  /** Row height overrides (same as Grid's rowOverrides) */
  rowOverrides?: Record<number, number>;
  /** Merge info for the sheet */
  merges: MergeInfo;
  /** Map of column anchor index → HeaderGroup for columns that have an active filter */
  groupByAnchor: Map<number, HeaderGroup>;
  /** Zoom factor (1 = 100%) */
  zoom: number;
  /** Slot: renders a filter control for column `col` from source `source` */
  renderFilterControl: (col: number, source: FilterSource) => ReactNode;
}

export function GridHeaderBand({
  headerRow,
  headerHeight,
  bodyWidth,
  rowNumColWidth,
  totalCols,
  widths,
  sheet,
  rowOverrides,
  merges,
  groupByAnchor,
  zoom,
  renderFilterControl,
}: GridHeaderBandProps) {
  return (
    <div
      className="sticky left-0 z-20 flex border-b border-border bg-muted/85 backdrop-blur-md"
      style={{ top: headerHeight, width: bodyWidth, height: Math.round(effectiveRowHeight(sheet, headerRow, rowOverrides) * zoom) }}
    >
      {/* Corner spacer aligns with row-number column */}
      <div
        className="sticky left-0 z-10 shrink-0 border-r border-border bg-muted/90"
        style={{ width: rowNumColWidth }}
      />
      {Array.from({ length: totalCols }, (_, i) => {
        const key = `${headerRow + 1}:${i + 1}`;
        const anchor = merges.anchors.get(key);
        // Skip cells covered by a horizontal header merge (anchor draws them).
        const absorbedKey = merges.absorbed.get(key);
        if (absorbedKey) {
          const parent = merges.anchors.get(absorbedKey);
          if (parent && isHorizontalOnlyMerge(parent)) return null;
        }
        const horizSpan = anchor && isHorizontalOnlyMerge(anchor) ? anchor.colSpan : 1;
        const w = widths.slice(i, i + horizSpan).reduce((a, b) => a + b, 0);
        const headerCell = sheet.rows[headerRow]?.[i];
        const text = headerCell ? cellText(headerCell) : "";
        const showFunnel = groupByAnchor.has(i);
        return (
          <div
            key={i}
            className="relative flex shrink-0 items-center border-r border-border px-1.5 text-xs font-semibold text-foreground"
            style={{ width: w }}
          >
            <span className="truncate pr-5">{text}</span>
            {showFunnel && (
              <span className="absolute right-1 top-1/2 -translate-y-1/2">
                {renderFilterControl(i, "band")}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
