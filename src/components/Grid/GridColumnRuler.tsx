import { columnLetter } from "./grid-utils";
import { ResizeHandle } from "./ResizeHandle";
import type { ResizeOrientation } from "./ResizeHandle";

export interface GridColumnRulerProps {
  widths: number[];
  headerHeight: number;
  rowNumColWidth: number;
  bodyWidth: number;
  resizeDisabled?: boolean;
  /** Expanded selection bounds used to highlight columns in-selection. */
  expandedBounds?: { c1: number; c2: number } | null;
  onCornerPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onColHeaderPointerDown: (e: React.PointerEvent<HTMLDivElement>, col: number) => void;
  onResizePreview: (orientation: ResizeOrientation, index: number, size: number) => void;
  onResizeCommit: (orientation: ResizeOrientation, index: number, size: number) => void;
  onResizeAutofit: (orientation: ResizeOrientation, index: number) => void;
}

export function GridColumnRuler({
  widths,
  headerHeight,
  rowNumColWidth,
  bodyWidth,
  resizeDisabled,
  expandedBounds,
  onCornerPointerDown,
  onColHeaderPointerDown,
  onResizePreview,
  onResizeCommit,
  onResizeAutofit,
}: GridColumnRulerProps) {
  return (
    <div
      className="sticky top-0 z-30 flex bg-muted/85 backdrop-blur-md border-b border-border"
      style={{
        height: headerHeight,
        width: bodyWidth,
      }}
    >
      {/* Corner (select-all) */}
      <div
        onPointerDown={onCornerPointerDown}
        className="sticky left-0 z-40 shrink-0 border-r border-border bg-muted/90 cursor-cell"
        style={{ width: rowNumColWidth, height: headerHeight }}
      />
      {widths.map((w, i) => {
        const colInSel =
          expandedBounds &&
          i >= expandedBounds.c1 &&
          i <= expandedBounds.c2;
        return (
          <div
            key={i}
            data-col-header={i}
            onPointerDown={(e) => onColHeaderPointerDown(e, i)}
            className={`relative flex shrink-0 items-center justify-center border-r border-border text-[10px] font-medium uppercase cursor-cell select-none ${
              colInSel
                ? "bg-primary/15 text-foreground"
                : "text-muted-foreground"
            }`}
            style={{ width: w, height: headerHeight }}
          >
            {columnLetter(i)}
            {w > 0 && (
              <ResizeHandle
                orientation="col"
                index={i}
                currentSize={w}
                disabled={resizeDisabled}
                onPreview={onResizePreview}
                onCommit={onResizeCommit}
                onAutofit={onResizeAutofit}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
