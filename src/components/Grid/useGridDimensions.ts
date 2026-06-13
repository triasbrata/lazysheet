import { useCallback, useMemo, useState } from "react";
import type { RefObject } from "react";
import { toast } from "sonner";
import type { CellModel, SheetModel } from "@/lib/types";
import { cellText } from "@/lib/types";
import {
  awaitFontsReady,
  measureAutofitColumn,
  measureAutofitRow,
  sampleCellFont,
  type MeasureOptions,
} from "@/lib/measure";
import {
  clampResize,
  DEFAULT_COL_WIDTH,
  effectiveColWidth,
  effectiveRowHeight,
  FUNNEL_ALLOWANCE_X,
  FUNNEL_ROW_MIN_HEIGHT,
  ROW_NUM_COL_WIDTH,
  sampleRowIndices,
  selectionColRange,
  selectionRowRange,
  type Selection,
} from "./grid-utils";
import type { ResizeOrientation } from "./ResizeHandle";
import type { HeaderGroup } from "@/lib/grid-filter";

export interface UseGridDimensionsApi {
  widths: number[];
  heights: number[];
  cumColX: number[];
  totalContentWidth: number;
  rowNumColWidth: number;
  bodyWidth: number;
  headerHeight: number;
  rowPreview: { idx: number; h: number } | null;
  handleResizePreview: (orientation: ResizeOrientation, idx: number, size: number) => void;
  handleResizeCommit: (orientation: ResizeOrientation, idx: number, size: number) => void;
  handleResizeAutofit: (orientation: ResizeOrientation, idx: number) => void;
  handleAutofitCols: (cols: number[]) => void;
  handleAutofitRows: (rows: number[]) => void;
}

