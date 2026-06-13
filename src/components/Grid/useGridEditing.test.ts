import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGridEditing } from "./useGridEditing";
import { buildMergeInfo } from "./grid-utils";
import type { CellModel, MergeRange, SheetModel } from "@/lib/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function emptyMerges() {
  return buildMergeInfo([]);
}

/** Build a MergeInfo from 1-indexed range tuples (matching SheetModel.merges). */
function buildMerges(ranges: MergeRange[]) {
  return buildMergeInfo(ranges);
}

function makeTextCell(text: string): CellModel {
  return { v: { t: "Text", c: text } };
}

function makeSheet(rows: (CellModel | undefined)[][]): SheetModel {
  return {
    name: "Sheet1",
    rows: rows as CellModel[][],
    col_widths: [],
    row_heights: [],
    merges: [],
    frozen_rows: 0,
    frozen_cols: 0,
    max_col: rows[0]?.length ?? 0,
  };
}

function makeDefaultOpts(overrides?: Partial<Parameters<typeof useGridEditing>[0]>) {
  return {
    sheet: makeSheet([[makeTextCell("A1"), makeTextCell("B1")], [makeTextCell("A2"), makeTextCell("B2")]]),
    getEditedCell: undefined,
    editEnabled: true,
    totalRows: 2,
    totalCols: 2,
    merges: emptyMerges(),
    onEditStart: vi.fn(),
    ...overrides,
  };
}

/** Build a minimal cell DOM element with data-r and data-c attributes. */
function makeCellElement(r: number, c: number): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-r", String(r));
  el.setAttribute("data-c", String(c));
  return el;
}

