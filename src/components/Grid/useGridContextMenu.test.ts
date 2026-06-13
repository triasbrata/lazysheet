/**
 * useGridContextMenu.test.ts
 *
 * Tests for the useGridContextMenu hook covering:
 *  - right-click on cell inside expandedBounds → selection kept, menuCtx set to cell
 *  - right-click on cell outside expandedBounds → setSingleCell called
 *  - right-click on row header → row target set, emit called for full row selection
 *  - right-click on col header → menuCtx set to null, preventDefault called
 *  - canCopy true with non-empty selection, false when null
 *  - menuFormula reflects right-clicked cell formula
 *  - copyFormulaAt → copyFormula called + toast
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGridContextMenu } from "./useGridContextMenu";
import type { Selection, Bounds } from "./grid-utils";
import type { UseGridSelectionApi } from "./useGridSelection";
import type { UseGridPointerApi } from "./useGridPointer";
import type { SheetModel, CellModel } from "@/lib/types";

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    message: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/lib/formula-copy", () => ({
  getCellFormula: vi.fn((cell: CellModel | undefined) => cell?.f ?? null),
  copyFormula: vi.fn().mockResolvedValue(true),
}));

import { toast } from "sonner";
import { copyFormula } from "@/lib/formula-copy";

// ─── Clear mocks between tests ────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal DOM scaffold that mirrors the data attributes the hook's
 * resolveHeaderAt / resolveCellAt functions walk.
 *
 * Layout:
 *   container
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

/** Make a bounds object */
function makeBounds(r1: number, c1: number, r2: number, c2: number): Bounds {
  return { r1, c1, r2, c2 };
}

/** Build mock UseGridSelectionApi functions and a mutable selectionRef. */
function makeSelectionApi(initialSelection: Selection | null = null): {
  emit: ReturnType<typeof vi.fn>;
  setSingleCell: ReturnType<typeof vi.fn>;
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
  return { emit, setSingleCell, selectionRef };
}

/** Synthetic MouseEvent-like object for React context-menu handlers. */
function makeMouseEvent(
  overrides: Partial<React.MouseEvent<HTMLDivElement>>,
): React.MouseEvent<HTMLDivElement> {
  return {
    clientX: 0,
    clientY: 0,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  } as unknown as React.MouseEvent<HTMLDivElement>;
}

/** Build a minimal sheet with optional cell overrides */
function makeSheet(rows: (CellModel | undefined)[][] = [[]]): SheetModel {
  return {
    name: "Sheet1",
    rows: rows as CellModel[][],
    col_widths: [80, 80],
    row_heights: [24, 24],
    merges: [],
    frozen_rows: 0,
    frozen_cols: 0,
    max_col: 2,
  };
}

