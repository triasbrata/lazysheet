import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { VirtualItem } from "@tanstack/virtual-core";
import type { ReactVirtualizer } from "@tanstack/react-virtual";
import type { SheetModel } from "@/lib/types";
import {
  changedRowIndices,
  DEFAULT_ROW_HEIGHT,
  effectiveRowHeight,
  headerBandStuck,
  FUNNEL_ROW_MIN_HEIGHT,
} from "./grid-utils";
import { awaitFontsReady } from "@/lib/measure";
import type { Selection } from "./grid-utils";
import type { HeaderGroup } from "@/lib/grid-filter";

export interface UseGridVirtualRowsApi {
  rowVirtualizer: ReactVirtualizer<HTMLDivElement, HTMLElement>;
  virtualRows: VirtualItem[];
  totalBodyHeight: number;
  headerStuck: boolean;
  handleScroll: () => void;
}

export function useGridVirtualRows(opts: {
  scrollRef: RefObject<HTMLDivElement | null>;
  sheet: SheetModel;
  totalRows: number;
  totalCols: number;
  visibleRowIndices: number[];
  visiblePos: Map<number, number>;
  heights: number[];
  widths: number[];
  cumColX: number[];
  rowNumColWidth: number;
  zoom: number;
  headerRow: number | null;
  rowPreview: { idx: number; h: number } | null;
  rowOverrides: Record<number, number> | undefined;
  groupByAnchor: Map<number, HeaderGroup>;
  selection: Selection | null | undefined;
}): UseGridVirtualRowsApi {
  const {
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
  } = opts;

  const [headerStuck, setHeaderStuck] = useState(false);
  const headerStuckRef = useRef(false);

  // ── Virtualizer ─────────────────────────────────────────────────────────────
  const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLElement>({
    count: visibleRowIndices.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => {
      const r = visibleRowIndices[i];
      const h = heights[r] ?? Math.round(DEFAULT_ROW_HEIGHT * zoom);
      // Floor the funnel-bearing header row at FUNNEL_ROW_MIN_HEIGHT so a
      // measure() cache-clear (file re-open / font-ready) never collapses it to
      // the native estimate and then async re-grows — that gap is a visible
      // height shift. Skip while this row is mid drag-resize (heights[r] is the
      // live preview): flooring then would block shrinking the header below 24.
      const previewing = rowPreview?.idx === r;
      if (r === headerRow && groupByAnchor.size > 0 && !previewing) {
        return Math.max(h, Math.round(FUNNEL_ROW_MIN_HEIGHT * zoom));
      }
      return h;
    },
    getItemKey: (i) => visibleRowIndices[i] ?? i,
    overscan: 8,
    measureElement: (el) =>
      el ? el.getBoundingClientRect().height : Math.round(DEFAULT_ROW_HEIGHT * zoom),
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalBodyHeight = rowVirtualizer.getTotalSize();

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
      rowVirtualizer.resizeItem(
        pos,
        Math.round(effectiveRowHeight(sheet, r, rowOverrides) * zoom),
      );
      pendingMeasureRowsRef.current.add(r);
    }
    prevRowOverridesRef.current = rowOverrides;
  }, [rowOverrides, sheet, totalRows, rowVirtualizer, visiblePos, zoom]);

  // Zoom changes invalidate the measured-height cache: rows were measured at
  // the old zoom, and `minHeight: vr.size` feeds the stale size back into the
  // DOM — rows grow on zoom-in (content pushes the box) but never shrink on
  // zoom-out (minHeight pins the box, so ResizeObserver stays silent). Heights
  // ratchet up while widths scale down. measure() resets to estimateSize
  // (already zoom-scaled); queue the rendered rows so the pre-paint remeasure
  // below corrects any row whose real box differs from the estimate.
  const prevZoomRef = useRef(zoom);
  useEffect(() => {
    if (prevZoomRef.current === zoom) return;
    prevZoomRef.current = zoom;
    rowVirtualizer.measure();
    for (const vr of virtualRows) {
      const r = visibleRowIndices[vr.index];
      if (r !== undefined && r >= 0 && r < totalRows) {
        pendingMeasureRowsRef.current.add(r);
      }
    }
  }, [zoom, rowVirtualizer, virtualRows, visibleRowIndices, totalRows]);

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
      const viewportW = el.clientWidth - rowNumColWidth;
      const desiredLeft = Math.max(0, x - viewportW / 2 + w / 2);
      el.scrollTo({ left: desiredLeft, behavior: "smooth" });
      return;
    }

    // ifNeeded
    if (focusPos !== undefined) rowVirtualizer.scrollToIndex(focusPos, { align: "auto" });
    const x = cumColX[focusC] ?? 0;
    const w = widths[focusC] ?? 0;
    const viewportLeft = el.scrollLeft + rowNumColWidth;
    const viewportRight = el.scrollLeft + el.clientWidth;
    const cellLeft = rowNumColWidth + x;
    const cellRight = cellLeft + w;
    if (cellLeft < viewportLeft) {
      el.scrollTo({ left: x, behavior: "auto" });
    } else if (cellRight > viewportRight) {
      el.scrollTo({
        left: cellRight - el.clientWidth + rowNumColWidth,
        behavior: "auto",
      });
    }
  }, [selection, totalRows, totalCols, cumColX, widths, rowVirtualizer, visiblePos]);

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

  return {
    rowVirtualizer,
    virtualRows,
    totalBodyHeight,
    headerStuck,
    handleScroll,
  };
}