export function useGridDimensions(opts: {
  sheet: SheetModel;
  totalRows: number;
  totalCols: number;
  colOverrides: Record<number, number> | undefined;
  rowOverrides: Record<number, number> | undefined;
  zoom: number;
  headerRow: number | null;
  groupByAnchor: Map<number, HeaderGroup>;
  selectionRef: RefObject<Selection | null>;
  onColResize: ((col: number, width: number) => void) | undefined;
  onRowResize: ((row: number, height: number) => void) | undefined;
  onColReset: ((col: number) => void) | undefined;
  onRowReset: ((row: number) => void) | undefined;
}): UseGridDimensionsApi {
  const {
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
  } = opts;

  // Live preview state — non-null only while user drags a resize handle.
  const [colPreview, setColPreview] = useState<{ idx: number; w: number } | null>(
    null,
  );
  const [rowPreview, setRowPreview] = useState<{ idx: number; h: number } | null>(
    null,
  );

  const widths = useMemo(
    () =>
      Array.from({ length: totalCols }, (_, i) => {
        if (colPreview && colPreview.idx === i) return colPreview.w; // already screen px
        return Math.round(effectiveColWidth(sheet, i, colOverrides) * zoom);
      }),
    [sheet, totalCols, colOverrides, colPreview, zoom],
  );
  const heights = useMemo(
    () =>
      Array.from({ length: totalRows }, (_, i) => {
        if (rowPreview && rowPreview.idx === i) return rowPreview.h; // already screen px
        return Math.round(effectiveRowHeight(sheet, i, rowOverrides) * zoom);
      }),
    [sheet, totalRows, rowOverrides, rowPreview, zoom],
  );

  const handleResizePreview = useCallback(
    (orientation: ResizeOrientation, idx: number, size: number) => {
      if (orientation === "col") setColPreview({ idx, w: size });
      else setRowPreview({ idx, h: size });
    },
    [],
  );

  const handleResizeCommit = useCallback(
    (orientation: ResizeOrientation, idx: number, size: number) => {
      // size is screen px (drag result). Convert to logical px so overrides are
      // stored zoom-independent (logical px).
      if (orientation === "col") {
        setColPreview(null);
        onColResize?.(idx, Math.round(size / zoom));
      } else {
        setRowPreview(null);
        onRowResize?.(idx, Math.round(size / zoom));
      }
    },
    [onColResize, onRowResize, zoom],
  );

  // ── Autofit orchestrator ────────────────────────────────────────────────
  // Extract per-cell measurement options from a CellModel's style overrides.
  // Returns undefined when the cell carries no style worth merging.
  const cellMeasureOpts = useCallback(
    (cell: CellModel | undefined): Partial<MeasureOptions> | undefined => {
      const s = cell?.s;
      if (!s) return undefined;
      const out: Partial<MeasureOptions> = {};
      if (s.font_size !== undefined) out.fontSize = s.font_size;
      if (s.font_name) out.fontFamily = s.font_name;
      if (s.bold) out.fontWeight = 700;
      if (s.wrap) out.wrap = true;
      return Object.keys(out).length > 0 ? out : undefined;
    },
    [],
  );

  // Compute fit-to-content width for one column. Returns 0 when the column is
  // empty so the caller can fall back to the default width.
  //
  // `baseFont` comes from a live cell's computed style so measurement matches
  // what the user sees. Without this, the measurement element inherits from
  // <body> — which may still be on a fallback font before Geist resolves,
  // producing widths ~16–20% narrower than the actual render.
  const computeAutofitColWidth = useCallback(
    (colIdx: number, baseFont: MeasureOptions): number => {
      if (colIdx < 0 || colIdx >= totalCols) return 0;
      const sampleRows = sampleRowIndices(totalRows);
      const texts: string[] = [];
      const perCell: Array<Partial<MeasureOptions> | undefined> = [];
      const colHasWrap = sheet.rows.some((r) => r?.[colIdx]?.s?.wrap);
      for (const r of sampleRows) {
        const c = sheet.rows[r]?.[colIdx];
        if (!c) {
          texts.push("");
          perCell.push(undefined);
          continue;
        }
        texts.push(cellText(c));
        perCell.push(cellMeasureOpts(c));
      }
      const base: MeasureOptions = { ...baseFont, wrap: colHasWrap };
      const measured = measureAutofitColumn(texts, base, perCell);
      // A funnel-bearing header cell shows the inline funnel on its right, so
      // the column must be wide enough for the header text PLUS the funnel.
      if (headerRow == null || !groupByAnchor.has(colIdx)) return measured;
      const hc = sheet.rows[headerRow]?.[colIdx];
      const headerNeeded =
        measureAutofitColumn(
          [hc ? cellText(hc) : ""],
          { ...baseFont, wrap: false },
          [cellMeasureOpts(hc)],
        ) + FUNNEL_ALLOWANCE_X;
      return Math.max(measured, headerNeeded);
    },
    [sheet, totalRows, totalCols, cellMeasureOpts, headerRow, groupByAnchor],
  );

  // Compute fit-to-content height for one row. Uses current effective column
  // widths so wrap-on cells produce their actual rendered height. Returns 0
  // when the row has no content.
  const computeAutofitRowHeight = useCallback(
    (rowIdx: number, baseFont: MeasureOptions): number => {
      if (rowIdx < 0 || rowIdx >= totalRows) return 0;
      const row = sheet.rows[rowIdx];
      if (!row) return 0;
      const texts: string[] = [];
      const perCell: Array<Partial<MeasureOptions> | undefined> = [];
      const widthsForMeasure: number[] = [];
      for (let c = 0; c < totalCols; c++) {
        const cell = row[c];
        texts.push(cell ? cellText(cell) : "");
        perCell.push(cellMeasureOpts(cell));
        // widths are zoomed screen px; measurement must happen in logical px
        widthsForMeasure.push((widths[c] ?? Math.round(DEFAULT_COL_WIDTH * zoom)) / zoom);
      }
      const base: MeasureOptions = {
        ...baseFont,
        wrap: row.some((cc) => cc?.s?.wrap),
      };
      const measured = measureAutofitRow(texts, widthsForMeasure, base, perCell);
      // The header row carries inline funnels; keep it tall enough for the icon
      // (icon box + 2× cell vertical padding of 6px).
      if (rowIdx === headerRow && groupByAnchor.size > 0) {
        return Math.max(measured, FUNNEL_ROW_MIN_HEIGHT);
      }
      return measured;
    },
    [sheet, totalRows, totalCols, widths, cellMeasureOpts, headerRow, groupByAnchor, zoom],
  );

  const handleAutofitCols = useCallback(
    (cols: number[]) => {
      if (cols.length === 0) return;
      const unique = Array.from(new Set(cols)).filter(
        (c) => c >= 0 && c < totalCols,
      );
      if (unique.length === 0) return;
      // Wait for fonts to resolve so measurement uses the real Geist glyphs,
      // not the fallback. Then sample the actual computed font from a live
      // cell — body font may still report the fallback during the first
      // microtasks after fonts.ready resolves.
      void awaitFontsReady().then(() => {
        const baseFont: MeasureOptions = sampleCellFont();
        // sampleCellFont() samples a live (zoomed) cell — font-size is in screen px.
        // Normalize to logical px so measurement produces zoom-independent overrides.
        if (zoom !== 1 && baseFont.fontSize) baseFont.fontSize = baseFont.fontSize / zoom;
        let applied = 0;
        let reset = 0;
        for (const col of unique) {
          const measured = computeAutofitColWidth(col, baseFont);
          if (measured <= 0) {
            if (onColReset) {
              onColReset(col);
              reset++;
            }
            continue;
          }
          const w = clampResize(Math.ceil(measured));
          onColResize?.(col, w);
          applied++;
        }
        const total = applied + reset;
        if (total === 0) return;
        const label = total === 1 ? "1 column" : `${total} columns`;
        toast.success(`Autofit ${label}`);
      });
    },
    [totalCols, computeAutofitColWidth, onColResize, onColReset, zoom],
  );

  const handleAutofitRows = useCallback(
    (rows: number[]) => {
      if (rows.length === 0) return;
      const unique = Array.from(new Set(rows)).filter(
        (r) => r >= 0 && r < totalRows,
      );
      if (unique.length === 0) return;
      void awaitFontsReady().then(() => {
        const baseFont: MeasureOptions = sampleCellFont();
        // sampleCellFont() samples a live (zoomed) cell — font-size is in screen px.
        // Normalize to logical px so measurement produces zoom-independent overrides.
        if (zoom !== 1 && baseFont.fontSize) baseFont.fontSize = baseFont.fontSize / zoom;
        let applied = 0;
        let reset = 0;
        for (const row of unique) {
          const measured = computeAutofitRowHeight(row, baseFont);
          if (measured <= 0) {
            if (onRowReset) {
              onRowReset(row);
              reset++;
            }
            continue;
          }
          const h = clampResize(Math.ceil(measured));
          onRowResize?.(row, h);
          applied++;
        }
        const total = applied + reset;
        if (total === 0) return;
        const label = total === 1 ? "1 row" : `${total} rows`;
        toast.success(`Autofit ${label}`);
      });
    },
    [totalRows, computeAutofitRowHeight, onRowResize, onRowReset, zoom],
  );

  // ResizeHandle dblclick entry point. Expands to selection range when the
  // user has selected multiple cols/rows and the target lies within.
  const handleResizeAutofit = useCallback(
    (orientation: ResizeOrientation, idx: number) => {
      if (orientation === "col") {
        const range = selectionColRange(selectionRef.current, totalCols);
        if (range && idx >= range[0] && idx <= range[1]) {
          const cols: number[] = [];
          for (let c = range[0]; c <= range[1]; c++) cols.push(c);
          handleAutofitCols(cols);
        } else {
          handleAutofitCols([idx]);
        }
        return;
      }
      const range = selectionRowRange(selectionRef.current, totalRows);
      if (range && idx >= range[0] && idx <= range[1]) {
        const rows: number[] = [];
        for (let r = range[0]; r <= range[1]; r++) rows.push(r);
        handleAutofitRows(rows);
      } else {
        handleAutofitRows([idx]);
      }
    },
    [totalCols, totalRows, handleAutofitCols, handleAutofitRows],
  );

  const cumColX = useMemo(() => {
    const arr = [0];
    for (let i = 0; i < widths.length; i++) {
      arr.push(arr[i] + widths[i]);
    }
    return arr;
  }, [widths]);

  const totalContentWidth = cumColX[cumColX.length - 1] ?? 0;
  // Zoomed row-number column width (base ROW_NUM_COL_WIDTH × zoom).
  const rowNumColWidth = Math.round(ROW_NUM_COL_WIDTH * zoom);
  const bodyWidth = rowNumColWidth + totalContentWidth;

  // Base 26px × zoom.
  const headerHeight = Math.round(26 * zoom);

  return {
    widths,
    heights,
    cumColX,
    totalContentWidth,
    rowNumColWidth,
    bodyWidth,
    headerHeight,
    rowPreview,
    handleResizePreview,
    handleResizeCommit,
    handleResizeAutofit,
    handleAutofitCols,
    handleAutofitRows,
  };
}