/** Create a synthetic React mouse event targeting the given element. */
function makeDoubleClickEvent(target: HTMLElement): React.MouseEvent<HTMLDivElement> {
  return {
    target,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.MouseEvent<HTMLDivElement>;
}

// ─── Tests: cellAt ────────────────────────────────────────────────────────────

describe("useGridEditing — cellAt", () => {
  it("returns edited cell when getEditedCell yields one", () => {
    const editedCell = makeTextCell("EDITED");
    const getEditedCell = vi.fn().mockReturnValue(editedCell);
    const { result } = renderHook(() =>
      useGridEditing(makeDefaultOpts({ getEditedCell })),
    );

    const cell = result.current.cellAt(0, 0);
    expect(cell).toBe(editedCell);
    expect(getEditedCell).toHaveBeenCalledWith(0, 0);
  });

  it("falls back to sheet cell when getEditedCell returns undefined", () => {
    const sheetCell = makeTextCell("Sheet");
    const sheet = makeSheet([[sheetCell]]);
    const getEditedCell = vi.fn().mockReturnValue(undefined);
    const { result } = renderHook(() =>
      useGridEditing(makeDefaultOpts({ sheet, getEditedCell, totalRows: 1, totalCols: 1 })),
    );

    const cell = result.current.cellAt(0, 0);
    expect(cell).toBe(sheetCell);
  });

  it("falls back to sheet cell when getEditedCell is not provided", () => {
    const sheetCell = makeTextCell("FromSheet");
    const sheet = makeSheet([[sheetCell]]);
    const { result } = renderHook(() =>
      useGridEditing(makeDefaultOpts({ sheet, getEditedCell: undefined, totalRows: 1, totalCols: 1 })),
    );

    const cell = result.current.cellAt(0, 0);
    expect(cell).toBe(sheetCell);
  });

  it("returns undefined when row is out of range", () => {
    const { result } = renderHook(() =>
      useGridEditing(makeDefaultOpts()),
    );

    expect(result.current.cellAt(99, 0)).toBeUndefined();
  });

  it("returns undefined when col is out of range", () => {
    const { result } = renderHook(() =>
      useGridEditing(makeDefaultOpts()),
    );

    expect(result.current.cellAt(0, 99)).toBeUndefined();
  });
});

// ─── Tests: handleBodyDoubleClick ─────────────────────────────────────────────

describe("useGridEditing — handleBodyDoubleClick", () => {
  it("calls onEditStart with row and col on dblclick on a scaffold DOM cell", () => {
    const onEditStart = vi.fn();
    const { result } = renderHook(() =>
      useGridEditing(makeDefaultOpts({ onEditStart })),
    );

    const cellEl = makeCellElement(1, 0);
    document.body.appendChild(cellEl);

    act(() => {
      result.current.handleBodyDoubleClick(makeDoubleClickEvent(cellEl));
    });

    expect(onEditStart).toHaveBeenCalledOnce();
    expect(onEditStart).toHaveBeenCalledWith(1, 0);

    document.body.removeChild(cellEl);
  });

  it("does not call onEditStart when editEnabled is false", () => {
    const onEditStart = vi.fn();
    const { result } = renderHook(() =>
      useGridEditing(makeDefaultOpts({ editEnabled: false, onEditStart })),
    );

    const cellEl = makeCellElement(0, 0);
    document.body.appendChild(cellEl);

    act(() => {
      result.current.handleBodyDoubleClick(makeDoubleClickEvent(cellEl));
    });

    expect(onEditStart).not.toHaveBeenCalled();

    document.body.removeChild(cellEl);
  });

  it("does not call onEditStart when editEnabled is undefined", () => {
    const onEditStart = vi.fn();
    const { result } = renderHook(() =>
      useGridEditing(makeDefaultOpts({ editEnabled: undefined, onEditStart })),
    );

    const cellEl = makeCellElement(0, 0);
    document.body.appendChild(cellEl);

    act(() => {
      result.current.handleBodyDoubleClick(makeDoubleClickEvent(cellEl));
    });

    expect(onEditStart).not.toHaveBeenCalled();

    document.body.removeChild(cellEl);
  });

  it("does not call onEditStart when target has no data-r/data-c", () => {
    const onEditStart = vi.fn();
    const { result } = renderHook(() =>
      useGridEditing(makeDefaultOpts({ onEditStart })),
    );

    const plainEl = document.createElement("div");
    document.body.appendChild(plainEl);

    act(() => {
      result.current.handleBodyDoubleClick(makeDoubleClickEvent(plainEl));
    });

    expect(onEditStart).not.toHaveBeenCalled();

    document.body.removeChild(plainEl);
  });

  it("does not call onEditStart when row is out of bounds", () => {
    const onEditStart = vi.fn();
    const { result } = renderHook(() =>
      useGridEditing(makeDefaultOpts({ totalRows: 2, onEditStart })),
    );

    // Row 99 is out of range
    const cellEl = makeCellElement(99, 0);
    document.body.appendChild(cellEl);

    act(() => {
      result.current.handleBodyDoubleClick(makeDoubleClickEvent(cellEl));
    });

    expect(onEditStart).not.toHaveBeenCalled();

    document.body.removeChild(cellEl);
  });

  it("calls onEditStart via bubble from a child of the cell element", () => {
    const onEditStart = vi.fn();
    const { result } = renderHook(() =>
      useGridEditing(makeDefaultOpts({ onEditStart })),
    );

    // Child span inside a data-r/data-c cell
    const cellEl = makeCellElement(0, 1);
    const childEl = document.createElement("span");
    cellEl.appendChild(childEl);
    document.body.appendChild(cellEl);

    act(() => {
      // Target is the child; closest() should find the parent cell element
      result.current.handleBodyDoubleClick(makeDoubleClickEvent(childEl));
    });

    expect(onEditStart).toHaveBeenCalledOnce();
    expect(onEditStart).toHaveBeenCalledWith(0, 1);

    document.body.removeChild(cellEl);
  });

  it("dblclick on a merge placeholder cell calls onEditStart with anchor coords", () => {
    // Merge: 1-indexed r1=2,c1=2,r2=3,c2=3 → 0-indexed rows 1-2, cols 1-2
    // Anchor = (1,1), absorbed cells include (1,2),(2,1),(2,2)
    const ranges: MergeRange[] = [{ r1: 2, c1: 2, r2: 3, c2: 3 }];
    const merges = buildMerges(ranges);

    const onEditStart = vi.fn();
    const { result } = renderHook(() =>
      useGridEditing(makeDefaultOpts({
        merges,
        totalRows: 4,
        totalCols: 4,
        sheet: makeSheet([
          [makeTextCell("0,0"), makeTextCell("0,1"), makeTextCell("0,2"), makeTextCell("0,3")],
          [makeTextCell("1,0"), makeTextCell("1,1"), makeTextCell("1,2"), makeTextCell("1,3")],
          [makeTextCell("2,0"), makeTextCell("2,1"), makeTextCell("2,2"), makeTextCell("2,3")],
          [makeTextCell("3,0"), makeTextCell("3,1"), makeTextCell("3,2"), makeTextCell("3,3")],
        ]),
        onEditStart,
      })),
    );

    // Double-click on an absorbed cell (0-indexed row=1, col=2)
    // resolveActiveCoords should snap it to anchor (row=1, col=1)
    const cellEl = makeCellElement(1, 2);
    document.body.appendChild(cellEl);

    act(() => {
      result.current.handleBodyDoubleClick(makeDoubleClickEvent(cellEl));
    });

    expect(onEditStart).toHaveBeenCalledOnce();
    // Anchor is 0-indexed (1,1)
    expect(onEditStart).toHaveBeenCalledWith(1, 1);

    document.body.removeChild(cellEl);
  });
});
