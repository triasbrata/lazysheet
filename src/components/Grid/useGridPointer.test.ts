/**
 * useGridPointer.test.ts
 *
 * Tests for the useGridPointer hook covering:
 *  - resolveCellAt / resolveHeaderAt (DOM scaffold)
 *  - handleBodyPointerDown: cell click → setSingleCell; shift+click → extendTo
 *  - handleBodyPointerMove: drag extends selection; no active drag → no-op
 *  - endDrag: clears drag state; subsequent move does nothing
 *  - handleCornerPointerDown: selectAll
 *  - handleColHeaderPointerDown: emit col selection
 *  - handleRowHeaderPointerDown: emit row selection
 *  - auto-scroll: RAF started near edge, stopAutoScroll/endDrag cancels
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGridPointer } from "./useGridPointer";
import type { Selection } from "./grid-utils";
import type { UseGridSelectionApi } from "./useGridSelection";

// ─── jsdom stubs ──────────────────────────────────────────────────────────────
// jsdom doesn't implement setPointerCapture/releasePointerCapture — stub them
// so the hook can call them without error (same pattern as Grid.test.tsx).

const hadSetPointerCapture = !!Element.prototype.setPointerCapture;
const hadReleasePointerCapture = !!Element.prototype.releasePointerCapture;

beforeAll(() => {
  if (!hadSetPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!hadReleasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
});

afterAll(() => {
  if (!hadSetPointerCapture) {
    delete (Element.prototype as unknown as Record<string, unknown>).setPointerCapture;
  }
  if (!hadReleasePointerCapture) {
    delete (Element.prototype as unknown as Record<string, unknown>).releasePointerCapture;
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal DOM scaffold that mirrors the data attributes the hook's
 * resolveCellAt / resolveHeaderAt functions walk.
 *
 * Layout:
 *   scrollContainer
 *     colHeader[0]     data-col-header="0"
 *     colHeader[1]     data-col-header="1"
 *     rowHeader[0]     data-row-header="0"
 *     rowHeader[1]     data-row-header="1"
 *     cell[0,0]        data-r="0" data-c="0"
 *     cell[0,1]        data-r="0" data-c="1"
 *     cell[1,0]        data-r="1" data-c="0"
 */
function buildScaffold() {
  const container = document.createElement("div");
  container.tabIndex = 0;
  Object.defineProperty(container, "focus", { value: vi.fn(), configurable: true });

  const colHeader0 = document.createElement("div");
  colHeader0.setAttribute("data-col-header", "0");
  const colHeader1 = document.createElement("div");
  colHeader1.setAttribute("data-col-header", "1");

  const rowHeader0 = document.createElement("div");
  rowHeader0.setAttribute("data-row-header", "0");
  const rowHeader1 = document.createElement("div");
  rowHeader1.setAttribute("data-row-header", "1");

  const cell00 = document.createElement("div");
  cell00.setAttribute("data-r", "0");
  cell00.setAttribute("data-c", "0");
  const cell01 = document.createElement("div");
  cell01.setAttribute("data-r", "0");
  cell01.setAttribute("data-c", "1");
  const cell10 = document.createElement("div");
  cell10.setAttribute("data-r", "1");
  cell10.setAttribute("data-c", "0");

  container.appendChild(colHeader0);
  container.appendChild(colHeader1);
  container.appendChild(rowHeader0);
  container.appendChild(rowHeader1);
  container.appendChild(cell00);
  container.appendChild(cell01);
  container.appendChild(cell10);
  document.body.appendChild(container);

  return {
    container,
    colHeader0,
    colHeader1,
    rowHeader0,
    rowHeader1,
    cell00,
    cell01,
    cell10,
    cleanup: () => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    },
  };
}

/** Make a minimal Selection object */
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