// Build pointer API mocks backed by DOM scaffold elementFromPoint
function makePointerApi(_scaffold: ReturnType<typeof buildScaffold>): {
  resolveHeaderAt: UseGridPointerApi["resolveHeaderAt"];
  resolveCellAt: UseGridPointerApi["resolveCellAt"];
  mockPointTo: (el: Element | null) => void;
  restore: () => void;
} {
  const originalEFP = document.elementFromPoint;
  let mockedEl: Element | null = null;

  document.elementFromPoint = vi.fn(() => mockedEl);

  // These are simplified versions mirroring the actual useGridPointer impl
  const resolveHeaderAt = vi.fn(
    (_clientX: number, _clientY: number): { kind: "row" | "col"; index: number } | null => {
      const el = document.elementFromPoint(0, 0);
      if (!el) return null;
      const rowEl = (el as HTMLElement).closest<HTMLElement>("[data-row-header]");
      if (rowEl) {
        const i = parseInt(rowEl.getAttribute("data-row-header")!, 10);
        if (!Number.isNaN(i)) return { kind: "row", index: i };
      }
      const colEl = (el as HTMLElement).closest<HTMLElement>("[data-col-header]");
      if (colEl) {
        const i = parseInt(colEl.getAttribute("data-col-header")!, 10);
        if (!Number.isNaN(i)) return { kind: "col", index: i };
      }
      return null;
    },
  );

  const resolveCellAt = vi.fn(
    (_clientX: number, _clientY: number): { row: number; col: number } | null => {
      const el = document.elementFromPoint(0, 0);
      if (!el) return null;
      const cellEl = (el as HTMLElement).closest<HTMLElement>("[data-r][data-c]");
      if (!cellEl) return null;
      const r = parseInt(cellEl.getAttribute("data-r")!, 10);
      const c = parseInt(cellEl.getAttribute("data-c")!, 10);
      if (Number.isNaN(r) || Number.isNaN(c)) return null;
      return { row: r, col: c };
    },
  );

  return {
    resolveHeaderAt,
    resolveCellAt,
    mockPointTo: (el: Element | null) => { mockedEl = el; },
    restore: () => { document.elementFromPoint = originalEFP; },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useGridContextMenu — right-click on cell inside expandedBounds", () => {
  it("selection is kept (setSingleCell NOT called), menuCtx set to cell target", () => {
    const scaffold = buildScaffold();
    const api = makeSelectionApi(makeSelection(0, 0));
    const pointerApi = makePointerApi(scaffold);

    // expandedBounds covers cell (0,0)
    const expandedBounds = makeBounds(0, 0, 1, 1);
    const sheet = makeSheet([[{ v: { t: "Text", c: "A" } }, { v: { t: "Text", c: "B" } }]]);

    const { result } = renderHook(() =>
      useGridContextMenu({
        sheet,
        totalCols: 2,
        selection: makeSelection(0, 0),
        expandedBounds,
        resolveHeaderAt: pointerApi.resolveHeaderAt,
        resolveCellAt: pointerApi.resolveCellAt,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
      }),
    );

    // Mock elementFromPoint to return cell00 (row=0, col=0) which is INSIDE bounds
    pointerApi.mockPointTo(scaffold.cell00);
    const event = makeMouseEvent({ clientX: 50, clientY: 50 });

    act(() => {
      result.current.handleContextMenuCapture(event);
    });

    // Selection was inside bounds, so setSingleCell should NOT be called
    expect(api.setSingleCell).not.toHaveBeenCalled();
    // menuCtx should be set to the cell
    expect(result.current.menuCtx).toEqual({ type: "cell", row: 0, col: 0 });

    pointerApi.restore();
    scaffold.cleanup();
  });
});

describe("useGridContextMenu — right-click on cell outside expandedBounds", () => {
  it("setSingleCell called to collapse selection to clicked cell", () => {
    const scaffold = buildScaffold();
    const api = makeSelectionApi(makeSelection(0, 0));
    const pointerApi = makePointerApi(scaffold);

    // expandedBounds does NOT cover cell (1,0)
    const expandedBounds = makeBounds(0, 0, 0, 0);
    const sheet = makeSheet([
      [{ v: { t: "Text", c: "A" } }, { v: { t: "Text", c: "B" } }],
      [{ v: { t: "Text", c: "C" } }, { v: { t: "Text", c: "D" } }],
    ]);

    const { result } = renderHook(() =>
      useGridContextMenu({
        sheet,
        totalCols: 2,
        selection: makeSelection(0, 0),
        expandedBounds,
        resolveHeaderAt: pointerApi.resolveHeaderAt,
        resolveCellAt: pointerApi.resolveCellAt,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
      }),
    );

    // Mock elementFromPoint to return cell10 (row=1, col=0) which is OUTSIDE bounds
    pointerApi.mockPointTo(scaffold.cell10);
    const event = makeMouseEvent({ clientX: 50, clientY: 80 });

    act(() => {
      result.current.handleContextMenuCapture(event);
    });

    // Cell is outside bounds, so setSingleCell should be called
    expect(api.setSingleCell).toHaveBeenCalledWith(1, 0, "none");
    // menuCtx should still be set to the clicked cell
    expect(result.current.menuCtx).toEqual({ type: "cell", row: 1, col: 0 });

    pointerApi.restore();
    scaffold.cleanup();
  });
});

