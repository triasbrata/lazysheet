import { useCallback, useMemo, useState } from "react";
import type { CellModel, CellValue } from "@/lib/types";
import { editKey } from "@/lib/types";

export interface CellEditDTO {
  sheet_name: string;
  row: number;
  col: number;
  value: CellValue;
}

export interface EditBufferApi {
  isDirty: boolean;
  dirtyCount: number;
  getEdit(sheet: string, row: number, col: number): CellModel | undefined;
  setEdit(sheet: string, row: number, col: number, value: CellValue): void;
  restore(sheet: string, row: number, col: number, cell: CellModel | undefined): void;
  clearAll(): void;
  editsForSave(): CellEditDTO[];
}

export function useEditBuffer(): EditBufferApi {
  const [editsBySheet, setEditsBySheet] = useState<
    Map<string, Map<string, CellModel>>
  >(() => new Map());

  const setEdit = useCallback(
    (sheet: string, row: number, col: number, value: CellValue) => {
      setEditsBySheet((prev) => {
        const newOuter = new Map(prev);
        const existingInner = newOuter.get(sheet);
        const newInner = existingInner ? new Map(existingInner) : new Map<string, CellModel>();
        newInner.set(editKey(row, col), { v: value });
        newOuter.set(sheet, newInner);
        return newOuter;
      });
    },
    [],
  );

  const getEdit = useCallback(
    (sheet: string, row: number, col: number): CellModel | undefined => {
      return editsBySheet.get(sheet)?.get(editKey(row, col));
    },
    [editsBySheet],
  );

  const dirtyCount = useMemo(() => {
    let count = 0;
    for (const inner of editsBySheet.values()) {
      count += inner.size;
    }
    return count;
  }, [editsBySheet]);

  const isDirty = dirtyCount > 0;

  const editsForSave = useCallback((): CellEditDTO[] => {
    const result: CellEditDTO[] = [];
    for (const [sheet, inner] of editsBySheet.entries()) {
      for (const [key, cell] of inner.entries()) {
        const parts = key.split(",");
        const row = Number(parts[0]);
        const col = Number(parts[1]);
        result.push({ sheet_name: sheet, row, col, value: cell.v });
      }
    }
    return result;
  }, [editsBySheet]);

  const restore = useCallback(
    (sheet: string, row: number, col: number, cell: CellModel | undefined) => {
      setEditsBySheet((prev) => {
        const outer = new Map(prev);
        const inner = new Map(outer.get(sheet) ?? []);
        if (cell === undefined) {
          inner.delete(editKey(row, col));
        } else {
          inner.set(editKey(row, col), cell);
        }
        if (inner.size === 0) {
          outer.delete(sheet);
        } else {
          outer.set(sheet, inner);
        }
        return outer;
      });
    },
    [],
  );

  const clearAll = useCallback(() => {
    setEditsBySheet(new Map());
  }, []);

  return {
    isDirty,
    dirtyCount,
    getEdit,
    setEdit,
    restore,
    clearAll,
    editsForSave,
  };
}