/** Build mock UseGridSelectionApi functions and a mutable selectionRef. */
function makeSelectionApi(initialSelection: Selection | null = null): {
  emit: ReturnType<typeof vi.fn>;
  setSingleCell: ReturnType<typeof vi.fn>;
  extendTo: ReturnType<typeof vi.fn>;
  selectAll: ReturnType<typeof vi.fn>;
  selectionRef: { current: Selection | null };
} {
  const selectionRef: { current: Selection | null } = { current: initialSelection };
  const emit = vi.fn((next: Selection, _scroll: "none" | "ifNeeded" | "center") => {
    selectionRef.current = next;
  });
  const setSingleCell = vi.fn((row: number, col: number) => {
    selectionRef.current = makeSelection(row, col);
    emit(selectionRef.current, "none");
  });
  const extendTo = vi.fn();
  const selectAll = vi.fn();
  return { emit, setSingleCell, extendTo, selectAll, selectionRef };
}

/** Synthetic PointerEvent-like object for React pointer handlers. */
function makePointerEvent(
  overrides: Partial<React.PointerEvent<HTMLDivElement>> & { currentTarget?: HTMLDivElement },
): React.PointerEvent<HTMLDivElement> {
  return {
    button: 0,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    shiftKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    target: document.createElement("div"),
    currentTarget: document.createElement("div"),
    ...overrides,
  } as unknown as React.PointerEvent<HTMLDivElement>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useGridPointer — resolveCellAt", () => {
  it("returns row/col for element with data-r/data-c attributes", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const api = makeSelectionApi();

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange: vi.fn(),
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 2,
        totalCols: 2,
        headerHeight: 24,
      }),
    );

    // Mock elementFromPoint to return the cell element
    const originalEFP = document.elementFromPoint;
    document.elementFromPoint = vi.fn().mockReturnValue(scaffold.cell00);
    const resolved = result.current.resolveCellAt(100, 50);
    document.elementFromPoint = originalEFP;

    expect(resolved).toEqual({ row: 0, col: 0 });
    scaffold.cleanup();
  });

  it("returns null when elementFromPoint returns null", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const api = makeSelectionApi();

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange: vi.fn(),
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 2,
        totalCols: 2,
        headerHeight: 24,
      }),
    );

    const originalEFP = document.elementFromPoint;
    document.elementFromPoint = vi.fn().mockReturnValue(null);
    const resolved = result.current.resolveCellAt(9999, 9999);
    document.elementFromPoint = originalEFP;

    expect(resolved).toBeNull();
    scaffold.cleanup();
  });
});

describe("useGridPointer — resolveHeaderAt", () => {
  it("returns {kind: 'col', index} for element with data-col-header attribute", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const api = makeSelectionApi();

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange: vi.fn(),
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 2,
        totalCols: 2,
        headerHeight: 24,
      }),
    );

    const originalEFP = document.elementFromPoint;
    document.elementFromPoint = vi.fn().mockReturnValue(scaffold.colHeader1);
    const resolved = result.current.resolveHeaderAt(200, 13);
    document.elementFromPoint = originalEFP;

    expect(resolved).toEqual({ kind: "col", index: 1 });
    scaffold.cleanup();
  });

  it("returns {kind: 'row', index} for element with data-row-header attribute", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const api = makeSelectionApi();

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange: vi.fn(),
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 2,
        totalCols: 2,
        headerHeight: 24,
      }),
    );

    const originalEFP = document.elementFromPoint;
    document.elementFromPoint = vi.fn().mockReturnValue(scaffold.rowHeader0);
    const resolved = result.current.resolveHeaderAt(22, 50);
    document.elementFromPoint = originalEFP;

    expect(resolved).toEqual({ kind: "row", index: 0 });
    scaffold.cleanup();
  });

  it("returns null when no header element found", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const api = makeSelectionApi();

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange: vi.fn(),
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 2,
        totalCols: 2,
        headerHeight: 24,
      }),
    );

    const originalEFP = document.elementFromPoint;
    // Return a plain div with no data attributes
    document.elementFromPoint = vi.fn().mockReturnValue(document.createElement("div"));
    const resolved = result.current.resolveHeaderAt(0, 0);
    document.elementFromPoint = originalEFP;

    expect(resolved).toBeNull();
    scaffold.cleanup();
  });
});

