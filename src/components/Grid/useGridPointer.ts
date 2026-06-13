import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { Selection } from "./grid-utils";
import type { UseGridSelectionApi } from "./useGridSelection";

export type DragMode = "cell" | "rowHeader" | "colHeader";

export interface DragState {
  active: boolean;
  mode: DragMode;
  pointerId: number;
}

export const AUTO_SCROLL_EDGE = 24;
export const AUTO_SCROLL_MAX = 20;

export interface UseGridPointerApi {
  resolveCellAt: (
    clientX: number,
    clientY: number,
  ) => { row: number; col: number } | null;
  resolveHeaderAt: (
    clientX: number,
    clientY: number,
  ) => { kind: "row" | "col"; index: number } | null;
  dragStateRef: RefObject<DragState | null>;
  stopAutoScroll: () => void;
  handleBodyPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleBodyPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  endDrag: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleColHeaderPointerDown: (
    e: React.PointerEvent<HTMLDivElement>,
    col: number,
  ) => void;
  handleRowHeaderPointerDown: (
    e: React.PointerEvent<HTMLDivElement>,
    row: number,
  ) => void;
  handleCornerPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export function useGridPointer(opts: {
  scrollRef: RefObject<HTMLDivElement | null>;
  selectionRef: UseGridSelectionApi["selectionRef"];
  onSelectionChange:
    | ((next: Selection, scroll: "none" | "ifNeeded" | "center") => void)
    | undefined;
  emit: UseGridSelectionApi["emit"];
  setSingleCell: UseGridSelectionApi["setSingleCell"];
  extendTo: UseGridSelectionApi["extendTo"];
  selectAll: UseGridSelectionApi["selectAll"];
  totalRows: number;
  totalCols: number;
  headerHeight: number;
}): UseGridPointerApi {
  const {
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
  } = opts;

  // Refs — drag state must not trigger renders on every pointermove.
  const dragStateRef = useRef<DragState | null>(null);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const autoScrollRaf = useRef<number | null>(null);

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
      const ds = dragStateRef.current;
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
      dragStateRef.current = { active: true, mode: "cell", pointerId: e.pointerId };
      lastPointer.current = { x: e.clientX, y: e.clientY };
      setSingleCell(r, c, "none");
    },
    [onSelectionChange, extendTo, setSingleCell],
  );

  const handleBodyPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const ds = dragStateRef.current;
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
      if (dragStateRef.current?.active) {
        try {
          (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        } catch {
          // ignore — already released
        }
      }
      dragStateRef.current = null;
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
      dragStateRef.current = {
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
      dragStateRef.current = {
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

  return {
    resolveCellAt,
    resolveHeaderAt,
    dragStateRef,
    stopAutoScroll,
    handleBodyPointerDown,
    handleBodyPointerMove,
    endDrag,
    handleColHeaderPointerDown,
    handleRowHeaderPointerDown,
    handleCornerPointerDown,
  };
}
