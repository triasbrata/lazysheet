import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import { cellText, type CellModel, type SheetModel } from "@/lib/types";
import { Cell } from "./Cell";
import {
  ContextMenu,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  GridContextMenuContent,
  type GridContextMenuTarget,
} from "./GridContextMenu";
import type { MarkdownFormat } from "@/lib/markdown-export";
import type { QueryKind } from "@/lib/sql-copy";
import {
  boundsInclude,
  buildMergeInfo,
  changedRowIndices,
  clampResize,
  columnLetter,
  DEFAULT_COL_WIDTH,
  DEFAULT_ROW_HEIGHT,
  effectiveColWidth,
  effectiveRowHeight,
  expandBoundsForMerges,
  firstVisibleCol,
  firstVisibleRow,
  isHorizontalOnlyMerge,
  lastVisibleCol,
  lastVisibleRow,
  mergeSpanAt,
  nextVisibleCol,
  nextVisibleRow,
  headerBandStuck,
  FUNNEL_ALLOWANCE_X,
  FUNNEL_ROW_MIN_HEIGHT,
  resolveActiveCoords,
  ROW_NUM_COL_WIDTH,
  sampleRowIndices,
  selectionBounds,
  selectionColRange,
  selectionRowRange,
  selectionRowSpan,
  type Bounds,
  type MergeInfo,
  type Selection,
} from "./grid-utils";
import { ResizeHandle, type ResizeOrientation } from "./ResizeHandle";
import {
  awaitFontsReady,
  measureAutofitColumn,
  measureAutofitRow,
  sampleCellFont,
  type MeasureOptions,
} from "@/lib/measure";
import { getCellFormula, copyFormula } from "@/lib/formula-copy";
import { Filter } from "lucide-react";
import { motion } from "motion/react";
import { ColumnFilterDropdown } from "./ColumnFilterDropdown";
import {
  buildMergedRowSet,
  headerGroups,
  columnDistinctValues,
  computeVisibleRows,
  type SheetFilters,
  type ColumnFilter,
  type HeaderGroup,
} from "@/lib/grid-filter";

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
}

type DragMode = "cell" | "rowHeader" | "colHeader";

interface DragState {
  active: boolean;
  mode: DragMode;
  pointerId: number;
}

