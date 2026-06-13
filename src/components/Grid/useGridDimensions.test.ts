import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGridDimensions } from "./useGridDimensions";
import { ROW_NUM_COL_WIDTH } from "./grid-utils";
import type { Selection } from "./grid-utils";
import type { SheetModel, CellModel } from "@/lib/types";

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/lib/measure", () => ({
  awaitFontsReady: vi.fn().mockResolvedValue(undefined),
  measureAutofitColumn: vi.fn().mockReturnValue(80),
  measureAutofitRow: vi.fn().mockReturnValue(24),
  sampleCellFont: vi.fn().mockReturnValue({ fontFamily: "sans-serif", fontSize: 12, fontWeight: "400" }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    message: vi.fn(),
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCell(text: string, extra: Partial<CellModel> = {}): CellModel {
  return { v: { t: "Text", c: text }, ...extra };
}

function makeSheet(overrides: Partial<SheetModel> = {}): SheetModel {
  const NUM_ROWS = 10;
  const NUM_COLS = 5;
  const rows: CellModel[][] = Array.from({ length: NUM_ROWS }, (_, r) =>
    Array.from({ length: NUM_COLS }, (_, c) => makeCell(`R${r}C${c}`)),
  );
  return {
    name: "Sheet1",
    rows,
    col_widths: Array.from({ length: NUM_COLS }, () => 80),
    row_heights: Array.from({ length: NUM_ROWS }, () => 24),
    max_col: NUM_COLS,
    merges: [],
    frozen_rows: 0,
    frozen_cols: 0,
    ...overrides,
  };
}

function emptyGroupByAnchor() {
  return new Map<number, import("@/lib/grid-filter").HeaderGroup>();
}

function makeNullSelectionRef() {
  return { current: null as Selection | null };
}

// Default opts factory — minimal valid call
function makeOpts(extra: Partial<Parameters<typeof useGridDimensions>[0]> = {}) {
  const sheet = extra.sheet ?? makeSheet();
  return {
    sheet,
    totalRows: sheet.rows.length,
    totalCols: sheet.max_col,
    colOverrides: undefined,
    rowOverrides: undefined,
    zoom: 1,
    headerRow: null,
    groupByAnchor: emptyGroupByAnchor(),
    selectionRef: makeNullSelectionRef(),
    onColResize: undefined,
    onRowResize: undefined,
    onColReset: undefined,
    onRowReset: undefined,
    ...extra,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useGridDimensions — widths", () => {
  it("returns sheet col_widths at zoom=1", () => {
    const sheet = makeSheet();
    const { result } = renderHook(() => useGridDimensions(makeOpts({ sheet })));
    // sheet has 5 cols with col_widths all 80
    expect(result.current.widths).toHaveLength(5);
    expect(result.current.widths[0]).toBe(80);
    expect(result.current.widths[4]).toBe(80);
  });

  it("applies zoom scaling", () => {
    const sheet = makeSheet();
    const { result } = renderHook(() =>
      useGridDimensions(makeOpts({ sheet, zoom: 2 })),
    );
    expect(result.current.widths[0]).toBe(160); // 80 * 2
  });

  it("applies colOverrides over sheet defaults", () => {
    const sheet = makeSheet();
    const colOverrides = { 2: 120 };
    const { result } = renderHook(() =>
      useGridDimensions(makeOpts({ sheet, colOverrides })),
    );
    expect(result.current.widths[2]).toBe(120);
    expect(result.current.widths[0]).toBe(80);
  });

  it("applies colOverrides with zoom scaling", () => {
    const sheet = makeSheet();
    const colOverrides = { 0: 100 };
    const { result } = renderHook(() =>
      useGridDimensions(makeOpts({ sheet, colOverrides, zoom: 1.5 })),
    );
    expect(result.current.widths[0]).toBe(Math.round(100 * 1.5));
  });
});

describe("useGridDimensions — heights", () => {
  it("returns sheet row_heights at zoom=1", () => {
    const sheet = makeSheet();
    const { result } = renderHook(() => useGridDimensions(makeOpts({ sheet })));
    expect(result.current.heights).toHaveLength(10);
    expect(result.current.heights[0]).toBe(24);
  });

  it("applies zoom scaling to heights", () => {
    const sheet = makeSheet();
    const { result } = renderHook(() =>
      useGridDimensions(makeOpts({ sheet, zoom: 2 })),
    );
    expect(result.current.heights[0]).toBe(48); // 24 * 2
  });

  it("applies rowOverrides over sheet defaults", () => {
    const sheet = makeSheet();
    const rowOverrides = { 3: 50 };
    const { result } = renderHook(() =>
      useGridDimensions(makeOpts({ sheet, rowOverrides })),
    );
    expect(result.current.heights[3]).toBe(50);
    expect(result.current.heights[0]).toBe(24);
  });
});

describe("useGridDimensions — preview state", () => {
  it("rowPreview is null initially", () => {
    const { result } = renderHook(() => useGridDimensions(makeOpts()));
    expect(result.current.rowPreview).toBeNull();
  });

  it("handleResizePreview sets colPreview (widths takes precedence)", () => {
    const sheet = makeSheet();
    const { result } = renderHook(() => useGridDimensions(makeOpts({ sheet })));
    act(() => {
      result.current.handleResizePreview("col", 1, 200);
    });
    // widths[1] should now reflect the preview value
    expect(result.current.widths[1]).toBe(200);
    // other cols unchanged
    expect(result.current.widths[0]).toBe(80);
  });

  it("handleResizePreview sets rowPreview (heights takes precedence)", () => {
    const { result } = renderHook(() => useGridDimensions(makeOpts()));
    act(() => {
      result.current.handleResizePreview("row", 2, 99);
    });
    expect(result.current.rowPreview).toEqual({ idx: 2, h: 99 });
    expect(result.current.heights[2]).toBe(99);
  });

  it("preview overrides colOverride for the previewing column", () => {
    const colOverrides = { 0: 120 };
    const { result } = renderHook(() =>
      useGridDimensions(makeOpts({ colOverrides })),
    );
    // Before preview: override takes effect
    expect(result.current.widths[0]).toBe(120);
    act(() => {
      result.current.handleResizePreview("col", 0, 300);
    });
    // Preview overrides the override
    expect(result.current.widths[0]).toBe(300);
  });
});

describe("useGridDimensions — handleResizeCommit", () => {
  it("clears colPreview and calls onColResize with logical px (size / zoom)", () => {
    const onColResize = vi.fn();
    const { result } = renderHook(() =>
      useGridDimensions(makeOpts({ zoom: 2, onColResize })),
    );
    // Set preview first
    act(() => {
      result.current.handleResizePreview("col", 0, 200);
    });
    expect(result.current.widths[0]).toBe(200);
    // Commit — size 200 screen px at zoom=2 → 100 logical px
    act(() => {
      result.current.handleResizeCommit("col", 0, 200);
    });
    expect(onColResize).toHaveBeenCalledOnce();
    expect(onColResize).toHaveBeenCalledWith(0, 100);
    // Preview is cleared (widths[0] goes back to sheet value zoomed)
    expect(result.current.widths[0]).toBe(Math.round(80 * 2)); // sheet default
  });

  it("clears rowPreview and calls onRowResize with logical px", () => {
    const onRowResize = vi.fn();
    const { result } = renderHook(() =>
      useGridDimensions(makeOpts({ zoom: 2, onRowResize })),
    );
    act(() => {
      result.current.handleResizePreview("row", 1, 100);
    });
    act(() => {
      result.current.handleResizeCommit("row", 1, 100);
    });
    expect(onRowResize).toHaveBeenCalledWith(1, 50); // 100 / 2
    expect(result.current.rowPreview).toBeNull();
  });

  it("handles zoom=1 (no conversion needed)", () => {
    const onColResize = vi.fn();
    const { result } = renderHook(() =>
      useGridDimensions(makeOpts({ zoom: 1, onColResize })),
    );
    act(() => {
      result.current.handleResizeCommit("col", 2, 150);
    });
    expect(onColResize).toHaveBeenCalledWith(2, 150);
  });
});

describe("useGridDimensions — cumColX", () => {
  it("is a prefix sum of widths starting at 0", () => {
    const sheet = makeSheet();
    // sheet has 5 cols each 80px at zoom=1
    const { result } = renderHook(() => useGridDimensions(makeOpts({ sheet })));
    const { cumColX, widths } = result.current;
    expect(cumColX[0]).toBe(0);
    expect(cumColX[1]).toBe(widths[0]);
    expect(cumColX[2]).toBe(widths[0] + widths[1]);
    expect(cumColX[5]).toBe(widths.reduce((a, b) => a + b, 0));
  });

  it("has length totalCols + 1", () => {
    const sheet = makeSheet();
    const { result } = renderHook(() => useGridDimensions(makeOpts({ sheet })));
    expect(result.current.cumColX).toHaveLength(sheet.max_col + 1);
  });
});

describe("useGridDimensions — derived dimensions", () => {
  it("totalContentWidth equals last cumColX entry", () => {
    const { result } = renderHook(() => useGridDimensions(makeOpts()));
    const { cumColX, totalContentWidth } = result.current;
    expect(totalContentWidth).toBe(cumColX[cumColX.length - 1]);
  });

  it("rowNumColWidth scales with zoom", () => {
    const { result: r1 } = renderHook(() => useGridDimensions(makeOpts({ zoom: 1 })));
    const { result: r2 } = renderHook(() => useGridDimensions(makeOpts({ zoom: 2 })));
    expect(r1.current.rowNumColWidth).toBe(ROW_NUM_COL_WIDTH);
    expect(r2.current.rowNumColWidth).toBe(Math.round(ROW_NUM_COL_WIDTH * 2));
  });

  it("bodyWidth = rowNumColWidth + totalContentWidth", () => {
    const { result } = renderHook(() => useGridDimensions(makeOpts()));
    const { rowNumColWidth, totalContentWidth, bodyWidth } = result.current;
    expect(bodyWidth).toBe(rowNumColWidth + totalContentWidth);
  });

  it("headerHeight scales with zoom", () => {
    const { result: r1 } = renderHook(() => useGridDimensions(makeOpts({ zoom: 1 })));
    const { result: r2 } = renderHook(() => useGridDimensions(makeOpts({ zoom: 2 })));
    expect(r1.current.headerHeight).toBe(26);
    expect(r2.current.headerHeight).toBe(52);
  });
});

describe("useGridDimensions — handleAutofitCols", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const m = await import("@/lib/measure");
    vi.mocked(m.awaitFontsReady).mockResolvedValue(undefined);
    vi.mocked(m.measureAutofitColumn).mockReturnValue(80);
    vi.mocked(m.measureAutofitRow).mockReturnValue(24);
    vi.mocked(m.sampleCellFont).mockReturnValue({ fontFamily: "sans-serif", fontSize: 12, fontWeight: "400" });
  });

  it("calls onColResize for each column when measurement > 0", async () => {
    const { measureAutofitColumn } = await import("@/lib/measure");
    vi.mocked(measureAutofitColumn).mockReturnValue(80);
    const onColResize = vi.fn();
    const { result } = renderHook(() =>
      useGridDimensions(makeOpts({ onColResize })),
    );
    await act(async () => {
      result.current.handleAutofitCols([0, 1]);
    });
    // Each column should have gotten a resize call
    expect(onColResize).toHaveBeenCalledTimes(2);
    expect(onColResize).toHaveBeenCalledWith(0, expect.any(Number));
    expect(onColResize).toHaveBeenCalledWith(1, expect.any(Number));
  });

  it("calls onColReset when measurement returns 0 or negative", async () => {
    const { measureAutofitColumn } = await import("@/lib/measure");
    vi.mocked(measureAutofitColumn).mockReturnValue(0);
    const onColResize = vi.fn();
    const onColReset = vi.fn();
    const { result } = renderHook(() =>
      useGridDimensions(makeOpts({ onColResize, onColReset })),
    );
    await act(async () => {
      result.current.handleAutofitCols([0]);
    });
    expect(onColReset).toHaveBeenCalledWith(0);
    expect(onColResize).not.toHaveBeenCalled();
  });

  it("deduplicates and filters out-of-range columns", async () => {
    const onColResize = vi.fn();
    const { result } = renderHook(() =>
      useGridDimensions(makeOpts({ onColResize })),
    );
    await act(async () => {
      // totalCols=5, so col 99 is out of range; col 1 is duplicated
      result.current.handleAutofitCols([1, 1, 99]);
    });
    // Only col 1 (valid, unique) should be processed
    expect(onColResize).toHaveBeenCalledTimes(1);
    expect(onColResize).toHaveBeenCalledWith(1, expect.any(Number));
  });

  it("does nothing when cols array is empty", async () => {
    const onColResize = vi.fn();
    const { result } = renderHook(() =>
      useGridDimensions(makeOpts({ onColResize })),
    );
    await act(async () => {
      result.current.handleAutofitCols([]);
    });
    expect(onColResize).not.toHaveBeenCalled();
  });
});

