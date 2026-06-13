/**
 * useGridKeyboard.test.ts
 *
 * Tests for the useGridKeyboard hook covering:
 *  - ArrowRight moves anchor (setSingleCell called)
 *  - Shift+Arrow extends selection (extendTo called)
 *  - Ctrl/Cmd+A → selectAll called
 *  - Ctrl+C → onCopyDefault called
 *  - Ctrl+Shift+C → copyFormulaAt called
 *  - Tab / Shift+Tab traversal
 *  - Enter traversal
 *  - Home / End / Ctrl+Home / Ctrl+End
 *  - F2 → onEditStart when editEnabled=true
 *  - Typing a printable char → does NOT trigger onEditStart (the hook only handles nav/shortcuts)
 *  - Escape during drag → dragState cleared + stopAutoScroll called
 *  - No selection (selection=null) navigation still works (falls back to first visible)
 *  - No onSelectionChange → no-op
 *  - INPUT/TEXTAREA target → early return (no side-effects)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGridKeyboard } from "./useGridKeyboard";
import type { MergeInfo, Selection } from "./grid-utils";
import type { UseGridSelectionApi } from "./useGridSelection";
import type { DragState } from "./useGridPointer";
import type { SheetModel } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEmptyMerges(): MergeInfo {
  return { anchors: new Map(), absorbed: new Map() };
}

function makeSheet(rows = 5, cols = 4): SheetModel {
  return {
    name: "Sheet1",
    rows: Array.from({ length: rows }, () => ({})),
    max_col: cols,
    col_widths: [],
    row_heights: [],
    merges: [],
  } as unknown as SheetModel;
}

function makeSelection(row = 0, col = 0): Selection {
  return {
    anchor: { row, col },
    focus: { row, col },
    mode: "cell",
    scroll: "none",
    nonce: 0,
  };
}

/** Build a synthetic keyboard event that resembles React.KeyboardEvent */
function makeKeyEvent(
  key: string,
  opts: {
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    target?: EventTarget | null;
    currentTarget?: HTMLElement | null;
  } = {},
): React.KeyboardEvent<HTMLDivElement> {
  const div = document.createElement("div");
  const target = (opts.target ?? div) as EventTarget;
  const currentTarget = (opts.currentTarget ?? div) as HTMLElement;
  return {
    key,
    ctrlKey: opts.ctrlKey ?? false,
    metaKey: opts.metaKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    target,
    currentTarget,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.KeyboardEvent<HTMLDivElement>;
}

// ─── Default opts builder ─────────────────────────────────────────────────────

function buildOpts(overrides: Partial<Parameters<typeof useGridKeyboard>[0]> = {}) {
  const emit = vi.fn();
  const setSingleCell = vi.fn();
  const extendTo = vi.fn();
  const selectAll = vi.fn();
  const onCopyDefault = vi.fn();
  const copyFormulaAt = vi.fn();
  const onEditStart = vi.fn();
  const stopAutoScroll = vi.fn();
  const onSelectionChange = vi.fn();

  const selection = makeSelection(0, 0);
  const selectionRef = { current: selection } as UseGridSelectionApi["selectionRef"];
  const dragState = { current: null } as { current: DragState | null };
  const scrollRef = { current: null } as { current: HTMLDivElement | null };

  return {
    opts: {
      sheet: makeSheet(),
      totalRows: 5,
      totalCols: 4,
      merges: makeEmptyMerges(),
      headerHeight: 30,
      selection,
      selectionRef,
      emit,
      setSingleCell,
      extendTo,
      selectAll,
      dragState,
      stopAutoScroll,
      scrollRef,
      editEnabled: true,
      editingCell: null,
      onEditStart,
      onSelectionChange,
      onCopyDefault,
      copyFormulaAt,
      ...overrides,
    },
    mocks: {
      emit,
      setSingleCell,
      extendTo,
      selectAll,
      onCopyDefault,
      copyFormulaAt,
      onEditStart,
      stopAutoScroll,
      onSelectionChange,
      selectionRef,
      dragState,
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useGridKeyboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Basic navigation ───────────────────────────────────────────────────────

  it("ArrowRight → setSingleCell(0, 1) called", () => {
    const { opts, mocks } = buildOpts();
    const { result } = renderHook(() => useGridKeyboard(opts));

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("ArrowRight"));
    });

    expect(mocks.setSingleCell).toHaveBeenCalledWith(0, 1, "ifNeeded");
  });

  it("ArrowLeft → setSingleCell(0, 0) called (already at boundary, no change → no call)", () => {
    // Anchor at (0,0), ArrowLeft => nextVisibleCol returns 0 (no change) → no call
    const { opts, mocks } = buildOpts();
    const { result } = renderHook(() => useGridKeyboard(opts));

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("ArrowLeft"));
    });

    // nextC === baseC and cur is set, so early-return fires
    expect(mocks.setSingleCell).not.toHaveBeenCalled();
  });

  it("ArrowDown → setSingleCell(1, 0) called", () => {
    const { opts, mocks } = buildOpts();
    const { result } = renderHook(() => useGridKeyboard(opts));

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("ArrowDown"));
    });

    expect(mocks.setSingleCell).toHaveBeenCalledWith(1, 0, "ifNeeded");
  });

  it("ArrowUp → no change when already at row 0", () => {
    const { opts, mocks } = buildOpts();
    const { result } = renderHook(() => useGridKeyboard(opts));

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("ArrowUp"));
    });

    expect(mocks.setSingleCell).not.toHaveBeenCalled();
  });

  // ── Shift+Arrow extends ────────────────────────────────────────────────────

  it("Shift+ArrowRight → extendTo called (not setSingleCell)", () => {
    const { opts, mocks } = buildOpts();
    const { result } = renderHook(() => useGridKeyboard(opts));

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("ArrowRight", { shiftKey: true }));
    });

    expect(mocks.extendTo).toHaveBeenCalledWith(0, 1, "cell", "ifNeeded");
    expect(mocks.setSingleCell).not.toHaveBeenCalled();
  });

  it("Shift+ArrowDown → extendTo called", () => {
    const { opts, mocks } = buildOpts();
    const { result } = renderHook(() => useGridKeyboard(opts));

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("ArrowDown", { shiftKey: true }));
    });

    expect(mocks.extendTo).toHaveBeenCalledWith(1, 0, "cell", "ifNeeded");
    expect(mocks.setSingleCell).not.toHaveBeenCalled();
  });

  // ── Tab / Enter ────────────────────────────────────────────────────────────

  it("Tab → setSingleCell (not extendTo) even with Shift pressed for Shift+Tab", () => {
    const { opts, mocks } = buildOpts({ selection: makeSelection(0, 1) });
    // Update selectionRef to match
    mocks.selectionRef.current = makeSelection(0, 1);
    const { result } = renderHook(() =>
      useGridKeyboard({ ...opts, selection: makeSelection(0, 1) }),
    );

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("Tab", { shiftKey: true }));
    });

    // Shift+Tab goes left → col 0, row 0
    expect(mocks.setSingleCell).toHaveBeenCalledWith(0, 0, "ifNeeded");
    expect(mocks.extendTo).not.toHaveBeenCalled();
  });

  it("Tab → moves right (setSingleCell)", () => {
    const { opts, mocks } = buildOpts();
    const { result } = renderHook(() => useGridKeyboard(opts));

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("Tab"));
    });

    expect(mocks.setSingleCell).toHaveBeenCalledWith(0, 1, "ifNeeded");
  });

  it("Enter → moves down (setSingleCell, not extendTo even with Shift)", () => {
    const { opts, mocks } = buildOpts();
    const { result } = renderHook(() => useGridKeyboard(opts));

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("Enter", { shiftKey: true }));
    });

    expect(mocks.setSingleCell).toHaveBeenCalledWith(1, 0, "ifNeeded");
    expect(mocks.extendTo).not.toHaveBeenCalled();
  });

  // ── Home / End ─────────────────────────────────────────────────────────────

  it("Home → moves to col 0", () => {
    const { opts, mocks } = buildOpts({ selection: makeSelection(2, 3) });
    mocks.selectionRef.current = makeSelection(2, 3);
    const { result } = renderHook(() =>
      useGridKeyboard({ ...opts, selection: makeSelection(2, 3) }),
    );

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("Home"));
    });

    // col becomes 0; row stays 2 (no Ctrl)
    expect(mocks.setSingleCell).toHaveBeenCalledWith(2, 0, "ifNeeded");
  });

  it("Ctrl+Home → moves to row 0, col 0", () => {
    const { opts, mocks } = buildOpts({ selection: makeSelection(3, 3) });
    mocks.selectionRef.current = makeSelection(3, 3);
    const { result } = renderHook(() =>
      useGridKeyboard({ ...opts, selection: makeSelection(3, 3) }),
    );

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("Home", { ctrlKey: true }));
    });

    expect(mocks.setSingleCell).toHaveBeenCalledWith(0, 0, "ifNeeded");
  });

  it("End → moves to last col", () => {
    const { opts, mocks } = buildOpts({ selection: makeSelection(1, 0) });
    mocks.selectionRef.current = makeSelection(1, 0);
    const { result } = renderHook(() =>
      useGridKeyboard({ ...opts, selection: makeSelection(1, 0) }),
    );

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("End"));
    });

    // lastVisibleCol(sheet, 4) → 3 (0-indexed last)
    expect(mocks.setSingleCell).toHaveBeenCalledWith(1, 3, "ifNeeded");
  });

  it("Ctrl+End → moves to last row, last col", () => {
    const { opts, mocks } = buildOpts({ selection: makeSelection(0, 0) });
    mocks.selectionRef.current = makeSelection(0, 0);
    const { result } = renderHook(() =>
      useGridKeyboard({ ...opts, selection: makeSelection(0, 0) }),
    );

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("End", { ctrlKey: true }));
    });

    // lastVisibleRow(sheet, 5) → 4, lastVisibleCol(sheet, 4) → 3
    expect(mocks.setSingleCell).toHaveBeenCalledWith(4, 3, "ifNeeded");
  });

  // ── Ctrl+A ────────────────────────────────────────────────────────────────

  it("Ctrl+A → selectAll called", () => {
    const { opts, mocks } = buildOpts();
    const { result } = renderHook(() => useGridKeyboard(opts));

    const e = makeKeyEvent("a", { ctrlKey: true });
    act(() => {
      result.current.handleKeyDown(e);
    });

    expect(mocks.selectAll).toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it("Meta+A → selectAll called", () => {
    const { opts, mocks } = buildOpts();
    const { result } = renderHook(() => useGridKeyboard(opts));

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("a", { metaKey: true }));
    });

    expect(mocks.selectAll).toHaveBeenCalled();
  });

  // ── Ctrl+C ────────────────────────────────────────────────────────────────

  it("Ctrl+C → onCopyDefault called", () => {
    const { opts, mocks } = buildOpts();
    const { result } = renderHook(() => useGridKeyboard(opts));

    const e = makeKeyEvent("c", { ctrlKey: true });
    act(() => {
      result.current.handleKeyDown(e);
    });

    expect(mocks.onCopyDefault).toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalled();
    expect(mocks.copyFormulaAt).not.toHaveBeenCalled();
  });

  // ── Ctrl+Shift+C ──────────────────────────────────────────────────────────

  it("Ctrl+Shift+C → copyFormulaAt called with anchor coords", () => {
    const { opts, mocks } = buildOpts({ selection: makeSelection(2, 1) });
    mocks.selectionRef.current = makeSelection(2, 1);
    const { result } = renderHook(() =>
      useGridKeyboard({ ...opts, selection: makeSelection(2, 1) }),
    );

    const e = makeKeyEvent("c", { ctrlKey: true, shiftKey: true });
    act(() => {
      result.current.handleKeyDown(e);
    });

    expect(mocks.copyFormulaAt).toHaveBeenCalledWith(2, 1);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(mocks.onCopyDefault).not.toHaveBeenCalled();
  });

  // ── F2 / edit start ───────────────────────────────────────────────────────

  it("F2 → onEditStart called when editEnabled=true and no editingCell", () => {
    const { opts, mocks } = buildOpts({ selection: makeSelection(1, 2) });
    mocks.selectionRef.current = makeSelection(1, 2);
    const { result } = renderHook(() =>
      useGridKeyboard({ ...opts, selection: makeSelection(1, 2) }),
    );

    const e = makeKeyEvent("F2");
    act(() => {
      result.current.handleKeyDown(e);
    });

    expect(mocks.onEditStart).toHaveBeenCalledWith(1, 2);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it("F2 → onEditStart NOT called when editEnabled=false", () => {
    const { opts, mocks } = buildOpts({ editEnabled: false });
    const { result } = renderHook(() => useGridKeyboard(opts));

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("F2"));
    });

    expect(mocks.onEditStart).not.toHaveBeenCalled();
  });

  it("F2 → onEditStart NOT called when editingCell is set (already editing)", () => {
    const { opts, mocks } = buildOpts({
      editingCell: { row: 0, col: 0 },
    });
    const { result } = renderHook(() => useGridKeyboard(opts));

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("F2"));
    });

    expect(mocks.onEditStart).not.toHaveBeenCalled();
  });

  // ── Escape during drag ────────────────────────────────────────────────────

  it("Escape during active drag → emit collapse + dragState cleared + stopAutoScroll", () => {
    const { opts, mocks } = buildOpts();
    // Simulate an active drag
    mocks.dragState.current = { active: true, mode: "cell", pointerId: 1 };
    mocks.selectionRef.current = makeSelection(2, 2);

    const { result } = renderHook(() => useGridKeyboard(opts));

    const e = makeKeyEvent("Escape");
    act(() => {
      result.current.handleKeyDown(e);
    });

    expect(mocks.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        anchor: { row: 2, col: 2 },
        focus: { row: 2, col: 2 },
        mode: "cell",
        scroll: "none",
      }),
      "none",
    );
    expect(mocks.dragState.current).toBeNull();
    expect(mocks.stopAutoScroll).toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it("Escape when no active drag → no-op", () => {
    const { opts, mocks } = buildOpts();
    // dragState.current is null by default
    const { result } = renderHook(() => useGridKeyboard(opts));

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("Escape"));
    });

    expect(mocks.stopAutoScroll).not.toHaveBeenCalled();
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  // ── No onSelectionChange → early return ───────────────────────────────────

  it("no onSelectionChange → entire handler is a no-op", () => {
    const { opts, mocks } = buildOpts({ onSelectionChange: undefined });
    const { result } = renderHook(() => useGridKeyboard(opts));

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("ArrowRight"));
    });

    expect(mocks.setSingleCell).not.toHaveBeenCalled();
    expect(mocks.emit).not.toHaveBeenCalled();
    expect(mocks.selectAll).not.toHaveBeenCalled();
  });

  // ── INPUT / TEXTAREA target → early return ────────────────────────────────

  it("INPUT target → no-op", () => {
    const { opts, mocks } = buildOpts();
    const { result } = renderHook(() => useGridKeyboard(opts));

    const input = document.createElement("input");
    act(() => {
      result.current.handleKeyDown(makeKeyEvent("ArrowRight", { target: input }));
    });

    expect(mocks.setSingleCell).not.toHaveBeenCalled();
  });

  it("TEXTAREA target → no-op", () => {
    const { opts, mocks } = buildOpts();
    const { result } = renderHook(() => useGridKeyboard(opts));

    const textarea = document.createElement("textarea");
    act(() => {
      result.current.handleKeyDown(makeKeyEvent("ArrowRight", { target: textarea }));
    });

    expect(mocks.setSingleCell).not.toHaveBeenCalled();
  });

  // ── Non-nav key → no-op (not in navKeys set) ──────────────────────────────

  it("non-nav key 'a' without ctrl → no action", () => {
    const { opts, mocks } = buildOpts();
    const { result } = renderHook(() => useGridKeyboard(opts));

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("a"));
    });

    expect(mocks.setSingleCell).not.toHaveBeenCalled();
    expect(mocks.extendTo).not.toHaveBeenCalled();
  });

  // ── No selection → falls back to firstVisible coords ─────────────────────

  it("ArrowRight with selection=null still calls setSingleCell (falls back to first visible)", () => {
    const { opts, mocks } = buildOpts({ selection: null });
    mocks.selectionRef.current = null;
    const { result } = renderHook(() =>
      useGridKeyboard({ ...opts, selection: null }),
    );

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("ArrowRight"));
    });

    // baseC = firstVisibleCol(sheet, 4) → 0; nextC = 1
    expect(mocks.setSingleCell).toHaveBeenCalledWith(0, 1, "ifNeeded");
  });

  // ── PageDown / PageUp ─────────────────────────────────────────────────────

  it("PageDown with scrollRef.current = null → steps using DEFAULT_ROW_HEIGHT fallback", () => {
    const { opts, mocks } = buildOpts({ selection: makeSelection(0, 0) });
    mocks.selectionRef.current = makeSelection(0, 0);
    // scrollRef.current is null by default — fallback to DEFAULT_ROW_HEIGHT * 20 / DEFAULT_ROW_HEIGHT = 20 steps
    const { result } = renderHook(() =>
      useGridKeyboard({ ...opts, selection: makeSelection(0, 0) }),
    );

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("PageDown"));
    });

    // Sheet has 5 rows; PageDown should land on row 4 (last row)
    expect(mocks.setSingleCell).toHaveBeenCalledWith(4, 0, "ifNeeded");
  });

  it("PageUp with scrollRef.current = null → steps backward (no move from row 0)", () => {
    const { opts, mocks } = buildOpts({ selection: makeSelection(0, 0) });
    mocks.selectionRef.current = makeSelection(0, 0);
    const { result } = renderHook(() =>
      useGridKeyboard({ ...opts, selection: makeSelection(0, 0) }),
    );

    act(() => {
      result.current.handleKeyDown(makeKeyEvent("PageUp"));
    });

    // Already at row 0, can't move up → no change → no call
    expect(mocks.setSingleCell).not.toHaveBeenCalled();
  });
});