describe("useGridPointer — handleBodyPointerDown", () => {
  it("pointerdown on a cell calls setSingleCell", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const api = makeSelectionApi();
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 2,
        totalCols: 2,
        headerHeight: 24,
      }),
    );

    const bodyDiv = document.createElement("div");
    bodyDiv.setPointerCapture = vi.fn();
    const event = makePointerEvent({
      button: 0,
      pointerId: 1,
      target: scaffold.cell00,
      currentTarget: bodyDiv,
    });

    act(() => {
      result.current.handleBodyPointerDown(event);
    });

    expect(api.setSingleCell).toHaveBeenCalledWith(0, 0, "none");
    scaffold.cleanup();
  });

  it("shift+pointerdown on a cell calls extendTo", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const initialSel = makeSelection(0, 0);
    const api = makeSelectionApi(initialSel);
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 2,
        totalCols: 2,
        headerHeight: 24,
      }),
    );

    const bodyDiv = document.createElement("div");
    bodyDiv.setPointerCapture = vi.fn();
    const event = makePointerEvent({
      button: 0,
      pointerId: 1,
      shiftKey: true,
      target: scaffold.cell10,
      currentTarget: bodyDiv,
    });

    act(() => {
      result.current.handleBodyPointerDown(event);
    });

    expect(api.extendTo).toHaveBeenCalledWith(1, 0, "cell", "none");
    expect(api.setSingleCell).not.toHaveBeenCalled();
    scaffold.cleanup();
  });

  it("right-click (button=2) does not start drag", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const api = makeSelectionApi();
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 2,
        totalCols: 2,
        headerHeight: 24,
      }),
    );

    const bodyDiv = document.createElement("div");
    bodyDiv.setPointerCapture = vi.fn();
    const event = makePointerEvent({
      button: 2,
      target: scaffold.cell00,
      currentTarget: bodyDiv,
    });

    act(() => {
      result.current.handleBodyPointerDown(event);
    });

    expect(api.setSingleCell).not.toHaveBeenCalled();
    expect(result.current.dragStateRef.current).toBeNull();
    scaffold.cleanup();
  });

  it("no onSelectionChange → early return, nothing called", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const api = makeSelectionApi();

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange: undefined,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 2,
        totalCols: 2,
        headerHeight: 24,
      }),
    );

    const bodyDiv = document.createElement("div");
    bodyDiv.setPointerCapture = vi.fn();
    const event = makePointerEvent({ target: scaffold.cell00, currentTarget: bodyDiv });

    act(() => {
      result.current.handleBodyPointerDown(event);
    });

    expect(api.setSingleCell).not.toHaveBeenCalled();
    scaffold.cleanup();
  });
});

describe("useGridPointer — handleBodyPointerMove", () => {
  it("pointermove during drag extends selection to new cell", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const initialSel = makeSelection(0, 0);
    const api = makeSelectionApi(initialSel);
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 2,
        totalCols: 2,
        headerHeight: 24,
      }),
    );

    // Start drag manually
    act(() => {
      result.current.dragStateRef.current = { active: true, mode: "cell", pointerId: 1 };
    });

    // elementFromPoint returns cell10 (row=1, col=0)
    const originalEFP = document.elementFromPoint;
    document.elementFromPoint = vi.fn().mockReturnValue(scaffold.cell10);

    const bodyDiv = document.createElement("div");
    const event = makePointerEvent({
      pointerId: 1,
      clientX: 100,
      clientY: 100,
      currentTarget: bodyDiv,
    });

    act(() => {
      result.current.handleBodyPointerMove(event);
    });

    document.elementFromPoint = originalEFP;

    expect(api.extendTo).toHaveBeenCalledWith(1, 0, "cell", "none");
    scaffold.cleanup();
  });

  it("pointermove with no active drag does nothing (no-op)", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const api = makeSelectionApi();
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 2,
        totalCols: 2,
        headerHeight: 24,
      }),
    );

    // dragStateRef is null (default)
    const bodyDiv = document.createElement("div");
    const event = makePointerEvent({ pointerId: 1, clientX: 100, clientY: 100, currentTarget: bodyDiv });

    act(() => {
      result.current.handleBodyPointerMove(event);
    });

    expect(api.extendTo).not.toHaveBeenCalled();
    scaffold.cleanup();
  });
});

