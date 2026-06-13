import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGridSelection } from "./useGridSelection";
import { buildMergeInfo } from "./grid-utils";
import type { Selection } from "./grid-utils";
import type { MergeRange } from "@/lib/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function emptyMerges() {
  return buildMergeInfo([]);
}

/** Build a MergeInfo from raw 0-indexed range tuples for readability.
 *  Note: buildMergeInfo expects 0-indexed values matching SheetModel.merges. */
function buildMerges(ranges: MergeRange[]) {
  return buildMergeInfo(ranges);
}

function makeSelection(
  row: number,
  col: number,
  mode: Selection["mode"] = "cell",
): Selection {
  return {
    anchor: { row, col },
    focus: { row, col },
    mode,
    scroll: "none",
    nonce: 1,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useGridSelection — emit", () => {
  it("forwards the selection and scroll arg to onSelectionChange", () => {
    const onSelectionChange = vi.fn();
    const { result } = renderHook(() =>
      useGridSelection({
        selection: null,
        onSelectionChange,
        merges: emptyMerges(),
        totalRows: 10,
        totalCols: 5,
      }),
    );

    const sel: Selection = {
      anchor: { row: 2, col: 3 },
      focus: { row: 2, col: 3 },
      mode: "cell",
      scroll: "none",
      nonce: 42,
    };

    act(() => {
      result.current.emit(sel, "ifNeeded");
    });

    expect(onSelectionChange).toHaveBeenCalledOnce();
    expect(onSelectionChange).toHaveBeenCalledWith(sel, "ifNeeded");
  });

  it("does not throw when onSelectionChange is undefined", () => {
    const { result } = renderHook(() =>
      useGridSelection({
        selection: null,
        onSelectionChange: undefined,
        merges: emptyMerges(),
        totalRows: 10,
        totalCols: 5,
      }),
    );

    const sel: Selection = {
      anchor: { row: 0, col: 0 },
      focus: { row: 0, col: 0 },
      mode: "cell",
      scroll: "none",
      nonce: 1,
    };

    expect(() => act(() => result.current.emit(sel, "none"))).not.toThrow();
  });
});

describe("useGridSelection — setSingleCell", () => {
  it("emits a single-cell selection at the given row/col (no merge)", () => {
    const onSelectionChange = vi.fn();
    const { result } = renderHook(() =>
      useGridSelection({
        selection: null,
        onSelectionChange,
        merges: emptyMerges(),
        totalRows: 10,
        totalCols: 5,
      }),
    );

    act(() => {
      result.current.setSingleCell(2, 3, "ifNeeded");
    });

    expect(onSelectionChange).toHaveBeenCalledOnce();
    const [sel, scroll] = onSelectionChange.mock.calls[0] as [Selection, string];
    expect(sel.anchor).toEqual({ row: 2, col: 3 });
    expect(sel.focus).toEqual({ row: 2, col: 3 });
    expect(sel.mode).toBe("cell");
    expect(scroll).toBe("ifNeeded");
  });

  it("snaps anchor to merge anchor when target is inside a merge", () => {
    // MergeRange values are 1-indexed (matching SheetModel.merges from the Rust backend).
    // Merge at 1-indexed row 3, cols 3-4 ↔ 0-indexed row 2, cols 2-3.
    const merges = buildMerges([{ r1: 3, c1: 3, r2: 3, c2: 4 }]);
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useGridSelection({
        selection: null,
        onSelectionChange,
        merges,
        totalRows: 10,
        totalCols: 5,
      }),
    );

    // Click the absorbed cell (0-indexed row 2, col 3) — should snap to anchor (row 2, col 2)
    act(() => {
      result.current.setSingleCell(2, 3, "none");
    });

    const [sel] = onSelectionChange.mock.calls[0] as [Selection, string];
    expect(sel.anchor).toEqual({ row: 2, col: 2 });
    expect(sel.focus).toEqual({ row: 2, col: 2 });
  });
});

