import type { ReactNode } from "react";
import type { CellModel } from "@/lib/types";
import type { VirtualItem } from "@tanstack/virtual-core";
import { Cell } from "./Cell";
import { ResizeHandle } from "./ResizeHandle";
import type { ResizeOrientation } from "./ResizeHandle";
import {
  isHorizontalOnlyMerge,
  type MergeInfo,
  type CellHighlight,
} from "./grid-utils";

export interface GridRowProps {
  /** The virtual row item from @tanstack/react-virtual. */
  vr: VirtualItem;
  /** Absolute (0-indexed) row index in the sheet. */
  rowIdx: number;
  /** Width of the full row in pixels. */
  bodyWidth: number;
  /** Width of the sticky row-number column. */
  rowNumColWidth: number;
  /** Total number of columns. */
  totalCols: number;
  /** Per-column widths (pixels). */
  widths: number[];
  /** Pre-built merge info (anchors + absorbed maps). */
  merges: MergeInfo;
  /** Whether this row falls within the current selection bounds. */
  rowInSel: boolean;
  /** The marked header row index (0-indexed), or null if unset. */
  headerRow: number | null;
  /** Whether resize handles are disabled. */
  resizeDisabled?: boolean;
  /** Ref callback passed to the virtualizer for row measurement. */
  measureElement: (el: HTMLElement | null) => void;
  /** Retrieve a cell model (possibly edited) at (row, col). */
  cellAt: (row: number, col: number) => CellModel | undefined;
  /** Compute highlight state for a cell. */
  cellHighlight: (r: number, c: number) => CellHighlight;
  /** Render the inline funnel for a header cell (may return undefined). */
  headerFunnelFor: (colIdx: number, rowIdx: number) => ReactNode;
  /** Called when the user presses down on the row-number header cell. */
  onRowHeaderPointerDown: (e: React.PointerEvent<HTMLDivElement>, rowIdx: number) => void;
  /** Preview callback forwarded to the row ResizeHandle. */
  onResizePreview: (orientation: ResizeOrientation, index: number, size: number) => void;
  /** Commit callback forwarded to the row ResizeHandle. */
  onResizeCommit: (orientation: ResizeOrientation, index: number, size: number) => void;
}

export function GridRow({
  vr,
  rowIdx,
  bodyWidth,
  rowNumColWidth,
  totalCols,
  widths,
  merges,
  rowInSel,
  headerRow,
  resizeDisabled,
  measureElement,
  cellAt,
  cellHighlight,
  headerFunnelFor,
  onRowHeaderPointerDown,
  onResizePreview,
  onResizeCommit,
}: GridRowProps) {
  return (
    <div
      data-index={vr.index}
      data-abs-row={rowIdx}
      ref={measureElement}
      className="flex"
      style={{
        position: "absolute",
        top: vr.start,
        left: 0,
        width: bodyWidth,
      }}
    >
      {/* Row-number cell — sticky left */}
      <div
        data-row-header={rowIdx}
        onPointerDown={(e) => onRowHeaderPointerDown(e, rowIdx)}
        title={rowIdx === headerRow ? "Header row" : undefined}
        className={`sticky left-0 z-10 flex shrink-0 items-center justify-center border-r border-b border-border text-[10px] font-medium cursor-cell select-none relative backdrop-blur-xl ${
          rowInSel
            ? "bg-primary/20 text-foreground"
            : rowIdx === headerRow
              ? "bg-amber-500/30 text-foreground font-bold"
              : "bg-muted/85 text-muted-foreground"
        }`}
        style={{
          width: rowNumColWidth,
          minHeight: vr.size,
          alignSelf: "stretch",
        }}
      >
        {rowIdx + 1}
        {vr.size > 0 && (
          <ResizeHandle
            orientation="row"
            index={rowIdx}
            currentSize={vr.size}
            disabled={resizeDisabled}
            onPreview={onResizePreview}
            onCommit={onResizeCommit}
          />
        )}
      </div>

      {/* Data cells */}
      {Array.from({ length: totalCols }, (_, colIdx) => {
        const key = `${rowIdx + 1}:${colIdx + 1}`;
        const anchor = merges.anchors.get(key);

        if (anchor && isHorizontalOnlyMerge(anchor)) {
          const w = widths
            .slice(colIdx, colIdx + anchor.colSpan)
            .reduce((a, b) => a + b, 0);
          return (
            <Cell
              key={colIdx}
              cell={cellAt(rowIdx, colIdx)}
              width={w}
              spanWidth={w}
              minHeight={vr.size}
              rowSpan={1}
              colSpan={anchor.colSpan}
              isMerged
              highlight={cellHighlight(rowIdx, colIdx)}
              inHeaderRow={rowIdx === headerRow}
              dataRow={rowIdx}
              dataCol={colIdx}
              trailing={headerFunnelFor(colIdx, rowIdx)}
            />
          );
        }

        const absorbedAnchorKey = merges.absorbed.get(key);
        if (absorbedAnchorKey) {
          const parent = merges.anchors.get(absorbedAnchorKey);
          if (parent && isHorizontalOnlyMerge(parent)) {
            return null;
          }
        }

        const isPlaceholder =
          merges.anchors.has(key) || merges.absorbed.has(key);
        if (isPlaceholder) {
          return (
            <Cell
              key={colIdx}
              cell={undefined}
              width={widths[colIdx]}
              minHeight={vr.size}
              placeholder
              dataRow={rowIdx}
              dataCol={colIdx}
            />
          );
        }

        return (
          <Cell
            key={colIdx}
            cell={cellAt(rowIdx, colIdx)}
            width={widths[colIdx]}
            minHeight={vr.size}
            highlight={cellHighlight(rowIdx, colIdx)}
            inHeaderRow={rowIdx === headerRow}
            dataRow={rowIdx}
            dataCol={colIdx}
            trailing={headerFunnelFor(colIdx, rowIdx)}
          />
        );
      })}
    </div>
  );
}