describe("useGridPointer — endDrag", () => {
  it("endDrag clears drag state; subsequent move does nothing", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const api = makeSelectionApi(makeSelection(0, 0));
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 2,
        totalCols: 2,
        headerHeight: 24,
      }),
    );

    // Start drag
    act(() => {
      result.current.dragStateRef.current = { active: true, mode: "cell", pointerId: 5 };
    });

    expect(result.current.dragStateRef.current?.active).toBe(true);

    // End drag
    const bodyDiv = document.createElement("div");
    bodyDiv.releasePointerCapture = vi.fn();
    const endEvent = makePointerEvent({ pointerId: 5, currentTarget: bodyDiv });

    act(() => {
      result.current.endDrag(endEvent);
    });

    expect(result.current.dragStateRef.current).toBeNull();

    // Subsequent move should be no-op
    api.extendTo.mockClear();
    const moveEvent = makePointerEvent({ pointerId: 5, clientX: 50, clientY: 50, currentTarget: bodyDiv });

    act(() => {
      result.current.handleBodyPointerMove(moveEvent);
    });

    expect(api.extendTo).not.toHaveBeenCalled();
    scaffold.cleanup();
  });
});

describe("useGridPointer — handleCornerPointerDown", () => {
  it("corner pointerdown calls selectAll", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const api = makeSelectionApi();
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 2,
        totalCols: 2,
        headerHeight: 24,
      }),
    );

    const cornerDiv = document.createElement("div");
    cornerDiv.setPointerCapture = vi.fn();
    const event = makePointerEvent({ button: 0, currentTarget: cornerDiv });

    act(() => {
      result.current.handleCornerPointerDown(event);
    });

    expect(api.selectAll).toHaveBeenCalled();
    scaffold.cleanup();
  });

  it("corner right-click does not call selectAll", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const api = makeSelectionApi();
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 2,
        totalCols: 2,
        headerHeight: 24,
      }),
    );

    const cornerDiv = document.createElement("div");
    const event = makePointerEvent({ button: 2, currentTarget: cornerDiv });

    act(() => {
      result.current.handleCornerPointerDown(event);
    });

    expect(api.selectAll).not.toHaveBeenCalled();
    scaffold.cleanup();
  });
});

describe("useGridPointer — handleColHeaderPointerDown", () => {
  it("col-header pointerdown emits col-mode selection", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const api = makeSelectionApi();
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 3,
        totalCols: 2,
        headerHeight: 24,
      }),
    );

    const headerDiv = document.createElement("div");
    headerDiv.setPointerCapture = vi.fn();
    const event = makePointerEvent({ button: 0, pointerId: 1, currentTarget: headerDiv });

    act(() => {
      result.current.handleColHeaderPointerDown(event, 1);
    });

    expect(api.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        anchor: { row: 0, col: 1 },
        focus: { row: 2, col: 1 },
        mode: "col",
      }),
      "none",
    );
    scaffold.cleanup();
  });

  it("col-header right-click does nothing", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const api = makeSelectionApi();
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 3,
        totalCols: 2,
        headerHeight: 24,
      }),
    );

    const headerDiv = document.createElement("div");
    const event = makePointerEvent({ button: 2, currentTarget: headerDiv });

    act(() => {
      result.current.handleColHeaderPointerDown(event, 0);
    });

    expect(api.emit).not.toHaveBeenCalled();
    scaffold.cleanup();
  });

  it("shift+col-header click extends col selection from anchor", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const initialSel: Selection = {
      anchor: { row: 0, col: 0 },
      focus: { row: 2, col: 0 },
      mode: "col",
      scroll: "none",
      nonce: 1,
    };
    const api = makeSelectionApi(initialSel);
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 3,
        totalCols: 2,
        headerHeight: 24,
      }),
    );

    const headerDiv = document.createElement("div");
    const event = makePointerEvent({ button: 0, shiftKey: true, currentTarget: headerDiv });

    act(() => {
      result.current.handleColHeaderPointerDown(event, 1);
    });

    expect(api.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        anchor: { row: 0, col: 0 },
        focus: { row: 2, col: 1 },
        mode: "col",
      }),
      "none",
    );
    scaffold.cleanup();
  });
});