const AUTO_SCROLL_EDGE = 24;
const AUTO_SCROLL_MAX = 20;

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
}: GridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalRows = sheet.rows.length;
  const totalCols = sheet.max_col;

  const matchSet = useMemo(() => {
    const s = new Set<string>();
    if (matches) for (const m of matches) s.add(`${m.row}:${m.col}`);
    return s;
  }, [matches]);

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
        if (colPreview && colPreview.idx === i) return colPreview.w;
        return effectiveColWidth(sheet, i, colOverrides);
      }),
    [sheet, totalCols, colOverrides, colPreview],
  );
  const heights = useMemo(
    () =>
      Array.from({ length: totalRows }, (_, i) => {
        if (rowPreview && rowPreview.idx === i) return rowPreview.h;
        return effectiveRowHeight(sheet, i, rowOverrides);
      }),
    [sheet, totalRows, rowOverrides, rowPreview],
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
      if (orientation === "col") {
        setColPreview(null);
        onColResize?.(idx, size);
      } else {
        setRowPreview(null);
        onRowResize?.(idx, size);
      }
    },
    [onColResize, onRowResize],
  );

  // Merge map + header-group anchors — declared before the autofit orchestrator
  // because autofit reserves funnel space for funnel-bearing header columns.
  const merges = useMemo(() => buildMergeInfo(sheet.merges), [sheet.merges]);
  const filterGroups = useMemo(
    () => headerGroups(merges, headerRow, totalCols),
    [merges, headerRow, totalCols],
  );
  const groupByAnchor = useMemo(() => {
    const m = new Map<number, HeaderGroup>();
    for (const g of filterGroups) m.set(g.anchorCol, g);
    return m;
  }, [filterGroups]);

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
        widthsForMeasure.push(widths[c] ?? DEFAULT_COL_WIDTH);
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
    [sheet, totalRows, totalCols, widths, cellMeasureOpts, headerRow, groupByAnchor],
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
    [totalCols, computeAutofitColWidth, onColResize, onColReset],
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
    [totalRows, computeAutofitRowHeight, onRowResize, onRowReset],
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
  const bodyWidth = ROW_NUM_COL_WIDTH + totalContentWidth;

  const headerHeight = 26;

  // ── Filter-aware row visibility ─────────────────────────────────────────
  const mergedRowSet = useMemo(() => buildMergedRowSet(sheet.merges), [sheet.merges]);
  const activeFilters: SheetFilters = filters ?? {};
  const visibleRowIndices = useMemo(
    () => computeVisibleRows(sheet, mergedRowSet, headerRow, filterGroups, activeFilters, totalRows),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheet, mergedRowSet, headerRow, filterGroups, activeFilters, totalRows],
  );
  const visiblePos = useMemo(() => {
    const m = new Map<number, number>();
    visibleRowIndices.forEach((r, i) => m.set(r, i));
    return m;
  }, [visibleRowIndices]);
  // Fast lookup: anchorCol → HeaderGroup (for checking which col headers get a funnel button).
  // Which column's filter dropdown is currently open and from which trigger source.
  type FilterSource = "band" | "ruler" | "row";
  const [openFilter, setOpenFilter] = useState<{ col: number; source: FilterSource } | null>(null);
  const [headerStuck, setHeaderStuck] = useState(false);
  const headerStuckRef = useRef(false);
  // Distinct values for the currently-open column — computed lazily only when a dropdown is open.
  const openFilterDistinct = useMemo(() => {
    if (openFilter === null) return [];
    const g = groupByAnchor.get(openFilter.col);
    if (!g) return [];
    return columnDistinctValues(sheet, g, headerRow, totalRows, mergedRowSet);
  }, [openFilter, groupByAnchor, sheet, headerRow, totalRows, mergedRowSet]);

  // Expanded bounds — accounts for merges that intersect base selection.
  const expandedBounds: Bounds | null = useMemo(() => {
    if (!selection) return null;
    const base = selectionBounds(selection, totalRows, totalCols);
    return expandBoundsForMerges(base, merges);
  }, [selection, totalRows, totalCols, merges]);

  const emit = useCallback(
    (next: Selection, scroll: "none" | "ifNeeded" | "center") => {
      onSelectionChange?.(next, scroll);
    },
    [onSelectionChange],
  );

  // Refs — drag state must not trigger renders on every pointermove.
  const dragState = useRef<DragState | null>(null);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const autoScrollRaf = useRef<number | null>(null);
  // Track latest selection in ref so pointermove handler closure stays fresh
  // without depending on React state churn.
  const selectionRef = useRef<Selection | null>(selection ?? null);
  useEffect(() => {
    selectionRef.current = selection ?? null;
  }, [selection]);

  // ── Cell setters ─────────────────────────────────────────────────────────
  const setSingleCell = useCallback(
    (
      row: number,
      col: number,
      scroll: "none" | "ifNeeded" | "center",
    ) => {
      const resolved = resolveActiveCoords(merges, row, col);
      emit(
        {
          anchor: resolved,
          focus: resolved,
          mode: "cell",
          scroll,
          nonce: Date.now(),
        },
        scroll,
      );
    },
    [merges, emit],
  );

  const extendTo = useCallback(
    (
      row: number,
      col: number,
      mode: Selection["mode"],
      scroll: "none" | "ifNeeded" | "center",
    ) => {
      const cur = selectionRef.current;
      if (!cur) {
        setSingleCell(row, col, scroll);
        return;
      }
      const resolved = resolveActiveCoords(merges, row, col);
      emit(
        {
          anchor: cur.anchor,
          focus: resolved,
          mode,
          scroll,
          nonce: Date.now(),
        },
        scroll,
      );
    },
    [merges, emit, setSingleCell],
  );

  const selectAll = useCallback(() => {
    if (totalRows === 0 || totalCols === 0) return;
    emit(
      {
        anchor: { row: 0, col: 0 },
        focus: { row: totalRows - 1, col: totalCols - 1 },
        mode: "all",
        scroll: "none",
        nonce: Date.now(),
      },
      "none",
    );
  }, [emit, totalRows, totalCols]);

  // ── Pointer resolution ──────────────────────────────────────────────────
  const resolveCellAt = useCallback(
    (clientX: number, clientY: number): { row: number; col: number } | null => {
      const el = document.elementFromPoint(clientX, clientY);
      if (!el) return null;
      const cellEl = (el as HTMLElement).closest<HTMLElement>(
        "[data-r][data-c]",
      );
      if (!cellEl) return null;
      const r = parseInt(cellEl.getAttribute("data-r")!, 10);
      const c = parseInt(cellEl.getAttribute("data-c")!, 10);
      if (Number.isNaN(r) || Number.isNaN(c)) return null;
      return { row: r, col: c };
    },
    [],
  );

  const resolveHeaderAt = useCallback(
    (
      clientX: number,
      clientY: number,
    ): { kind: "row" | "col"; index: number } | null => {
      const el = document.elementFromPoint(clientX, clientY);
      if (!el) return null;
      const rowEl = (el as HTMLElement).closest<HTMLElement>(
        "[data-row-header]",
      );
      if (rowEl) {
        const i = parseInt(rowEl.getAttribute("data-row-header")!, 10);
        if (!Number.isNaN(i)) return { kind: "row", index: i };
      }
      const colEl = (el as HTMLElement).closest<HTMLElement>(
        "[data-col-header]",
      );
      if (colEl) {
        const i = parseInt(colEl.getAttribute("data-col-header")!, 10);
        if (!Number.isNaN(i)) return { kind: "col", index: i };
      }
      return null;
    },
    [],
  );

  // ── Auto-scroll during drag ─────────────────────────────────────────────
  const stopAutoScroll = useCallback(() => {
    if (autoScrollRaf.current !== null) {
      cancelAnimationFrame(autoScrollRaf.current);
      autoScrollRaf.current = null;
    }
  }, []);

  const runAutoScrollLoop = useCallback(() => {
    if (autoScrollRaf.current !== null) return;
    const tick = () => {
      const el = scrollRef.current;
      const ptr = lastPointer.current;
      const ds = dragState.current;
      if (!el || !ptr || !ds?.active) {
        autoScrollRaf.current = null;
        return;
      }
      const rect = el.getBoundingClientRect();
      let dx = 0;
      let dy = 0;
      if (ds.mode !== "rowHeader") {
        if (ptr.x < rect.left + AUTO_SCROLL_EDGE) {
          dx = -Math.min(AUTO_SCROLL_MAX, rect.left + AUTO_SCROLL_EDGE - ptr.x);
        } else if (ptr.x > rect.right - AUTO_SCROLL_EDGE) {
          dx = Math.min(AUTO_SCROLL_MAX, ptr.x - (rect.right - AUTO_SCROLL_EDGE));
        }
      }
      if (ds.mode !== "colHeader") {
        const topZone = rect.top + headerHeight + AUTO_SCROLL_EDGE;
        if (ptr.y < topZone) {
          dy = -Math.min(AUTO_SCROLL_MAX, topZone - ptr.y);
        } else if (ptr.y > rect.bottom - AUTO_SCROLL_EDGE) {
          dy = Math.min(AUTO_SCROLL_MAX, ptr.y - (rect.bottom - AUTO_SCROLL_EDGE));
        }
      }
      if (dx === 0 && dy === 0) {
        autoScrollRaf.current = null;
        return;
      }
      el.scrollBy({ left: dx, top: dy });
      // Re-resolve target under pointer after scroll.
      if (ds.mode === "cell") {
        const c = resolveCellAt(ptr.x, ptr.y);
        if (c) extendTo(c.row, c.col, "cell", "none");
      } else {
        const h = resolveHeaderAt(ptr.x, ptr.y);
        if (h)
          extendTo(
            h.kind === "row" ? h.index : 0,
            h.kind === "col" ? h.index : 0,
            h.kind === "row" ? "row" : "col",
            "none",
          );
      }
      autoScrollRaf.current = requestAnimationFrame(tick);
    };
    autoScrollRaf.current = requestAnimationFrame(tick);
  }, [headerHeight, resolveCellAt, resolveHeaderAt, extendTo]);

  // ── Body pointer handlers ───────────────────────────────────────────────
  const handleBodyPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!onSelectionChange) return;
      // Only left button starts drag-select. Right-click is routed through
      // onContextMenuCapture and must not initiate a pointer-capture drag.
      if (e.button !== 0) return;
      const tgt = e.target as HTMLElement | null;
      if (!tgt) return;
      // Skip if clicking an interactive element (hyperlink button).
      // Selection still applies on cell, but link gets its own click after.
      const cellEl = tgt.closest<HTMLElement>("[data-r][data-c]");
      if (!cellEl) return;
      const r = parseInt(cellEl.getAttribute("data-r")!, 10);
      const c = parseInt(cellEl.getAttribute("data-c")!, 10);
      if (Number.isNaN(r) || Number.isNaN(c)) return;

      scrollRef.current?.focus({ preventScroll: true });

      if (e.shiftKey && selectionRef.current) {
        extendTo(r, c, "cell", "none");
        return;
      }

      // Start drag
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      dragState.current = { active: true, mode: "cell", pointerId: e.pointerId };
      lastPointer.current = { x: e.clientX, y: e.clientY };
      setSingleCell(r, c, "none");
    },
    [onSelectionChange, extendTo, setSingleCell],
  );

  const handleBodyPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const ds = dragState.current;
      if (!ds?.active) return;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      if (ds.mode === "cell") {
        const c = resolveCellAt(e.clientX, e.clientY);
        if (c) {
          const cur = selectionRef.current;
          if (
            !cur ||
            cur.focus.row !== c.row ||
            cur.focus.col !== c.col
          ) {
            extendTo(c.row, c.col, "cell", "none");
          }
        }
      } else if (ds.mode === "rowHeader" || ds.mode === "colHeader") {
        const h = resolveHeaderAt(e.clientX, e.clientY);
        if (h) {
          const cur = selectionRef.current;
          if (ds.mode === "rowHeader" && h.kind === "row") {
            if (!cur || cur.focus.row !== h.index) {
              extendTo(h.index, totalCols - 1, "row", "none");
            }
          } else if (ds.mode === "colHeader" && h.kind === "col") {
            if (!cur || cur.focus.col !== h.index) {
              extendTo(totalRows - 1, h.index, "col", "none");
            }
          }
        }
      }
      runAutoScrollLoop();
    },
    [
      resolveCellAt,
      resolveHeaderAt,
      extendTo,
      runAutoScrollLoop,
      totalRows,
      totalCols,
    ],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragState.current?.active) {
        try {
          (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        } catch {
          // ignore — already released
        }
      }
      dragState.current = null;
      lastPointer.current = null;
      stopAutoScroll();
    },
    [stopAutoScroll],
  );

  // ── Header click handlers ───────────────────────────────────────────────
  const handleColHeaderPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, col: number) => {
      if (!onSelectionChange) return;
      if (e.button !== 0) return;
      e.stopPropagation();
      scrollRef.current?.focus({ preventScroll: true });

      if (e.shiftKey && selectionRef.current) {
        emit(
          {
            anchor: selectionRef.current.anchor,
            focus: { row: totalRows - 1, col },
            mode: "col",
            scroll: "none",
            nonce: Date.now(),
          },
          "none",
        );
        return;
      }

      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      dragState.current = {
        active: true,
        mode: "colHeader",
        pointerId: e.pointerId,
      };
      lastPointer.current = { x: e.clientX, y: e.clientY };
      emit(
        {
          anchor: { row: 0, col },
          focus: { row: totalRows - 1, col },
          mode: "col",
          scroll: "none",
          nonce: Date.now(),
        },
        "none",
      );
    },
    [onSelectionChange, emit, totalRows],
  );

  const handleRowHeaderPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, row: number) => {
      if (!onSelectionChange) return;
      if (e.button !== 0) return;
      e.stopPropagation();
      scrollRef.current?.focus({ preventScroll: true });

      if (e.shiftKey && selectionRef.current) {
        emit(
          {
            anchor: selectionRef.current.anchor,
            focus: { row, col: totalCols - 1 },
            mode: "row",
            scroll: "none",
            nonce: Date.now(),
          },
          "none",
        );
        return;
      }

      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      dragState.current = {
        active: true,
        mode: "rowHeader",
        pointerId: e.pointerId,
      };
      lastPointer.current = { x: e.clientX, y: e.clientY };
      emit(
        {
          anchor: { row, col: 0 },
          focus: { row, col: totalCols - 1 },
          mode: "row",
          scroll: "none",
          nonce: Date.now(),
        },
        "none",
      );
    },
    [onSelectionChange, emit, totalCols],
  );

  const handleCornerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!onSelectionChange) return;
      if (e.button !== 0) return;
      e.stopPropagation();
      scrollRef.current?.focus({ preventScroll: true });
      selectAll();
    },
    [onSelectionChange, selectAll],
  );

  // ── Context-menu state ──────────────────────────────────────────────────
  const [menuCtx, setMenuCtx] = useState<GridContextMenuTarget>(null);

  const handleContextMenuCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Resolve target via the same point-based lookups used by drag-select.
      const header = resolveHeaderAt(e.clientX, e.clientY);
      if (header && header.kind === "row") {
        // Right-click on row header — select the row (Excel behavior) then
        // open menu with row-context items.
        emit(
          {
            anchor: { row: header.index, col: 0 },
            focus: { row: header.index, col: totalCols - 1 },
            mode: "row",
            scroll: "none",
            nonce: Date.now(),
          },
          "none",
        );
        setMenuCtx({ type: "row", row: header.index });
        return;
      }
      if (header && header.kind === "col") {
        // No actions for col header in v1 — suppress radix from opening.
        setMenuCtx(null);
        e.preventDefault();
        return;
      }

      const cell = resolveCellAt(e.clientX, e.clientY);
      if (!cell) {
        setMenuCtx(null);
        e.preventDefault();
        return;
      }

      // If click is outside current selection, collapse to single cell.
      // If inside, preserve range (Excel behavior).
      const inSel =
        !!expandedBounds && boundsInclude(expandedBounds, cell.row, cell.col);
      if (!inSel) {
        setSingleCell(cell.row, cell.col, "none");
      }
      setMenuCtx({ type: "cell", row: cell.row, col: cell.col });
    },
    [
      resolveHeaderAt,
      resolveCellAt,
      emit,
      totalCols,
      expandedBounds,
      setSingleCell,
    ],
  );

  // Menu shows "Copy as markdown" whenever there's a non-empty selection.
  const canCopy = !!expandedBounds && !!selection;

  // Formula available for right-clicked cell (used by context menu).
  const menuFormula =
    menuCtx?.type === "cell"
      ? getCellFormula(sheet.rows[menuCtx.row]?.[menuCtx.col])
      : null;

  // ── Copy formula ────────────────────────────────────────────────────────
  const copyFormulaAt = useCallback(
    (row: number, col: number) => {
      const cell = sheet.rows[row]?.[col];
      const f = getCellFormula(cell);
      if (f) {
        copyFormula(f);
      } else {
        toast.message("No formula in this cell");
      }
    },
    [sheet],
  );

  // ── Keyboard handler ────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!onSelectionChange) return;
      const tgt = e.target as HTMLElement | null;
      const tag = tgt?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tgt?.isContentEditable)
        return;

      const ctrl = e.ctrlKey || e.metaKey;

      // Cmd/Ctrl+A → select all
      if (ctrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAll();
        return;
      }

      // Cmd/Ctrl+Shift+C → copy formula of anchor cell.
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        const a = selectionRef.current?.anchor;
        if (a) copyFormulaAt(a.row, a.col);
        return;
      }

      // Cmd/Ctrl+C → copy selection using the saved default format.
      if (ctrl && e.key.toLowerCase() === "c") {
        e.preventDefault();
        onCopyDefault?.();
        return;
      }

      // Esc during drag → cancel (collapse to anchor)
      if (e.key === "Escape" && dragState.current?.active) {
        e.preventDefault();
        const cur = selectionRef.current;
        if (cur) {
          emit(
            {
              anchor: cur.anchor,
              focus: cur.anchor,
              mode: "cell",
              scroll: "none",
              nonce: Date.now(),
            },
            "none",
          );
        }
        dragState.current = null;
        stopAutoScroll();
        return;
      }

      const navKeys = new Set([
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
        "PageUp",
        "PageDown",
        "Tab",
        "Enter",
      ]);
      if (!navKeys.has(e.key)) return;

      const cur = selectionRef.current;
      // Use focus for shift-extend (extend from focus), anchor otherwise.
      const baseR =
        cur?.focus.row ?? firstVisibleRow(sheet, totalRows);
      const baseC =
        cur?.focus.col ?? firstVisibleCol(sheet, totalCols);
      const span = mergeSpanAt(merges, baseR, baseC);

      let nextR = baseR;
      let nextC = baseC;

      switch (e.key) {
        case "ArrowUp":
          nextR = nextVisibleRow(sheet, baseR, -1, totalRows);
          break;
        case "ArrowDown":
          nextR = nextVisibleRow(
            sheet,
            baseR + span.rowSpan - 1,
            1,
            totalRows,
          );
          break;
        case "ArrowLeft":
          nextC = nextVisibleCol(sheet, baseC, -1, totalCols);
          break;
        case "ArrowRight":
        case "Tab":
          if (e.key === "Tab" && e.shiftKey) {
            nextC = nextVisibleCol(sheet, baseC, -1, totalCols);
          } else {
            nextC = nextVisibleCol(
              sheet,
              baseC + span.colSpan - 1,
              1,
              totalCols,
            );
          }
          break;
        case "Home":
          if (ctrl) nextR = firstVisibleRow(sheet, totalRows);
          nextC = firstVisibleCol(sheet, totalCols);
          break;
        case "End":
          if (ctrl) nextR = lastVisibleRow(sheet, totalRows);
          nextC = lastVisibleCol(sheet, totalCols);
          break;
        case "PageDown":
        case "PageUp": {
          const el = scrollRef.current;
          const viewportH = el
            ? el.clientHeight - headerHeight
            : DEFAULT_ROW_HEIGHT * 20;
          const avgRow = DEFAULT_ROW_HEIGHT;
          const step = Math.max(1, Math.floor(viewportH / avgRow));
          const dir: 1 | -1 = e.key === "PageDown" ? 1 : -1;
          let r = baseR;
          for (let i = 0; i < step; i++) {
            const nr = nextVisibleRow(sheet, r, dir, totalRows);
            if (nr === r) break;
            r = nr;
          }
          nextR = r;
          break;
        }
        case "Enter":
          nextR = nextVisibleRow(
            sheet,
            baseR + span.rowSpan - 1,
            1,
            totalRows,
          );
          break;
      }

      if (nextR === baseR && nextC === baseC && cur) return;
      e.preventDefault();

      // Tab/Enter never extend even with Shift+Tab (Shift+Tab is "previous", not "extend").
      const isTab = e.key === "Tab";
      const isEnter = e.key === "Enter";
      if (e.shiftKey && !isTab && !isEnter) {
        extendTo(nextR, nextC, "cell", "ifNeeded");
      } else {
        setSingleCell(nextR, nextC, "ifNeeded");
      }
    },
    [
      onSelectionChange,
      selectAll,
      onCopyDefault,
      sheet,
      totalRows,
      totalCols,
      merges,
      headerHeight,
      extendTo,
      setSingleCell,
      emit,
      stopAutoScroll,
    ],
  );

  // ── Virtualizer ─────────────────────────────────────────────────────────
  const rowVirtualizer = useVirtualizer({
    count: visibleRowIndices.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => {
      const r = visibleRowIndices[i];
      const h = heights[r] ?? DEFAULT_ROW_HEIGHT;
      // Floor the funnel-bearing header row at FUNNEL_ROW_MIN_HEIGHT so a
      // measure() cache-clear (file re-open / font-ready) never collapses it to
      // the native estimate and then async re-grows — that gap is a visible
      // height shift. Skip while this row is mid drag-resize (heights[r] is the
      // live preview): flooring then would block shrinking the header below 24.
      const previewing = rowPreview?.idx === r;
      if (r === headerRow && groupByAnchor.size > 0 && !previewing) {
        return Math.max(h, FUNNEL_ROW_MIN_HEIGHT);
      }
      return h;
    },
    getItemKey: (i) => visibleRowIndices[i] ?? i,
    overscan: 8,
    measureElement: (el) =>
      el ? el.getBoundingClientRect().height : DEFAULT_ROW_HEIGHT,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalBodyHeight = rowVirtualizer.getTotalSize();
  const measurements = rowVirtualizer.measurementsCache;

  // Apply row-height overrides to the virtualizer via the SUPPORTED resizeItem
  // API. resizeItem(index, size) seeds the size cache for that row AND reflows
  // subsequent offsets, so autofit/manual-resize take effect immediately without
  // waiting on the ResizeObserver to re-fire (it stays silent when the row's
  // real box size is unchanged). measureElement still refines afterward if the
  // pushed size differs from the actual DOM box. Preview-only changes never
  // reach here (rowOverrides is stable during drag), preserving 60fps.
  const prevRowOverridesRef = useRef<Record<number, number> | undefined>(
    undefined,
  );
  const prevSheetRef = useRef<SheetModel | null>(null);
  const pendingMeasureRowsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (prevSheetRef.current !== sheet) {
      prevSheetRef.current = sheet;
      prevRowOverridesRef.current = rowOverrides;
      rowVirtualizer.measure();
      // measure() wipes the size cache. On (re)open the row DOM nodes are reused
      // (stable row-index keys), so measureElement/ResizeObserver won't re-fire to
      // reseed the cache — a funnel header would stay at the estimate (collapsed,
      // funnel overlapping text). Queue the currently-rendered rows for the
      // real-DOM remeasure below (useLayoutEffect runs pre-paint, before the user
      // sees the collapsed frame).
      for (const vr of virtualRows) {
        const r = visibleRowIndices[vr.index];
        if (r !== undefined && r >= 0 && r < totalRows) {
          pendingMeasureRowsRef.current.add(r);
        }
      }
      return;
    }
    const changed = changedRowIndices(prevRowOverridesRef.current, rowOverrides);
    for (const r of changed) {
      if (r < 0 || r >= totalRows) continue;
      const pos = visiblePos.get(r);
      if (pos === undefined) continue;
      rowVirtualizer.resizeItem(pos, effectiveRowHeight(sheet, r, rowOverrides));
      pendingMeasureRowsRef.current.add(r);
    }
    prevRowOverridesRef.current = rowOverrides;
  }, [rowOverrides, sheet, totalRows, rowVirtualizer, visiblePos]);

  // One-shot remeasure once the real Geist glyphs load. The first measure runs
  // with the fallback font (shorter line box), so rows whose content has no
  // height override settle to a too-small box and—because measureElement only
  // fires on a DOM size change—stay squished after the font swaps in. Forcing a
  // measure() when document.fonts.ready resolves discards the stale cache so
  // measureElement re-reads each row at its real glyph height.
  useEffect(() => {
    let cancelled = false;
    void awaitFontsReady().then(() => {
      if (!cancelled) rowVirtualizer.measure();
    });
    return () => {
      cancelled = true;
    };
  }, [rowVirtualizer]);

  // After each render, measure actual DOM height for recently-resized rows and
  // correct the virtualizer. Needed because overflow:visible cells keep the row
  // at content_height even when vr.size changes — ResizeObserver stays silent
  // (no DOM size change), so the corrected offset for the next row never fires
  // unless we force-measure here. useLayoutEffect runs before paint so React
  // can commit the correction before the user sees any overlap.
  useLayoutEffect(() => {
    if (pendingMeasureRowsRef.current.size === 0) return;
    const rows = [...pendingMeasureRowsRef.current];
    pendingMeasureRowsRef.current.clear();
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    for (const r of rows) {
      const el = scrollEl.querySelector(
        `[data-abs-row="${r}"]`,
      ) as HTMLElement | null;
      if (el) {
        const actual = Math.round(el.getBoundingClientRect().height);
        if (actual > 0) {
          const pos = visiblePos.get(r);
          if (pos !== undefined) rowVirtualizer.resizeItem(pos, actual);
        }
      }
    }
  });

  // ── Scroll effect (driven by selection.focus changes) ───────────────────
  useEffect(() => {
    if (!selection) return;
    // Skip auto-scroll for row/col/all modes (header clicks shouldn't snap viewport).
    if (selection.mode !== "cell") return;
    const focusR = selection.focus.row;
    const focusC = selection.focus.col;
    if (focusR < 0 || focusR >= totalRows) return;
    if (focusC < 0 || focusC >= totalCols) return;
    const mode = selection.scroll ?? "center";
    if (mode === "none") return;
    const el = scrollRef.current;
    if (!el) return;

    const focusPos = visiblePos.get(focusR);

    if (mode === "center") {
      if (focusPos !== undefined) rowVirtualizer.scrollToIndex(focusPos, { align: "center" });
      const x = cumColX[focusC] ?? 0;
      const w = widths[focusC] ?? 0;
      const viewportW = el.clientWidth - ROW_NUM_COL_WIDTH;
      const desiredLeft = Math.max(0, x - viewportW / 2 + w / 2);
      el.scrollTo({ left: desiredLeft, behavior: "smooth" });
      return;
    }

    // ifNeeded
    if (focusPos !== undefined) rowVirtualizer.scrollToIndex(focusPos, { align: "auto" });
    const x = cumColX[focusC] ?? 0;
    const w = widths[focusC] ?? 0;
    const viewportLeft = el.scrollLeft + ROW_NUM_COL_WIDTH;
    const viewportRight = el.scrollLeft + el.clientWidth;
    const cellLeft = ROW_NUM_COL_WIDTH + x;
    const cellRight = cellLeft + w;
    if (cellLeft < viewportLeft) {
      el.scrollTo({ left: x, behavior: "auto" });
    } else if (cellRight > viewportRight) {
      el.scrollTo({
        left: cellRight - el.clientWidth + ROW_NUM_COL_WIDTH,
        behavior: "auto",
      });
    }
  }, [selection, totalRows, totalCols, cumColX, widths, rowVirtualizer, visiblePos]);

  // Suppress native text selection during drag-select. `selectstart` is not in
  // React's synthetic event system, so attach a native listener. Covers cells
  // and sticky headers (the scroll root is their common ancestor).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener("selectstart", prevent);
    return () => el.removeEventListener("selectstart", prevent);
  }, []);

  // ── Highlight derivation per cell ────────────────────────────────────────
  const rangeIsMultiCell =
    !!expandedBounds &&
    (expandedBounds.r1 !== expandedBounds.r2 ||
      expandedBounds.c1 !== expandedBounds.c2);

  const isAnchor = (r: number, c: number): boolean =>
    !!selection && selection.anchor.row === r && selection.anchor.col === c;

  const isSelected = (r: number, c: number): boolean =>
    !!expandedBounds && boundsInclude(expandedBounds, r, c);

  const cellHighlight = (
    r: number,
    c: number,
  ): "anchor" | "selected" | "match" | null => {
    if (isAnchor(r, c)) {
      // Multi-cell range — anchor blends with surrounding selected cells
      // (uniform tint); range frame draws the border. Single-cell anchor
      // gets its own outline for visibility.
      return rangeIsMultiCell ? "selected" : "anchor";
    }
    if (isSelected(r, c)) return "selected";
    if (matchSet.has(`${r}:${c}`)) return "match";
    return null;
  };

  // Shared helper — renders a funnel button + ColumnFilterDropdown for column i
  // triggered from the given source ("band" or "ruler").
  const renderFilterControl = (i: number, source: FilterSource, iconColor?: string) => {
    const colFilter = activeFilters[i];
    const filterIsActive =
      colFilter != null &&
      (colFilter.condition.op !== "none" || colFilter.excluded.length > 0);
    const isOpen = openFilter?.col === i && openFilter.source === source;
    return (
      <ColumnFilterDropdown
        open={isOpen}
        onOpenChange={(o) => setOpenFilter(o ? { col: i, source } : null)}
        columnLabel={columnLetter(i)}
        distinctValues={isOpen ? openFilterDistinct : []}
        value={colFilter ?? { condition: { op: "none", operand: "" }, excluded: [] }}
        onApply={(f) => onColumnFilterChange?.(i, f)}
      >
        <button
          type="button"
          aria-label="Filter column"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setOpenFilter({ col: i, source }); }}
          className="inline-flex items-center justify-center rounded p-0.5 transition-opacity hover:opacity-60"
          style={iconColor ? { color: iconColor } : undefined}
        >
          {filterIsActive ? (
            <motion.span
              className="inline-flex"
              animate={{ scale: [1, 1.18, 1], opacity: [1, 0.55, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Filter className="size-3" fill="currentColor" />
            </motion.span>
          ) : (
            <Filter className="size-3" fill="currentColor" />
          )}
        </button>
      </ColumnFilterDropdown>
    );
  };

  // Inline header funnel for a cell: shown on the in-flow header row only while
  // it is NOT scrolled off (the sticky band carries the funnel when stuck).
  const headerFunnelFor = (colIdx: number, rowIdx: number): ReactNode => {
    if (headerRow == null || headerStuck || rowIdx !== headerRow) return undefined;
    if (!groupByAnchor.has(colIdx)) return undefined;
    return renderFilterControl(colIdx, "row", sheet.rows[headerRow]?.[colIdx]?.s?.fg);
  };

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    let stuck = false;
    if (headerRow != null) {
      const pos = visiblePos.get(headerRow);
      if (pos !== undefined) {
        const cache = rowVirtualizer.measurementsCache;
        let start = cache[pos]?.start;
        if (start === undefined) {
          // fallback: prefix-sum of effective row heights up to header position
          start = 0;
          for (let i = 0; i < pos; i++) {
            const r = visibleRowIndices[i];
            start += effectiveRowHeight(sheet, r, rowOverrides);
          }
        }
        stuck = headerBandStuck(el.scrollTop, start);
      }
    }
    if (stuck !== headerStuckRef.current) {
      headerStuckRef.current = stuck;
      setHeaderStuck(stuck);
    }
  }, [headerRow, visiblePos, rowVirtualizer, sheet, rowOverrides, visibleRowIndices]);

  return (
    <div className="relative flex-1 overflow-hidden bg-background">
      <div
        ref={scrollRef}
        data-testid="grid-scroll-container"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        className="h-full w-full overflow-auto outline-none focus:outline-none"
        style={{ contain: "strict" }}
      >
        {/* Sticky header — column letters */}
        <div
          className="sticky top-0 z-30 flex bg-muted/85 backdrop-blur-md border-b border-border"
          style={{
            height: headerHeight,
            width: bodyWidth,
          }}
        >
          {/* Corner (select-all) */}
          <div
            onPointerDown={handleCornerPointerDown}
            className="sticky left-0 z-40 shrink-0 border-r border-border bg-muted/90 cursor-cell"
            style={{ width: ROW_NUM_COL_WIDTH, height: headerHeight }}
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
                onPointerDown={(e) => handleColHeaderPointerDown(e, i)}
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
                    onPreview={handleResizePreview}
                    onCommit={handleResizeCommit}
                    onAutofit={handleResizeAutofit}
                  />
                )}
              </div>
            );
          })}
        </div>

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
              style={{
                height: totalBodyHeight,
                width: bodyWidth,
                position: "relative",
                userSelect: "none",
              }}
            >
          {/* Sticky header band — mirrors the marked header row under the A/B/C ruler */}
          {headerRow != null && headerStuck && (
            <div
              className="sticky left-0 z-20 flex border-b border-border bg-muted/85 backdrop-blur-md"
              style={{ top: headerHeight, width: bodyWidth, height: effectiveRowHeight(sheet, headerRow, rowOverrides) }}
            >
              {/* Corner spacer aligns with row-number column */}
              <div
                className="sticky left-0 z-10 shrink-0 border-r border-border bg-muted/90"
                style={{ width: ROW_NUM_COL_WIDTH }}
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
          )}

          {/* Row map */}
          {virtualRows.map((vr) => {
            const rowIdx = visibleRowIndices[vr.index];
            const row = sheet.rows[rowIdx];
            const rowInSel =
              expandedBounds &&
              rowIdx >= expandedBounds.r1 &&
              rowIdx <= expandedBounds.r2;
            return (
              <div
                key={vr.key}
                data-index={vr.index}
                data-abs-row={rowIdx}
                ref={rowVirtualizer.measureElement}
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
                  onPointerDown={(e) => handleRowHeaderPointerDown(e, rowIdx)}
                  title={rowIdx === headerRow ? "Header row" : undefined}
                  className={`sticky left-0 z-10 flex shrink-0 items-center justify-center border-r border-b border-border text-[10px] font-medium cursor-cell select-none relative backdrop-blur-xl ${
                    rowInSel
                      ? "bg-primary/20 text-foreground"
                      : rowIdx === headerRow
                        ? "bg-amber-500/30 text-foreground font-bold"
                        : "bg-muted/85 text-muted-foreground"
                  }`}
                  style={{
                    width: ROW_NUM_COL_WIDTH,
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
                      onPreview={handleResizePreview}
                      onCommit={handleResizeCommit}
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
                        cell={row?.[colIdx]}
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
                      cell={row?.[colIdx]}
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
          })}

          {/* Merge anchor layer */}
          <MergeLayer
            merges={merges}
            measurements={measurements}
            visiblePos={visiblePos}
            sheet={sheet}
            widths={widths}
            cumColX={cumColX}
            leftOffset={ROW_NUM_COL_WIDTH}
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
            leftOffset={ROW_NUM_COL_WIDTH}
          />
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

interface SelectionFrameProps {
  bounds: Bounds | null;
  mode: Selection["mode"] | null;
  widths: number[];
  cumColX: number[];
  visiblePos: Map<number, number>;
  measurements: ReadonlyArray<{
    index: number;
    start: number;
    end: number;
    size: number;
  }>;
  leftOffset: number;
}

function SelectionFrame({
  bounds,
  mode,
  widths,
  cumColX,
  visiblePos,
  measurements,
  leftOffset,
}: SelectionFrameProps) {
  if (!bounds || !mode) return null;

  const span = selectionRowSpan(bounds.r1, bounds.r2, visiblePos, measurements);
  if (!span) return null;
  const top = span.top;
  const height = Math.max(0, span.bottom - top);

  const left = leftOffset + (cumColX[bounds.c1] ?? 0);
  const width = widths
    .slice(bounds.c1, bounds.c2 + 1)
    .reduce((a, b) => a + b, 0);

  const w = Math.round(width);
  const h = Math.round(height);
  const bottomY = h - 2; // nudge bottom edge up so it clears the next-row gridline
  const rightX = w - 2; // nudge right edge left so it clears the next-col gridline

  return (
    <svg
      aria-hidden
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{
        position: "absolute",
        top: Math.round(top),
        left: Math.round(left),
        // Pin to exact px in CSS too — a global `svg` reset can stretch the
        // element, scaling its coord system non-uniformly (long+thick horizontal
        // dashes, short+thin vertical). Explicit px + matching viewBox = 1:1.
        width: w,
        height: h,
        display: "block",
        pointerEvents: "none",
        zIndex: 18,
        overflow: "visible",
      }}
    >
      {/* Single rect inset so the 2px stroke stays inside the viewport (no
          right/bottom clipping) and clears the next row/col gridline.
          non-scaling-stroke keeps dashes uniform on all edges. */}
      <rect
        className="selection-ants"
        vectorEffect="non-scaling-stroke"
        x={1}
        y={1}
        width={Math.max(0, rightX - 1)}
        height={Math.max(0, bottomY - 1)}
      />
    </svg>
  );
}

interface MergeLayerProps {
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

function MergeLayer({
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