describe("useGridContextMenu — right-click on row header", () => {
  it("emits full row selection and sets menuCtx to row target", () => {
    const scaffold = buildScaffold();
    const api = makeSelectionApi(null);
    const pointerApi = makePointerApi(scaffold);

    const sheet = makeSheet([
      [{ v: { t: "Text", c: "A" } }, { v: { t: "Text", c: "B" } }],
    ]);

    const { result } = renderHook(() =>
      useGridContextMenu({
        sheet,
        totalCols: 2,
        selection: null,
        expandedBounds: null,
        resolveHeaderAt: pointerApi.resolveHeaderAt,
        resolveCellAt: pointerApi.resolveCellAt,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
      }),
    );

    // Mock elementFromPoint to return rowHeader0
    pointerApi.mockPointTo(scaffold.rowHeader0);
    const event = makeMouseEvent({ clientX: 15, clientY: 50 });

    act(() => {
      result.current.handleContextMenuCapture(event);
    });

    // emit should be called with full row selection
    expect(api.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        anchor: { row: 0, col: 0 },
        focus: { row: 0, col: 1 },
        mode: "row",
      }),
      "none",
    );
    expect(result.current.menuCtx).toEqual({ type: "row", row: 0 });

    pointerApi.restore();
    scaffold.cleanup();
  });

  it("right-click on row header outside current selection → emit called (emit handles selection)", () => {
    const scaffold = buildScaffold();
    const api = makeSelectionApi(makeSelection(0, 0));
    const pointerApi = makePointerApi(scaffold);

    const sheet = makeSheet([
      [{ v: { t: "Text", c: "A" } }, { v: { t: "Text", c: "B" } }],
      [{ v: { t: "Text", c: "C" } }, { v: { t: "Text", c: "D" } }],
    ]);

    const { result } = renderHook(() =>
      useGridContextMenu({
        sheet,
        totalCols: 2,
        selection: makeSelection(0, 0),
        expandedBounds: makeBounds(0, 0, 0, 0),
        resolveHeaderAt: pointerApi.resolveHeaderAt,
        resolveCellAt: pointerApi.resolveCellAt,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
      }),
    );

    // Click on rowHeader1 (row=1) which is outside existing selection
    pointerApi.mockPointTo(scaffold.rowHeader1);
    const event = makeMouseEvent({ clientX: 15, clientY: 80 });

    act(() => {
      result.current.handleContextMenuCapture(event);
    });

    // emit called to select entire row 1
    expect(api.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        anchor: { row: 1, col: 0 },
        focus: { row: 1, col: 1 },
        mode: "row",
      }),
      "none",
    );
    expect(result.current.menuCtx).toEqual({ type: "row", row: 1 });

    pointerApi.restore();
    scaffold.cleanup();
  });
});

describe("useGridContextMenu — right-click on col header", () => {
  it("sets menuCtx to null and calls preventDefault", () => {
    const scaffold = buildScaffold();
    const api = makeSelectionApi(null);
    const pointerApi = makePointerApi(scaffold);

    const sheet = makeSheet([[{ v: { t: "Text", c: "A" } }, { v: { t: "Text", c: "B" } }]]);

    const { result } = renderHook(() =>
      useGridContextMenu({
        sheet,
        totalCols: 2,
        selection: null,
        expandedBounds: null,
        resolveHeaderAt: pointerApi.resolveHeaderAt,
        resolveCellAt: pointerApi.resolveCellAt,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
      }),
    );

    pointerApi.mockPointTo(scaffold.colHeader0);
    const preventDefault = vi.fn();
    const event = makeMouseEvent({ clientX: 50, clientY: 5, preventDefault });

    act(() => {
      result.current.handleContextMenuCapture(event);
    });

    expect(result.current.menuCtx).toBeNull();
    expect(preventDefault).toHaveBeenCalled();
    expect(api.emit).not.toHaveBeenCalled();

    pointerApi.restore();
    scaffold.cleanup();
  });
});