describe("useGridPointer — handleRowHeaderPointerDown", () => {
  it("row-header pointerdown emits row-mode selection", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const api = makeSelectionApi();
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 3,
        totalCols: 4,
        headerHeight: 24,
      }),
    );

    const rowHeaderDiv = document.createElement("div");
    rowHeaderDiv.setPointerCapture = vi.fn();
    const event = makePointerEvent({ button: 0, pointerId: 1, currentTarget: rowHeaderDiv });

    act(() => {
      result.current.handleRowHeaderPointerDown(event, 2);
    });

    expect(api.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        anchor: { row: 2, col: 0 },
        focus: { row: 2, col: 3 },
        mode: "row",
      }),
      "none",
    );
    scaffold.cleanup();
  });

  it("row-header right-click does nothing", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const api = makeSelectionApi();
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 3,
        totalCols: 4,
        headerHeight: 24,
      }),
    );

    const rowHeaderDiv = document.createElement("div");
    const event = makePointerEvent({ button: 2, currentTarget: rowHeaderDiv });

    act(() => {
      result.current.handleRowHeaderPointerDown(event, 0);
    });

    expect(api.emit).not.toHaveBeenCalled();
    scaffold.cleanup();
  });

  it("shift+row-header click extends row selection from anchor", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const initialSel: Selection = {
      anchor: { row: 0, col: 0 },
      focus: { row: 0, col: 3 },
      mode: "row",
      scroll: "none",
      nonce: 1,
    };
    const api = makeSelectionApi(initialSel);
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 3,
        totalCols: 4,
        headerHeight: 24,
      }),
    );

    const rowHeaderDiv = document.createElement("div");
    const event = makePointerEvent({ button: 0, shiftKey: true, currentTarget: rowHeaderDiv });

    act(() => {
      result.current.handleRowHeaderPointerDown(event, 2);
    });

    expect(api.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        anchor: { row: 0, col: 0 },
        focus: { row: 2, col: 3 },
        mode: "row",
      }),
      "none",
    );
    scaffold.cleanup();
  });
});

