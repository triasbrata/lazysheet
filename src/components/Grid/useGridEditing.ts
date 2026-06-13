import { useCallback } from "react";
import type { CellModel, SheetModel } from "@/lib/types";
import { resolveActiveCoords, type MergeInfo } from "./grid-utils";

export interface UseGridEditingApi {
  cellAt: (r: number, c: number) => CellModel | undefined;
  handleBodyDoubleClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function useGridEditing(opts: {
  sheet: SheetModel;
  getEditedCell: ((row: number, col: number) => CellModel | undefined) | undefined;
  editEnabled: boolean | undefined;
  totalRows: number;
  totalCols: number;
  merges: MergeInfo;
  onEditStart: ((row: number, col: number) => void) | undefined;
}): UseGridEditingApi {
  const { sheet, getEditedCell, editEnabled, totalRows, totalCols, merges, onEditStart } = opts;

  // ── Buffered cell lookup — edited cell takes precedence over sheet data ───
  const cellAt = useCallback(
    (r: number, c: number): CellModel | undefined =>
      getEditedCell?.(r, c) ?? sheet.rows[r]?.[c],
    [getEditedCell, sheet],
  );

  // ── Body double-click — enters inline edit mode ─────────────────────────
  const handleBodyDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!editEnabled) return;
      const tgt = e.target as HTMLElement | null;
      if (!tgt) return;
      // Only data cells (not header/gutter) are editable
      const cellEl = tgt.closest<HTMLElement>("[data-r][data-c]");
      if (!cellEl) return;
      const r = parseInt(cellEl.getAttribute("data-r")!, 10);
      const c = parseInt(cellEl.getAttribute("data-c")!, 10);
      if (Number.isNaN(r) || Number.isNaN(c)) return;
      // Guard: must be within data bounds (not a header/gutter pseudo-cell)
      if (r < 0 || r >= totalRows || c < 0 || c >= totalCols) return;
      // Resolve to merge anchor
      const resolved = resolveActiveCoords(merges, r, c);
      onEditStart?.(resolved.row, resolved.col);
    },
    [editEnabled, totalRows, totalCols, merges, onEditStart],
  );

  return { cellAt, handleBodyDoubleClick };
}