describe("useGridSelection — extendTo", () => {
  it("extends selection from existing anchor to new focus", () => {
    const onSelectionChange = vi.fn();
    const initialSel = makeSelection(1, 1);

    const { result } = renderHook(() =>
      useGridSelection({
        selection: initialSel,
        onSelectionChange,
        merges: emptyMerges(),
        totalRows: 10,
        totalCols: 5,
      }),
    );

    act(() => {
      result.current.extendTo(3, 4, "cell", "ifNeeded");
    });

    const [sel, scroll] = onSelectionChange.mock.calls[0] as [Selection, string];
    expect(sel.anchor).toEqual({ row: 1, col: 1 });
    expect(sel.focus).toEqual({ row: 3, col: 4 });
    expect(sel.mode).toBe("cell");
    expect(scroll).toBe("ifNeeded");
  });

  it("falls back to single-cell behavior when there is no current selection", () => {
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useGridSelection({
        selection: null,
        onSelectionChange,
        merges: emptyMerges(),
        totalRows: 10,
        totalCols: 5,
      }),
    );

    act(() => {
      result.current.extendTo(2, 2, "cell", "none");
    });

    const [sel] = onSelectionChange.mock.calls[0] as [Selection, string];
    // Without an anchor, extendTo delegates to setSingleCell
    expect(sel.anchor).toEqual({ row: 2, col: 2 });
    expect(sel.focus).toEqual({ row: 2, col: 2 });
    expect(sel.mode).toBe("cell");
  });
});

describe("useGridSelection — selectAll", () => {
  it("emits a full-sheet selection covering all rows and cols", () => {
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useGridSelection({
        selection: null,
        onSelectionChange,
        merges: emptyMerges(),
        totalRows: 10,
        totalCols: 5,
      }),
    );

    act(() => {
      result.current.selectAll();
    });

    expect(onSelectionChange).toHaveBeenCalledOnce();
    const [sel, scroll] = onSelectionChange.mock.calls[0] as [Selection, string];
    expect(sel.anchor).toEqual({ row: 0, col: 0 });
    expect(sel.focus).toEqual({ row: 9, col: 4 });
    expect(sel.mode).toBe("all");
    expect(scroll).toBe("none");
  });

  it("does not emit when totalRows or totalCols is 0", () => {
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useGridSelection({
        selection: null,
        onSelectionChange,
        merges: emptyMerges(),
        totalRows: 0,
        totalCols: 5,
      }),
    );

    act(() => {
      result.current.selectAll();
    });

    expect(onSelectionChange).not.toHaveBeenCalled();
  });
});

describe("useGridSelection — selectionRef", () => {
  it("tracks the selection prop across rerenders", () => {
    const sel1 = makeSelection(0, 0);
    const sel2 = makeSelection(3, 2);

    const { result, rerender } = renderHook(
      ({ sel }: { sel: Selection | null }) =>
        useGridSelection({
          selection: sel,
          onSelectionChange: undefined,
          merges: emptyMerges(),
          totalRows: 10,
          totalCols: 5,
        }),
      { initialProps: { sel: sel1 } },
    );

    expect(result.current.selectionRef.current).toEqual(sel1);

    rerender({ sel: sel2 });

    expect(result.current.selectionRef.current).toEqual(sel2);
  });

  it("is null when selection prop is null", () => {
    const { result } = renderHook(() =>
      useGridSelection({
        selection: null,
        onSelectionChange: undefined,
        merges: emptyMerges(),
        totalRows: 10,
        totalCols: 5,
      }),
    );

    expect(result.current.selectionRef.current).toBeNull();
  });

  it("is null when selection prop is undefined", () => {
    const { result } = renderHook(() =>
      useGridSelection({
        selection: undefined,
        onSelectionChange: undefined,
        merges: emptyMerges(),
        totalRows: 10,
        totalCols: 5,
      }),
    );

    expect(result.current.selectionRef.current).toBeNull();
  });
});
