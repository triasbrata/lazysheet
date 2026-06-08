import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEditBuffer } from "@/hooks/useEditBuffer";
import type { CellModel, CellValue } from "@/lib/types";

describe("useEditBuffer", () => {
  describe("initial state", () => {
    it("isDirty is false", () => {
      const { result } = renderHook(() => useEditBuffer());
      expect(result.current.isDirty).toBe(false);
    });

    it("dirtyCount is 0", () => {
      const { result } = renderHook(() => useEditBuffer());
      expect(result.current.dirtyCount).toBe(0);
    });

    it("getEdit returns undefined for any cell", () => {
      const { result } = renderHook(() => useEditBuffer());
      expect(result.current.getEdit("Sheet1", 0, 0)).toBeUndefined();
      expect(result.current.getEdit("Sheet1", 5, 3)).toBeUndefined();
    });

    it("editsForSave() returns empty array", () => {
      const { result } = renderHook(() => useEditBuffer());
      expect(result.current.editsForSave()).toEqual([]);
    });
  });

  describe("setEdit / getEdit", () => {
    it("setEdit then getEdit returns { v: value }", () => {
      const { result } = renderHook(() => useEditBuffer());
      const value: CellValue = { t: "Text", c: "hello" };

      act(() => {
        result.current.setEdit("Sheet1", 0, 0, value);
      });

      expect(result.current.getEdit("Sheet1", 0, 0)).toEqual({ v: value });
    });

    it("stored cell has ONLY the v field (no style or formula)", () => {
      const { result } = renderHook(() => useEditBuffer());
      const value: CellValue = { t: "Number", c: 42 };

      act(() => {
        result.current.setEdit("Sheet1", 1, 2, value);
      });

      const cell = result.current.getEdit("Sheet1", 1, 2);
      expect(cell).toBeDefined();
      expect(Object.keys(cell!)).toEqual(["v"]);
    });

    it("getEdit returns undefined for a cell that was not edited", () => {
      const { result } = renderHook(() => useEditBuffer());

      act(() => {
        result.current.setEdit("Sheet1", 0, 0, { t: "Text", c: "x" });
      });

      expect(result.current.getEdit("Sheet1", 0, 1)).toBeUndefined();
      expect(result.current.getEdit("Sheet1", 1, 0)).toBeUndefined();
    });

    it("multi-sheet isolation: edit on Sheet1 not visible via getEdit('Sheet2',...)", () => {
      const { result } = renderHook(() => useEditBuffer());

      act(() => {
        result.current.setEdit("Sheet1", 2, 3, { t: "Integer", c: 99 });
      });

      expect(result.current.getEdit("Sheet2", 2, 3)).toBeUndefined();
    });

    it("edits on different sheets are independent", () => {
      const { result } = renderHook(() => useEditBuffer());
      const v1: CellValue = { t: "Text", c: "from-sheet1" };
      const v2: CellValue = { t: "Text", c: "from-sheet2" };

      act(() => {
        result.current.setEdit("Sheet1", 0, 0, v1);
        result.current.setEdit("Sheet2", 0, 0, v2);
      });

      expect(result.current.getEdit("Sheet1", 0, 0)).toEqual({ v: v1 });
      expect(result.current.getEdit("Sheet2", 0, 0)).toEqual({ v: v2 });
    });
  });

  describe("dirtyCount / isDirty", () => {
    it("isDirty becomes true after setEdit", () => {
      const { result } = renderHook(() => useEditBuffer());

      act(() => {
        result.current.setEdit("Sheet1", 0, 0, { t: "Text", c: "a" });
      });

      expect(result.current.isDirty).toBe(true);
    });

    it("dirtyCount increments per distinct cell", () => {
      const { result } = renderHook(() => useEditBuffer());

      act(() => {
        result.current.setEdit("Sheet1", 0, 0, { t: "Text", c: "a" });
      });
      expect(result.current.dirtyCount).toBe(1);

      act(() => {
        result.current.setEdit("Sheet1", 0, 1, { t: "Text", c: "b" });
      });
      expect(result.current.dirtyCount).toBe(2);

      act(() => {
        result.current.setEdit("Sheet2", 0, 0, { t: "Text", c: "c" });
      });
      expect(result.current.dirtyCount).toBe(3);
    });

    it("overwriting the SAME cell keeps dirtyCount stable (still 1)", () => {
      const { result } = renderHook(() => useEditBuffer());

      act(() => {
        result.current.setEdit("Sheet1", 0, 0, { t: "Text", c: "first" });
      });
      expect(result.current.dirtyCount).toBe(1);

      act(() => {
        result.current.setEdit("Sheet1", 0, 0, { t: "Text", c: "second" });
      });
      expect(result.current.dirtyCount).toBe(1);
    });

    it("overwriting the SAME cell updates the stored value", () => {
      const { result } = renderHook(() => useEditBuffer());

      act(() => {
        result.current.setEdit("Sheet1", 0, 0, { t: "Text", c: "first" });
      });
      act(() => {
        result.current.setEdit("Sheet1", 0, 0, { t: "Text", c: "second" });
      });

      expect(result.current.getEdit("Sheet1", 0, 0)).toEqual({
        v: { t: "Text", c: "second" },
      });
    });
  });

  describe("editsForSave()", () => {
    it("returns correct shape for a single edit", () => {
      const { result } = renderHook(() => useEditBuffer());
      const value: CellValue = { t: "Integer", c: 7 };

      act(() => {
        result.current.setEdit("Sheet1", 3, 4, value);
      });

      const edits = result.current.editsForSave();
      expect(edits).toHaveLength(1);
      expect(edits[0]).toEqual({
        sheet_name: "Sheet1",
        row: 3,
        col: 4,
        value,
      });
    });

    it("row/col round-trip: setEdit('S',3,4,...) → editsForSave() has {sheet_name:'S',row:3,col:4}", () => {
      const { result } = renderHook(() => useEditBuffer());
      const value: CellValue = { t: "Bool", c: true };

      act(() => {
        result.current.setEdit("S", 3, 4, value);
      });

      const edits = result.current.editsForSave();
      expect(edits).toHaveLength(1);
      expect(edits[0].sheet_name).toBe("S");
      expect(edits[0].row).toBe(3);
      expect(edits[0].col).toBe(4);
      expect(edits[0].value).toEqual(value);
    });

    it("returns all edits across multiple sheets", () => {
      const { result } = renderHook(() => useEditBuffer());

      act(() => {
        result.current.setEdit("Sheet1", 0, 0, { t: "Text", c: "a" });
        result.current.setEdit("Sheet2", 1, 2, { t: "Integer", c: 10 });
      });

      const edits = result.current.editsForSave();
      expect(edits).toHaveLength(2);

      const sheet1Edit = edits.find((e) => e.sheet_name === "Sheet1");
      const sheet2Edit = edits.find((e) => e.sheet_name === "Sheet2");

      expect(sheet1Edit).toEqual({
        sheet_name: "Sheet1",
        row: 0,
        col: 0,
        value: { t: "Text", c: "a" },
      });
      expect(sheet2Edit).toEqual({
        sheet_name: "Sheet2",
        row: 1,
        col: 2,
        value: { t: "Integer", c: 10 },
      });
    });

    it("returns updated value after overwrite", () => {
      const { result } = renderHook(() => useEditBuffer());

      act(() => {
        result.current.setEdit("Sheet1", 0, 0, { t: "Text", c: "old" });
      });
      act(() => {
        result.current.setEdit("Sheet1", 0, 0, { t: "Text", c: "new" });
      });

      const edits = result.current.editsForSave();
      expect(edits).toHaveLength(1);
      expect(edits[0].value).toEqual({ t: "Text", c: "new" });
    });

    it("supports all CellValue variants", () => {
      const { result } = renderHook(() => useEditBuffer());
      const variants: CellValue[] = [
        { t: "Empty" },
        { t: "Text", c: "hi" },
        { t: "Number", c: 1.5 },
        { t: "Integer", c: 42 },
        { t: "Bool", c: false },
        { t: "Date", c: "2024-01-01" },
        { t: "Error", c: "#REF!" },
      ];

      act(() => {
        variants.forEach((v, i) => {
          result.current.setEdit("Sheet1", i, 0, v);
        });
      });

      const edits = result.current.editsForSave();
      expect(edits).toHaveLength(variants.length);

      variants.forEach((v, i) => {
        const edit = edits.find((e) => e.row === i);
        expect(edit?.value).toEqual(v);
      });
    });
  });

  describe("clearAll()", () => {
    it("resets isDirty to false", () => {
      const { result } = renderHook(() => useEditBuffer());

      act(() => {
        result.current.setEdit("Sheet1", 0, 0, { t: "Text", c: "x" });
      });
      expect(result.current.isDirty).toBe(true);

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.isDirty).toBe(false);
    });

    it("resets dirtyCount to 0", () => {
      const { result } = renderHook(() => useEditBuffer());

      act(() => {
        result.current.setEdit("Sheet1", 0, 0, { t: "Text", c: "a" });
        result.current.setEdit("Sheet1", 1, 1, { t: "Text", c: "b" });
      });
      expect(result.current.dirtyCount).toBe(2);

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.dirtyCount).toBe(0);
    });

    it("editsForSave() returns [] after clearAll", () => {
      const { result } = renderHook(() => useEditBuffer());

      act(() => {
        result.current.setEdit("Sheet1", 0, 0, { t: "Text", c: "a" });
        result.current.setEdit("Sheet2", 1, 2, { t: "Integer", c: 5 });
      });

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.editsForSave()).toEqual([]);
    });

    it("getEdit returns undefined after clearAll", () => {
      const { result } = renderHook(() => useEditBuffer());

      act(() => {
        result.current.setEdit("Sheet1", 0, 0, { t: "Text", c: "x" });
      });
      expect(result.current.getEdit("Sheet1", 0, 0)).toBeDefined();

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.getEdit("Sheet1", 0, 0)).toBeUndefined();
    });

    it("clearAll on already-empty buffer keeps state clean", () => {
      const { result } = renderHook(() => useEditBuffer());

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.isDirty).toBe(false);
      expect(result.current.dirtyCount).toBe(0);
      expect(result.current.editsForSave()).toEqual([]);
    });
  });

  describe("restore()", () => {
    it("restore with a CellModel sets the edit and dirtyCount increments", () => {
      const { result } = renderHook(() => useEditBuffer());
      const cell: CellModel = { v: { t: "Text", c: "restored" } };

      act(() => {
        result.current.restore("Sheet1", 2, 3, cell);
      });

      expect(result.current.getEdit("Sheet1", 2, 3)).toEqual(cell);
      expect(result.current.dirtyCount).toBe(1);
    });

    it("restore with a CellModel overwrites an existing edit", () => {
      const { result } = renderHook(() => useEditBuffer());
      const original: CellModel = { v: { t: "Text", c: "original" } };
      const restored: CellModel = { v: { t: "Text", c: "restored" } };

      act(() => {
        result.current.setEdit("Sheet1", 0, 0, original.v);
      });
      act(() => {
        result.current.restore("Sheet1", 0, 0, restored);
      });

      expect(result.current.getEdit("Sheet1", 0, 0)).toEqual(restored);
      expect(result.current.dirtyCount).toBe(1);
    });

    it("restore undefined on an existing edit removes it and cleans up sheet map when empty", () => {
      const { result } = renderHook(() => useEditBuffer());

      act(() => {
        result.current.setEdit("Sheet1", 1, 1, { t: "Integer", c: 42 });
      });
      expect(result.current.dirtyCount).toBe(1);

      act(() => {
        result.current.restore("Sheet1", 1, 1, undefined);
      });

      expect(result.current.getEdit("Sheet1", 1, 1)).toBeUndefined();
      expect(result.current.dirtyCount).toBe(0);
      expect(result.current.isDirty).toBe(false);
    });

    it("restore undefined on a sheet with multiple edits removes only the target cell", () => {
      const { result } = renderHook(() => useEditBuffer());

      act(() => {
        result.current.setEdit("Sheet1", 0, 0, { t: "Text", c: "a" });
        result.current.setEdit("Sheet1", 0, 1, { t: "Text", c: "b" });
      });
      expect(result.current.dirtyCount).toBe(2);

      act(() => {
        result.current.restore("Sheet1", 0, 0, undefined);
      });

      expect(result.current.getEdit("Sheet1", 0, 0)).toBeUndefined();
      expect(result.current.getEdit("Sheet1", 0, 1)).toEqual({ v: { t: "Text", c: "b" } });
      expect(result.current.dirtyCount).toBe(1);
    });

    it("restore undefined on an absent cell is a no-op (no throw, dirtyCount stays 0)", () => {
      const { result } = renderHook(() => useEditBuffer());

      expect(() => {
        act(() => {
          result.current.restore("Sheet1", 5, 5, undefined);
        });
      }).not.toThrow();

      expect(result.current.dirtyCount).toBe(0);
      expect(result.current.isDirty).toBe(false);
    });

    it("restore undefined on absent cell in a sheet with other edits leaves other edits intact", () => {
      const { result } = renderHook(() => useEditBuffer());

      act(() => {
        result.current.setEdit("Sheet1", 0, 0, { t: "Text", c: "x" });
      });

      act(() => {
        result.current.restore("Sheet1", 9, 9, undefined);
      });

      expect(result.current.dirtyCount).toBe(1);
      expect(result.current.getEdit("Sheet1", 0, 0)).toBeDefined();
    });
  });
});
