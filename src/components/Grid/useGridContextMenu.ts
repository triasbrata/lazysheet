import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { SheetModel } from "@/lib/types";
import { getCellFormula, copyFormula } from "@/lib/formula-copy";
import { boundsInclude } from "./grid-utils";
import type { Bounds, Selection } from "./grid-utils";
import type { GridContextMenuTarget } from "./GridContextMenu";
import type { UseGridPointerApi } from "./useGridPointer";
import type { UseGridSelectionApi } from "./useGridSelection";

export interface UseGridContextMenuApi {
  menuCtx: GridContextMenuTarget;
  handleContextMenuCapture: (e: React.MouseEvent<HTMLDivElement>) => void;
  canCopy: boolean;
  menuFormula: string | null;
  copyFormulaAt: (row: number, col: number) => void;
}

export function useGridContextMenu(opts: {
  sheet: SheetModel;
  totalCols: number;
  selection: Selection | null | undefined;
  expandedBounds: Bounds | null;
  resolveHeaderAt: UseGridPointerApi["resolveHeaderAt"];
  resolveCellAt: UseGridPointerApi["resolveCellAt"];
  emit: UseGridSelectionApi["emit"];
  setSingleCell: UseGridSelectionApi["setSingleCell"];
}): UseGridContextMenuApi {
  const {
    sheet,
    totalCols,
    selection,
    expandedBounds,
    resolveHeaderAt,
    resolveCellAt,
    emit,
    setSingleCell,
  } = opts;

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

  return {
    menuCtx,
    handleContextMenuCapture,
    canCopy,
    menuFormula,
    copyFormulaAt,
  };
}
