import { useCallback } from "react";
import type { RefObject } from "react";
import type { SheetModel } from "@/lib/types";
import {
  firstVisibleCol,
  firstVisibleRow,
  lastVisibleCol,
  lastVisibleRow,
  nextVisibleCol,
  nextVisibleRow,
  mergeSpanAt,
  DEFAULT_ROW_HEIGHT,
  type MergeInfo,
  type Selection,
} from "./grid-utils";
import type { UseGridSelectionApi } from "./useGridSelection";
import type { DragState } from "./useGridPointer";

export interface UseGridKeyboardApi {
  handleKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

export function useGridKeyboard(opts: {
  sheet: SheetModel;
  totalRows: number;
  totalCols: number;
  merges: MergeInfo;
  headerHeight: number;
  selection: Selection | null | undefined;
  selectionRef: UseGridSelectionApi["selectionRef"];
  emit: UseGridSelectionApi["emit"];
  setSingleCell: UseGridSelectionApi["setSingleCell"];
  extendTo: UseGridSelectionApi["extendTo"];
  selectAll: UseGridSelectionApi["selectAll"];
  dragState: RefObject<DragState | null>;
  stopAutoScroll: () => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  editEnabled?: boolean;
  editingCell?: { row: number; col: number } | null;
  onEditStart?: (row: number, col: number) => void;
  onSelectionChange?: (
    next: Selection,
    scroll: "none" | "ifNeeded" | "center",
  ) => void;
  onCopyDefault?: () => void;
  copyFormulaAt: (row: number, col: number) => void;
}): UseGridKeyboardApi {
  const {
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
  } = opts;

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

      // F2 — enter edit mode on the anchor cell
      if (editEnabled && e.key === "F2" && selection && !editingCell) {
        e.preventDefault();
        onEditStart?.(selection.anchor.row, selection.anchor.col);
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
      editEnabled,
      editingCell,
      selection,
      onEditStart,
    ],
  );

  return { handleKeyDown };
}