describe("useGridContextMenu — canCopy", () => {
  it("canCopy is true when expandedBounds is non-null and selection is non-null", () => {
    const scaffold = buildScaffold();
    const api = makeSelectionApi(makeSelection(0, 0));
    const pointerApi = makePointerApi(scaffold);

    const sheet = makeSheet([[{ v: { t: "Text", c: "A" } }]]);
    const expandedBounds = makeBounds(0, 0, 1, 1);

    const { result } = renderHook(() =>
      useGridContextMenu({
        sheet,
        totalCols: 2,
        selection: makeSelection(0, 0),
        expandedBounds,
        resolveHeaderAt: pointerApi.resolveHeaderAt,
        resolveCellAt: pointerApi.resolveCellAt,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
      }),
    );

    expect(result.current.canCopy).toBe(true);

    pointerApi.restore();
    scaffold.cleanup();
  });

  it("canCopy is false when selection is null", () => {
    const scaffold = buildScaffold();
    const api = makeSelectionApi(null);
    const pointerApi = makePointerApi(scaffold);

    const sheet = makeSheet([[{ v: { t: "Text", c: "A" } }]]);
    const expandedBounds = makeBounds(0, 0, 1, 1);

    const { result } = renderHook(() =>
      useGridContextMenu({
        sheet,
        totalCols: 2,
        selection: null,
        expandedBounds,
        resolveHeaderAt: pointerApi.resolveHeaderAt,
        resolveCellAt: pointerApi.resolveCellAt,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
      }),
    );

    expect(result.current.canCopy).toBe(false);

    pointerApi.restore();
    scaffold.cleanup();
  });

  it("canCopy is false when expandedBounds is null", () => {
    const scaffold = buildScaffold();
    const api = makeSelectionApi(makeSelection(0, 0));
    const pointerApi = makePointerApi(scaffold);

    const sheet = makeSheet([[{ v: { t: "Text", c: "A" } }]]);

    const { result } = renderHook(() =>
      useGridContextMenu({
        sheet,
        totalCols: 2,
        selection: makeSelection(0, 0),
        expandedBounds: null,
        resolveHeaderAt: pointerApi.resolveHeaderAt,
        resolveCellAt: pointerApi.resolveCellAt,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
      }),
    );

    expect(result.current.canCopy).toBe(false);

    pointerApi.restore();
    scaffold.cleanup();
  });
});

