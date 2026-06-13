import { useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { cellText, type CellModel, type SheetModel } from "@/lib/types";
import { CellEditor } from "./CellEditor";
import { GridRow } from "./GridRow";
import {
  ContextMenu,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  GridContextMenuContent,
} from "./GridContextMenu";
import type { MarkdownFormat } from "@/lib/markdown-export";
import type { QueryKind } from "@/lib/sql-copy";
import {
  computeCellHighlight,
  selectionColRange,
  selectionRowRange,
  type FilterSource,
  type Selection,
} from "./grid-utils";
import { useGridFilters } from "./useGridFilters";
import { useGridSelection } from "./useGridSelection";
import { useGridDimensions } from "./useGridDimensions";
import { useGridPointer } from "./useGridPointer";
import { useGridEditing } from "./useGridEditing";
import { GridColumnRuler } from "./GridColumnRuler";
import { SelectionFrame } from "./SelectionFrame";
import { MergeLayer } from "./MergeLayer";
import { useGridContextMenu } from "./useGridContextMenu";
import { useGridKeyboard } from "./useGridKeyboard";
import { useGridZoom } from "./useGridZoom";
import { GridFilterControl } from "./GridFilterControl";
import { GridHeaderBand } from "./GridHeaderBand";
import {
  type SheetFilters,
  type ColumnFilter,
} from "@/lib/grid-filter";
import { useGridVirtualRows } from "./useGridVirtualRows";

export type { Selection } from "./grid-utils";

export interface GridMatch {
  row: number;
  col: number;
}

interface GridProps {
  sheet: SheetModel;
  selection?: Selection | null;
  matches?: GridMatch[];
  onSelectionChange?: (
    next: Selection,
    scroll: "none" | "ifNeeded" | "center",
  ) => void;
  // User-marked header row (sheet-local, owned by App). 0-indexed.
  headerRow?: number | null;
  onMarkHeader?: (row: number | null) => void;
  // Current default copy format (drives the context-menu star).
  defaultCopyFormat?: MarkdownFormat;
  // Context-menu copy: plain click → copy; Cmd/Ctrl+click → copy + set default.
  onCopyFormat?: (format: MarkdownFormat, setAsDefault: boolean) => void;
  // Context-menu star click → set default only (no copy).
  onSetDefaultFormat?: (format: MarkdownFormat) => void;
  // Cmd/Ctrl+C → copy using the saved default format.
  onCopyDefault?: () => void;
  onSummarize?: () => void;
  canSummarize?: boolean;
  // Resize feature
  colOverrides?: Record<number, number>;
  rowOverrides?: Record<number, number>;
  resizeDisabled?: boolean;
  onColResize?: (col: number, width: number) => void;
  onRowResize?: (row: number, height: number) => void;
  onColReset?: (col: number) => void;
  onRowReset?: (row: number) => void;
  onResetAllDimensions?: () => void;
  // Manual-input dialog open callbacks (App owns dialog state).
  onOpenColWidthDialog?: (col: number) => void;
  onOpenRowHeightDialog?: (row: number) => void;
  // Per-column row filters for the active sheet. Filtering is merge-aware: merged
  // rows/cols are exempt (see grid-filter). colAnchor (0-indexed) → ColumnFilter.
  filters?: SheetFilters;
  onColumnFilterChange?: (colAnchor: number, filter: ColumnFilter) => void;
  canCopyQuery?: boolean;
  onCopyQuery?: (kind: QueryKind) => void;
  // Grid zoom factor (0.5–2.0). 1 = 100%. Multiplies the dimension pipeline at render.
  zoom?: number;
  onZoomChange?: (next: number) => void;
  // Inline cell editing
  editEnabled?: boolean;
  editingCell?: { row: number; col: number } | null;
  getEditedCell?: (row: number, col: number) => CellModel | undefined;
  onEditStart?: (row: number, col: number) => void;
  onEditCommit?: (row: number, col: number, raw: string, nav: "down" | "right" | "none") => void;
  onEditCancel?: () => void;
}

export function Grid({
  sheet,
  selection,
  matches,
  onSelectionChange,
  headerRow = null,
  onMarkHeader,
  defaultCopyFormat,
  onCopyFormat,
  onSetDefaultFormat,
  onCopyDefault,
  onSummarize,
  canSummarize,
  colOverrides,
  rowOverrides,
  resizeDisabled,
  onColResize,
  onRowResize,
  onColReset,
  onRowReset,
  onResetAllDimensions,
  onOpenColWidthDialog,
  onOpenRowHeightDialog,
  filters,
  onColumnFilterChange,
  canCopyQuery,
  onCopyQuery,
  zoom = 1,
  onZoomChange,
  editEnabled,
  editingCell,
  getEditedCell,
  onEditStart,
  onEditCommit,
  onEditCancel,
}: GridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalRows = sheet.rows.length;
  const totalCols = sheet.max_col;

  const matchSet = useMemo(() => {
    const s = new Set<string>();
    if (matches) for (const m of matches) s.add(`${m.row}:${m.col}`);
    return s;
  }, [matches]);

  const {
    merges,
    groupByAnchor,
    activeFilters,
    visibleRowIndices,
    visiblePos,
    openFilter,
    setOpenFilter,
    openFilterDistinct,
    expandedBounds,
  } = useGridFilters({
    sheet,
    headerRow,
    totalRows,
    totalCols,
    filters,
    selection,
  });

  const { emit, setSingleCell, extendTo, selectAll, selectionRef } = useGridSelection({
    selection,
    onSelectionChange,
    merges,
    totalRows,
    totalCols,
  });

  const {
    widths,
    heights,
    cumColX,
    rowNumColWidth,
    bodyWidth,
    headerHeight,
    rowPreview,
    handleResizePreview,
    handleResizeCommit,
    handleResizeAutofit,
    handleAutofitCols,
    handleAutofitRows,
  } = useGridDimensions({
    sheet,
    totalRows,
    totalCols,
    colOverrides,
    rowOverrides,
    zoom,
    headerRow,
    groupByAnchor,
    selectionRef,
    onColResize,
    onRowResize,
    onColReset,
    onRowReset,
  });

  const {
    resolveCellAt,
    resolveHeaderAt,
    dragStateRef: dragState,
    stopAutoScroll,
    handleBodyPointerDown,
    handleBodyPointerMove,
    endDrag,
    handleColHeaderPointerDown,
    handleRowHeaderPointerDown,
    handleCornerPointerDown,
  } = useGridPointer({
    scrollRef,
    selectionRef,
    onSelectionChange,
    emit,
    setSingleCell,
    extendTo,
    selectAll,
    totalRows,
    totalCols,
    headerHeight,
  });

  useGridZoom({ scrollRef, zoom, onZoomChange });

  const {
    menuCtx,
    handleContextMenuCapture,
    canCopy,
    menuFormula,
    copyFormulaAt,
  } = useGridContextMenu({
    sheet,
    totalCols,
    selection,
    expandedBounds,
    resolveHeaderAt,
    resolveCellAt,
    emit,
    setSingleCell,
  });

  const { cellAt, handleBodyDoubleClick } = useGridEditing({
    sheet,
    getEditedCell,
    editEnabled,
    totalRows,
    totalCols,
    merges,
    onEditStart,
  });

  // ── Keyboard handler ────────────────────────────────────────────────────
  const { handleKeyDown } = useGridKeyboard({
    sheet,
    totalRows,
    totalCols,
    merges,
    headerHeight,
    selection,
    selectionRef,
    emit,
    setSingleCell,
    extendTo,
    selectAll,
    dragState,
    stopAutoScroll,
    scrollRef,
    editEnabled,
    editingCell,
    onEditStart,
    onSelectionChange,
    onCopyDefault,
    copyFormulaAt,
  });

  // ── Virtualizer + scroll-sync cluster ───────────────────────────────────
  const {
    rowVirtualizer,
    virtualRows,
    totalBodyHeight,
    headerStuck,
    handleScroll,
  } = useGridVirtualRows({
    scrollRef,
    sheet,
    totalRows,
    totalCols,
    visibleRowIndices,
    visiblePos,
    heights,
    widths,
    cumColX,
    rowNumColWidth,
    zoom,
    headerRow,
    rowPreview,
    rowOverrides,
    groupByAnchor,
    selection,
  });

  const measurements = rowVirtualizer.measurementsCache;

  // ── Highlight derivation per cell ────────────────────────────────────────
  const rangeIsMultiCell =
    !!expandedBounds &&
    (expandedBounds.r1 !== expandedBounds.r2 ||
      expandedBounds.c1 !== expandedBounds.c2);

  const cellHighlight = (r: number, c: number) =>
    computeCellHighlight(r, c, {
      anchor: selection?.anchor ?? null,
      bounds: expandedBounds,
      multi: rangeIsMultiCell,
      matchSet,
    });

  // Shared helper — renders a funnel button + ColumnFilterDropdown for column i
  // triggered from the given source ("band" or "ruler").
  const renderFilterControl = (i: number, source: FilterSource, iconColor?: string) => {
    const isOpen = openFilter?.col === i && openFilter.source === source;
    return (
      <GridFilterControl
        col={i}
        isOpen={isOpen}
        onOpenChange={(o) => setOpenFilter(o ? { col: i, source } : null)}
        colFilter={activeFilters[i]}
        distinctValues={isOpen ? openFilterDistinct : []}
        onApply={(col, f) => onColumnFilterChange?.(col, f)}
        iconColor={iconColor}
      />
    );
  };

  // Inline header funnel for a cell: shown on the in-flow header row only while
  // it is NOT scrolled off (the sticky band carries the funnel when stuck).
  const headerFunnelFor = (colIdx: number, rowIdx: number): ReactNode => {
    if (headerRow == null || headerStuck || rowIdx !== headerRow) return undefined;
    if (!groupByAnchor.has(colIdx)) return undefined;
    return renderFilterControl(colIdx, "row", sheet.rows[headerRow]?.[colIdx]?.s?.fg);
  };

  return (
    <div className="relative flex-1 overflow-hidden bg-background">
      <div
        ref={scrollRef}
        data-testid="grid-scroll-container"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        className="h-full w-full overflow-auto outline-none focus:outline-none"
        style={{ contain: "strict", ["--grid-zoom" as string]: zoom, fontSize: "calc(1em * var(--grid-zoom))" }}
      >
        {/* Sticky header — column letters */}
        <GridColumnRuler
          widths={widths}
          headerHeight={headerHeight}
          rowNumColWidth={rowNumColWidth}
          bodyWidth={bodyWidth}
          resizeDisabled={resizeDisabled}
          expandedBounds={expandedBounds}
          onCornerPointerDown={handleCornerPointerDown}
          onColHeaderPointerDown={handleColHeaderPointerDown}
          onResizePreview={handleResizePreview}
          onResizeCommit={handleResizeCommit}
          onResizeAutofit={handleResizeAutofit}
        />

        {/* Body — wrapped in ContextMenu so right-click opens the menu */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              onPointerDown={handleBodyPointerDown}
              onPointerMove={handleBodyPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onLostPointerCapture={endDrag}
              onContextMenuCapture={handleContextMenuCapture}
              onDoubleClick={handleBodyDoubleClick}
              style={{
                height: totalBodyHeight,
                width: bodyWidth,
                position: "relative",
                userSelect: "none",
              }}
            >
          {/* Sticky header band — mirrors the marked header row under the A/B/C ruler */}
          {headerRow != null && headerStuck && (
            <GridHeaderBand
              headerRow={headerRow}
              headerHeight={headerHeight}
              bodyWidth={bodyWidth}
              rowNumColWidth={rowNumColWidth}
              totalCols={totalCols}
              widths={widths}
              sheet={sheet}
              rowOverrides={rowOverrides}
              merges={merges}
              groupByAnchor={groupByAnchor}
              zoom={zoom}
              renderFilterControl={renderFilterControl}
            />
          )}

          {/* Row map */}
          {virtualRows.map((vr) => {
            const rowIdx = visibleRowIndices[vr.index];
            const rowInSel = !!(
              expandedBounds &&
              rowIdx >= expandedBounds.r1 &&
              rowIdx <= expandedBounds.r2
            );
            return (
              <GridRow
                key={vr.key}
                vr={vr}
                rowIdx={rowIdx}
                bodyWidth={bodyWidth}
                rowNumColWidth={rowNumColWidth}
                totalCols={totalCols}
                widths={widths}
                merges={merges}
                rowInSel={rowInSel}
                headerRow={headerRow}
                resizeDisabled={resizeDisabled}
                measureElement={rowVirtualizer.measureElement}
                cellAt={cellAt}
                cellHighlight={cellHighlight}
                headerFunnelFor={headerFunnelFor}
                onRowHeaderPointerDown={handleRowHeaderPointerDown}
                onResizePreview={handleResizePreview}
                onResizeCommit={handleResizeCommit}
              />
            );
          })}

          {/* Merge anchor layer */}
          <MergeLayer
            merges={merges}
            measurements={measurements}
            visiblePos={visiblePos}
            sheet={sheet}
            widths={widths}
            cumColX={cumColX}
            leftOffset={rowNumColWidth}
            cellHighlight={cellHighlight}
            headerRow={headerRow}
          />

          {/* Selection frame — outlines the whole range when > 1 cell */}
          <SelectionFrame
            bounds={expandedBounds}
            mode={selection?.mode ?? null}
            widths={widths}
            cumColX={cumColX}
            visiblePos={visiblePos}
            measurements={measurements}
            leftOffset={rowNumColWidth}
          />

          {/* Inline cell editor — rendered when editEnabled and editingCell is set */}
          {(() => {
            if (!editEnabled || !editingCell) return null;
            const { row: er, col: ec } = editingCell;
            const vpos = visiblePos.get(er);
            if (vpos === undefined) return null;
            const meas = measurements[vpos];
            if (!meas) return null;
            const editorTop = meas.start;
            const editorHeight = meas.size;
            const editorLeft = rowNumColWidth + (cumColX[ec] ?? 0);
            const editorWidth = widths[ec] ?? 0;
            const rawCell = cellAt(er, ec);
            const initialText = rawCell ? cellText(rawCell) : "";
            return (
              <CellEditor
                key={`${er}:${ec}`}
                initialText={initialText}
                left={editorLeft}
                top={editorTop}
                width={editorWidth}
                height={editorHeight}
                onCommit={(raw, nav) => onEditCommit?.(er, ec, raw, nav)}
                onCancel={() => onEditCancel?.()}
              />
            );
          })()}
            </div>
          </ContextMenuTrigger>
          <GridContextMenuContent
            ctx={menuCtx}
            headerRow={headerRow}
            canCopy={canCopy}
            canSummarize={canSummarize}
            onMarkHeader={(row) => onMarkHeader?.(row)}
            defaultCopyFormat={defaultCopyFormat}
            onCopyFormat={(fmt, setDef) => onCopyFormat?.(fmt, setDef)}
            onSetDefaultFormat={(fmt) => onSetDefaultFormat?.(fmt)}
            onSummarize={onSummarize ? () => onSummarize() : undefined}
            hasColOverride={
              menuCtx?.type === "col" &&
              colOverrides?.[menuCtx.col] !== undefined
            }
            hasRowOverride={
              menuCtx?.type === "row" &&
              rowOverrides?.[menuCtx.row] !== undefined
            }
            hasAnyOverride={
              (colOverrides && Object.keys(colOverrides).length > 0) ||
              (rowOverrides && Object.keys(rowOverrides).length > 0)
            }
            onResetColWidth={
              menuCtx?.type === "col" && onColReset
                ? () => onColReset(menuCtx.col)
                : undefined
            }
            onResetRowHeight={
              menuCtx?.type === "row" && onRowReset
                ? () => onRowReset(menuCtx.row)
                : undefined
            }
            onResetAllDimensions={onResetAllDimensions}
            multiColCount={(() => {
              if (menuCtx?.type !== "col") return undefined;
              const range = selectionColRange(selection ?? null, totalCols);
              if (!range || menuCtx.col < range[0] || menuCtx.col > range[1]) {
                return undefined;
              }
              return range[1] - range[0] + 1;
            })()}
            multiRowCount={(() => {
              if (menuCtx?.type !== "row") return undefined;
              const range = selectionRowRange(selection ?? null, totalRows);
              if (!range || menuCtx.row < range[0] || menuCtx.row > range[1]) {
                return undefined;
              }
              return range[1] - range[0] + 1;
            })()}
            onAutofitCol={(() => {
              if (menuCtx?.type === "col") {
                return () => handleResizeAutofit("col", menuCtx.col);
              }
              if (menuCtx?.type === "cell") {
                return () => handleAutofitCols([menuCtx.col]);
              }
              return undefined;
            })()}
            onAutofitRow={(() => {
              if (menuCtx?.type === "row") {
                return () => handleResizeAutofit("row", menuCtx.row);
              }
              if (menuCtx?.type === "cell") {
                return () => handleAutofitRows([menuCtx.row]);
              }
              return undefined;
            })()}
            onOpenColWidthDialog={
              (menuCtx?.type === "col" || menuCtx?.type === "cell") &&
              onOpenColWidthDialog
                ? () =>
                    onOpenColWidthDialog(
                      menuCtx.type === "col" ? menuCtx.col : menuCtx.col,
                    )
                : undefined
            }
            onOpenRowHeightDialog={
              (menuCtx?.type === "row" || menuCtx?.type === "cell") &&
              onOpenRowHeightDialog
                ? () =>
                    onOpenRowHeightDialog(
                      menuCtx.type === "row" ? menuCtx.row : menuCtx.row,
                    )
                : undefined
            }
            canCopyFormula={!!menuFormula}
            onCopyFormula={() => {
              if (menuCtx?.type === "cell") copyFormulaAt(menuCtx.row, menuCtx.col);
            }}
            canCopyQuery={canCopyQuery && canCopy}
            onCopyQuery={onCopyQuery}
          />
        </ContextMenu>
      </div>
    </div>
  );
}
