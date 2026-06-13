import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import {
  resolveActiveCoords,
  type MergeInfo,
  type Selection,
} from "./grid-utils";

export interface UseGridSelectionApi {
  emit: (next: Selection, scroll: "none" | "ifNeeded" | "center") => void;
  setSingleCell: (
    row: number,
    col: number,
    scroll: "none" | "ifNeeded" | "center",
  ) => void;
  extendTo: (
    row: number,
    col: number,
    mode: Selection["mode"],
    scroll: "none" | "ifNeeded" | "center",
  ) => void;
  selectAll: () => void;
  selectionRef: RefObject<Selection | null>;
}

export function useGridSelection(opts: {
  selection: Selection | null | undefined;
  onSelectionChange:
    | ((next: Selection, scroll: "none" | "ifNeeded" | "center") => void)
    | undefined;
  merges: MergeInfo;
  totalRows: number;
  totalCols: number;
}): UseGridSelectionApi {
  const { selection, onSelectionChange, merges, totalRows, totalCols } = opts;

  const emit = useCallback(
    (next: Selection, scroll: "none" | "ifNeeded" | "center") => {
      onSelectionChange?.(next, scroll);
    },
    [onSelectionChange],
  );

  // Track latest selection in ref so pointermove handler closure stays fresh
  // without depending on React state churn.
  const selectionRef = useRef<Selection | null>(selection ?? null);
  useEffect(() => {
    selectionRef.current = selection ?? null;
  }, [selection]);

  // ── Cell setters ─────────────────────────────────────────────────────────────
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

  return { emit, setSingleCell, extendTo, selectAll, selectionRef };
}
