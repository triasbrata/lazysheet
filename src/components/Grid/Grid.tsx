import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { SheetModel } from "@/lib/types";
import { Cell } from "./Cell";
import {
  ContextMenu,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  GridContextMenuContent,
  type GridContextMenuTarget,
} from "./GridContextMenu";
import {
  boundsInclude,
  buildMergeInfo,
  columnLetter,
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
  resolveActiveCoords,
  ROW_NUM_COL_WIDTH,
  selectionBounds,
  type Bounds,
  type MergeInfo,
  type Selection,
} from "./grid-utils";
import { ResizeHandle, type ResizeOrientation } from "./ResizeHandle";

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
  onCopyMarkdown?: () => void;
  onCopyMarkdownTitle?: () => void;
  onCopyMarkdownTable?: () => void;
  onCopyAscii?: () => void;
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
  onCopyMarkdown,
  onCopyMarkdownTitle,
  onCopyMarkdownTable,
  onCopyAscii,
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

  const cumColX = useMemo(() => {
    const arr = [0];
    for (let i = 0; i < widths.length; i++) {
      arr.push(arr[i] + widths[i]);
    }
    return arr;
  }, [widths]);

  // Estimated cumulative row Y — used as fallback when virtualizer
  // measurementsCache hasn't seen a row yet (range extends offscreen).
  const cumRowY = useMemo(() => {
    const arr = [0];
    for (let i = 0; i < heights.length; i++) {
      arr.push(arr[i] + heights[i]);
    }
    return arr;
  }, [heights]);

  const totalContentWidth = cumColX[cumColX.length - 1] ?? 0;
  const bodyWidth = ROW_NUM_COL_WIDTH + totalContentWidth;

  const merges = useMemo(() => buildMergeInfo(sheet.merges), [sheet.merges]);

  const headerHeight = 26;

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
    count: totalRows,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => heights[i] ?? DEFAULT_ROW_HEIGHT,
    overscan: 8,
    measureElement: (el) =>
      el ? el.getBoundingClientRect().height : DEFAULT_ROW_HEIGHT,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalBodyHeight = rowVirtualizer.getTotalSize();
  const measurements = rowVirtualizer.measurementsCache;

  // Invalidate virtualizer measurements on commit (rowOverrides change),
  // NOT on rowPreview — keeps drag at 60fps; tiny visual mismatch during
  // drag is acceptable, snaps correct on release.
  useEffect(() => {
    rowVirtualizer.measure();
  }, [rowOverrides, rowVirtualizer]);

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

    if (mode === "center") {
      rowVirtualizer.scrollToIndex(focusR, { align: "center" });
      const x = cumColX[focusC] ?? 0;
      const w = widths[focusC] ?? 0;
      const viewportW = el.clientWidth - ROW_NUM_COL_WIDTH;
      const desiredLeft = Math.max(0, x - viewportW / 2 + w / 2);
      el.scrollTo({ left: desiredLeft, behavior: "smooth" });
      return;
    }

    // ifNeeded
    rowVirtualizer.scrollToIndex(focusR, { align: "auto" });
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
  }, [selection, totalRows, totalCols, cumColX, widths, rowVirtualizer]);

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

  return (
    <div className="relative flex-1 overflow-hidden bg-background">
      <div
        ref={scrollRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="h-full w-full overflow-auto outline-none focus:outline-none"
        style={{ contain: "strict" }}
      >
        {/* Sticky header — column letters */}
        <div
          className="sticky top-0 z-30 flex bg-muted/80 backdrop-blur-sm border-b border-border"
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
          {/* Row map */}
          {virtualRows.map((vr) => {
            const rowIdx = vr.index;
            const row = sheet.rows[rowIdx];
            const rowInSel =
              expandedBounds &&
              rowIdx >= expandedBounds.r1 &&
              rowIdx <= expandedBounds.r2;
            return (
              <div
                key={vr.key}
                data-index={rowIdx}
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
                  className={`sticky left-0 z-10 flex shrink-0 items-center justify-center border-r border-b border-border text-[10px] font-medium cursor-cell select-none relative ${
                    rowInSel
                      ? "bg-primary/15 text-foreground"
                      : rowIdx === headerRow
                        ? "bg-amber-500/20 text-foreground font-bold"
                        : "bg-muted/60 text-muted-foreground"
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
            cumRowY={cumRowY}
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
            onCopyMarkdown={() => onCopyMarkdown?.()}
            onCopyMarkdownTitle={() => onCopyMarkdownTitle?.()}
            onCopyMarkdownTable={() => onCopyMarkdownTable?.()}
            onCopyAscii={() => onCopyAscii?.()}
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
  cumRowY: number[];
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
  cumRowY,
  measurements,
  leftOffset,
}: SelectionFrameProps) {
  if (!bounds || !mode) return null;
  // Single cell — anchor's per-cell outline already does the job. Avoid stacking borders.
  if (bounds.r1 === bounds.r2 && bounds.c1 === bounds.c2) return null;

  const rowStart = (r: number) => measurements[r]?.start ?? cumRowY[r] ?? 0;
  const rowEnd = (r: number) =>
    measurements[r]?.end ?? cumRowY[r + 1] ?? cumRowY[cumRowY.length - 1] ?? 0;

  const top = rowStart(bounds.r1);
  const bottom = rowEnd(bounds.r2);
  const height = Math.max(0, bottom - top);

  const left = leftOffset + (cumColX[bounds.c1] ?? 0);
  const width = widths
    .slice(bounds.c1, bounds.c2 + 1)
    .reduce((a, b) => a + b, 0);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top,
        left,
        width,
        height,
        border: "2px solid var(--primary)",
        boxSizing: "border-box",
        pointerEvents: "none",
        zIndex: 18,
      }}
    />
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
        const startMeas = measurements[r1];
        const endMeas = measurements[r2];
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