describe("useGridPointer — auto-scroll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pointermove near edge with active drag triggers requestAnimationFrame", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const api = makeSelectionApi(makeSelection(0, 0));
    const onSelectionChange = vi.fn();

    // Stub RAF so we can observe it was called
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(42 as unknown as ReturnType<typeof requestAnimationFrame>);

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 2,
        totalCols: 2,
        headerHeight: 24,
      }),
    );

    // Activate drag
    act(() => {
      result.current.dragStateRef.current = { active: true, mode: "cell", pointerId: 1 };
    });

    // Mock getBoundingClientRect so the container appears to have a real viewport
    scaffold.container.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 0, right: 800, top: 0, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON() {},
    });
    // Also stub scrollBy
    scaffold.container.scrollBy = vi.fn();

    const bodyDiv = document.createElement("div");
    // Move pointer near the right edge (clientX=795, close to right=800-24=776 edge)
    const moveEvent = makePointerEvent({ pointerId: 1, clientX: 795, clientY: 300, currentTarget: bodyDiv });

    act(() => {
      result.current.handleBodyPointerMove(moveEvent);
    });

    // RAF should have been called to start the auto-scroll loop
    expect(rafSpy).toHaveBeenCalled();

    rafSpy.mockRestore();
    scaffold.cleanup();
  });

  it("stopAutoScroll cancels the RAF loop", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const api = makeSelectionApi(makeSelection(0, 0));
    const onSelectionChange = vi.fn();

    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(99 as unknown as ReturnType<typeof requestAnimationFrame>);
    const cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame");

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 2,
        totalCols: 2,
        headerHeight: 24,
      }),
    );

    // Activate drag and trigger auto-scroll
    act(() => {
      result.current.dragStateRef.current = { active: true, mode: "cell", pointerId: 1 };
    });

    scaffold.container.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 0, right: 800, top: 0, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON() {},
    });
    scaffold.container.scrollBy = vi.fn();

    const bodyDiv = document.createElement("div");
    const moveEvent = makePointerEvent({ pointerId: 1, clientX: 795, clientY: 300, currentTarget: bodyDiv });

    act(() => {
      result.current.handleBodyPointerMove(moveEvent);
    });

    expect(rafSpy).toHaveBeenCalled();

    // Stop auto-scroll
    act(() => {
      result.current.stopAutoScroll();
    });

    expect(cafSpy).toHaveBeenCalledWith(99);

    rafSpy.mockRestore();
    cafSpy.mockRestore();
    scaffold.cleanup();
  });

  it("endDrag cancels auto-scroll loop", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const api = makeSelectionApi(makeSelection(0, 0));
    const onSelectionChange = vi.fn();

    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(77 as unknown as ReturnType<typeof requestAnimationFrame>);
    const cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame");

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 2,
        totalCols: 2,
        headerHeight: 24,
      }),
    );

    // Activate drag and trigger auto-scroll
    act(() => {
      result.current.dragStateRef.current = { active: true, mode: "cell", pointerId: 3 };
    });

    scaffold.container.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 0, right: 800, top: 0, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON() {},
    });
    scaffold.container.scrollBy = vi.fn();

    const bodyDiv = document.createElement("div");
    bodyDiv.releasePointerCapture = vi.fn();
    const moveEvent = makePointerEvent({ pointerId: 3, clientX: 795, clientY: 300, currentTarget: bodyDiv });

    act(() => {
      result.current.handleBodyPointerMove(moveEvent);
    });

    // End drag — should cancel RAF
    const endEvent = makePointerEvent({ pointerId: 3, currentTarget: bodyDiv });

    act(() => {
      result.current.endDrag(endEvent);
    });

    expect(cafSpy).toHaveBeenCalledWith(77);
    expect(result.current.dragStateRef.current).toBeNull();

    rafSpy.mockRestore();
    cafSpy.mockRestore();
    scaffold.cleanup();
  });
});

describe("useGridPointer — dragStateRef Escape path", () => {
  it("dragStateRef is accessible from outside for Escape key handler", () => {
    const scaffold = buildScaffold();
    const scrollRef = { current: scaffold.container } as React.RefObject<HTMLDivElement>;
    const api = makeSelectionApi(makeSelection(0, 0));

    const { result } = renderHook(() =>
      useGridPointer({
        scrollRef,
        selectionRef: api.selectionRef as React.RefObject<Selection | null>,
        onSelectionChange: vi.fn(),
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
        extendTo: api.extendTo as UseGridSelectionApi["extendTo"],
        selectAll: api.selectAll,
        totalRows: 2,
        totalCols: 2,
        headerHeight: 24,
      }),
    );

    // Initially null
    expect(result.current.dragStateRef.current).toBeNull();

    // After setting drag active
    act(() => {
      result.current.dragStateRef.current = { active: true, mode: "cell", pointerId: 1 };
    });

    // Keyboard handler can read and clear it
    expect(result.current.dragStateRef.current?.active).toBe(true);
    act(() => {
      result.current.dragStateRef.current = null;
      result.current.stopAutoScroll();
    });
    expect(result.current.dragStateRef.current).toBeNull();

    scaffold.cleanup();
  });
});