describe("useGridDimensions — handleAutofitRows", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const m = await import("@/lib/measure");
    vi.mocked(m.awaitFontsReady).mockResolvedValue(undefined);
    vi.mocked(m.measureAutofitColumn).mockReturnValue(80);
    vi.mocked(m.measureAutofitRow).mockReturnValue(24);
    vi.mocked(m.sampleCellFont).mockReturnValue({ fontFamily: "sans-serif", fontSize: 12, fontWeight: "400" });
  });

  it("calls onRowResize for each row when measurement > 0", async () => {
    const { measureAutofitRow } = await import("@/lib/measure");
    vi.mocked(measureAutofitRow).mockReturnValue(24);
    const onRowResize = vi.fn();
    const { result } = renderHook(() =>
      useGridDimensions(makeOpts({ onRowResize })),
    );
    await act(async () => {
      result.current.handleAutofitRows([0, 1]);
    });
    expect(onRowResize).toHaveBeenCalledTimes(2);
  });

  it("calls onRowReset when measurement returns 0", async () => {
    const { measureAutofitRow } = await import("@/lib/measure");
    vi.mocked(measureAutofitRow).mockReturnValue(0);
    const onRowReset = vi.fn();
    const onRowResize = vi.fn();
    const { result } = renderHook(() =>
      useGridDimensions(makeOpts({ onRowReset, onRowResize })),
    );
    await act(async () => {
      result.current.handleAutofitRows([2]);
    });
    expect(onRowReset).toHaveBeenCalledWith(2);
    expect(onRowResize).not.toHaveBeenCalled();
  });

  it("does nothing when rows array is empty", async () => {
    const onRowResize = vi.fn();
    const { result } = renderHook(() =>
      useGridDimensions(makeOpts({ onRowResize })),
    );
    await act(async () => {
      result.current.handleAutofitRows([]);
    });
    expect(onRowResize).not.toHaveBeenCalled();
  });
});