describe("useGridContextMenu — menuFormula", () => {
  it("menuFormula returns formula of right-clicked cell", () => {
    const scaffold = buildScaffold();
    const api = makeSelectionApi(makeSelection(0, 0));
    const pointerApi = makePointerApi(scaffold);

    const cellWithFormula: CellModel = { v: { t: "Number", c: 10 }, f: "=SUM(A1:A5)" };
    const sheet = makeSheet([[cellWithFormula, { v: { t: "Text", c: "B" } }]]);
    const expandedBounds = makeBounds(0, 0, 0, 1);

    const { result } = renderHook(() =>
      useGridContextMenu({
        sheet,
        totalCols: 2,
        selection: makeSelection(0, 0),
        expandedBounds,
        resolveHeaderAt: pointerApi.resolveHeaderAt,
        resolveCellAt: pointerApi.resolveCellAt,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
      }),
    );

    // Initially, menuCtx is null so menuFormula should be null
    expect(result.current.menuFormula).toBeNull();

    // Right-click on cell with formula (cell00 = row 0, col 0)
    pointerApi.mockPointTo(scaffold.cell00);
    const event = makeMouseEvent({ clientX: 50, clientY: 20 });

    act(() => {
      result.current.handleContextMenuCapture(event);
    });

    // menuFormula should now reflect the formula
    expect(result.current.menuFormula).toBe("=SUM(A1:A5)");

    pointerApi.restore();
    scaffold.cleanup();
  });

  it("menuFormula is null when right-clicked cell has no formula", () => {
    const scaffold = buildScaffold();
    const api = makeSelectionApi(makeSelection(0, 0));
    const pointerApi = makePointerApi(scaffold);

    const cellNoFormula: CellModel = { v: { t: "Text", c: "Hello" } };
    const sheet = makeSheet([[cellNoFormula, { v: { t: "Text", c: "B" } }]]);
    const expandedBounds = makeBounds(0, 0, 0, 1);

    const { result } = renderHook(() =>
      useGridContextMenu({
        sheet,
        totalCols: 2,
        selection: makeSelection(0, 0),
        expandedBounds,
        resolveHeaderAt: pointerApi.resolveHeaderAt,
        resolveCellAt: pointerApi.resolveCellAt,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
      }),
    );

    pointerApi.mockPointTo(scaffold.cell00);
    const event = makeMouseEvent({ clientX: 50, clientY: 20 });

    act(() => {
      result.current.handleContextMenuCapture(event);
    });

    expect(result.current.menuFormula).toBeNull();

    pointerApi.restore();
    scaffold.cleanup();
  });
});

describe("useGridContextMenu — copyFormulaAt", () => {
  it("calls copyFormula when cell has a formula", async () => {
    const scaffold = buildScaffold();
    const api = makeSelectionApi(makeSelection(0, 0));
    const pointerApi = makePointerApi(scaffold);

    const cellWithFormula: CellModel = { v: { t: "Number", c: 42 }, f: "=A1+B1" };
    const sheet = makeSheet([[cellWithFormula, { v: { t: "Text", c: "B" } }]]);

    const { result } = renderHook(() =>
      useGridContextMenu({
        sheet,
        totalCols: 2,
        selection: makeSelection(0, 0),
        expandedBounds: null,
        resolveHeaderAt: pointerApi.resolveHeaderAt,
        resolveCellAt: pointerApi.resolveCellAt,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
      }),
    );

    await act(async () => {
      result.current.copyFormulaAt(0, 0);
    });

    expect(copyFormula).toHaveBeenCalledWith("=A1+B1");
    // toast.message should NOT be called for a cell with formula
    expect(vi.mocked(toast.message)).not.toHaveBeenCalled();

    pointerApi.restore();
    scaffold.cleanup();
  });

  it("calls toast.message when cell has no formula", async () => {
    const scaffold = buildScaffold();
    const api = makeSelectionApi(makeSelection(0, 0));
    const pointerApi = makePointerApi(scaffold);

    const cellNoFormula: CellModel = { v: { t: "Text", c: "plain" } };
    const sheet = makeSheet([[cellNoFormula, { v: { t: "Text", c: "B" } }]]);

    const { result } = renderHook(() =>
      useGridContextMenu({
        sheet,
        totalCols: 2,
        selection: makeSelection(0, 0),
        expandedBounds: null,
        resolveHeaderAt: pointerApi.resolveHeaderAt,
        resolveCellAt: pointerApi.resolveCellAt,
        emit: api.emit as UseGridSelectionApi["emit"],
        setSingleCell: api.setSingleCell as UseGridSelectionApi["setSingleCell"],
      }),
    );

    await act(async () => {
      result.current.copyFormulaAt(0, 0);
    });

    expect(vi.mocked(toast.message)).toHaveBeenCalledWith("No formula in this cell");
    expect(copyFormula).not.toHaveBeenCalled();

    pointerApi.restore();
    scaffold.cleanup();
  });
});