describe("useGridDimensions — handleResizeAutofit via selectionRef", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const m = await import("@/lib/measure");
    vi.mocked(m.awaitFontsReady).mockResolvedValue(undefined);
    vi.mocked(m.measureAutofitColumn).mockReturnValue(80);
    vi.mocked(m.measureAutofitRow).mockReturnValue(24);
    vi.mocked(m.sampleCellFont).mockReturnValue({ fontFamily: "sans-serif", fontSize: 12, fontWeight: "400" });
  });

  it("autofits single col when no selection range covers it", async () => {
    const onColResize = vi.fn();
    const selectionRef = { current: null as Selection | null };
    const { result } = renderHook(() =>
      useGridDimensions(makeOpts({ onColResize, selectionRef })),
    );
    await act(async () => {
      result.current.handleResizeAutofit("col", 2);
    });
    expect(onColResize).toHaveBeenCalledWith(2, expect.any(Number));
  });

  it("autofits entire col selection range when target col is within it", async () => {
    const onColResize = vi.fn();
    const sel: Selection = {
      anchor: { row: 0, col: 1 },
      focus: { row: 9, col: 3 },
      mode: "col",
      scroll: "none",
      nonce: 1,
    };
    const selectionRef = { current: sel };
    const { result } = renderHook(() =>
      useGridDimensions(makeOpts({ onColResize, selectionRef })),
    );
    await act(async () => {
      result.current.handleResizeAutofit("col", 2); // col 2 is within [1,3]
    });
    // Should have called onColResize for cols 1, 2, 3
    expect(onColResize).toHaveBeenCalledTimes(3);
  });

  it("autofits single row when no selection covers it", async () => {
    const onRowResize = vi.fn();
    const { result } = renderHook(() =>
      useGridDimensions(makeOpts({ onRowResize })),
    );
    await act(async () => {
      result.current.handleResizeAutofit("row", 1);
    });
    expect(onRowResize).toHaveBeenCalledWith(1, expect.any(Number));
  });

  it("autofits entire row selection range when target row is within it", async () => {
    const onRowResize = vi.fn();
    const sel: Selection = {
      anchor: { row: 2, col: 0 },
      focus: { row: 4, col: 4 },
      mode: "row",
      scroll: "none",
      nonce: 1,
    };
    const selectionRef = { current: sel };
    const { result } = renderHook(() =>
      useGridDimensions(makeOpts({ onRowResize, selectionRef })),
    );
    await act(async () => {
      result.current.handleResizeAutofit("row", 3); // row 3 is within [2,4]
    });
    expect(onRowResize).toHaveBeenCalledTimes(3);
  });
});
