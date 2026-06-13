/**
 * GridRow.test.tsx — unit tests for src/components/Grid/GridRow.tsx
 *
 * Tests the single-row virtual render block extracted from Grid.tsx.
 * All 4 cell-case branches are covered:
 *   (a) horizontal-only merge anchor
 *   (b) absorbed column of a horizontal merge (returns null)
 *   (c) vertical-merge placeholder
 *   (d) normal cell
 */
import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { GridRow } from "./GridRow";
import type { GridRowProps } from "./GridRow";
import { buildMergeInfo } from "./grid-utils";
import type { CellModel } from "@/lib/types";
import type { VirtualItem } from "@tanstack/virtual-core";

vi.mock("@/lib/tauri-api", () => ({
  openExternal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("motion/react", () => ({
  motion: new Proxy({} as Record<string, unknown>, {
    get: (_target, prop) => {
      if (prop === "span") {
        return ({ children, ...rest }: React.HTMLAttributes<HTMLSpanElement> & { children?: React.ReactNode }) => {
          const React = require("react");
          return React.createElement("span", rest, children);
        };
      }
      return ({ children, ...rest }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) => {
        const React = require("react");
        return React.createElement("div", rest, children);
      };
    },
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  useAnimationControls: () => ({ start: vi.fn(), set: vi.fn() }),
}));

import React from "react";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeVirtualItem(index = 0, start = 0, size = 24): VirtualItem {
  return {
    index,
    key: index,
    start,
    end: start + size,
    size,
    lane: 0,
  };
}

function makeCell(text: string): CellModel {
  return { v: { t: "Text", c: text } };
}

/**
 * Fixture sheet layout (0-indexed):
 *
 *  Row 0 (header): 4 normal cells
 *  Row 1:          4 normal cells
 *  Row 2:          col 0–1 horizontal-only merge anchor at (2,0); col 1 absorbed
 *  Row 3:          col 0 vertical merge anchor at (3,0); col 1, 2, 3 normal
 *  Row 4:          col 0 absorbed by vertical merge from row 3
 *
 * Merge definitions (1-indexed per buildMergeInfo convention):
 *  - horizontal: r1=3, c1=1, r2=3, c2=2  →  0-indexed row 2, cols 0–1 (rowSpan=1, colSpan=2)
 *  - vertical:   r1=4, c1=1, r2=5, c2=1  →  0-indexed rows 3–4, col 0   (rowSpan=2, colSpan=1)
 */
const NUM_COLS = 4;
const WIDTHS = [80, 80, 80, 80];
const ROW_NUM_COL_WIDTH = 44;
const BODY_WIDTH = ROW_NUM_COL_WIDTH + NUM_COLS * 80;

const MERGES = buildMergeInfo([
  { r1: 3, c1: 1, r2: 3, c2: 2 }, // horizontal-only: row 2 (0-indexed), cols 0–1
  { r1: 4, c1: 1, r2: 5, c2: 1 }, // vertical: rows 3–4 (0-indexed), col 0
]);

function makeRows() {
  return [
    [makeCell("H0"), makeCell("H1"), makeCell("H2"), makeCell("H3")],
    [makeCell("R1C0"), makeCell("R1C1"), makeCell("R1C2"), makeCell("R1C3")],
    [makeCell("Hmerge"), makeCell("Habsorbed"), makeCell("R2C2"), makeCell("R2C3")],
    [makeCell("Vmerge"), makeCell("R3C1"), makeCell("R3C2"), makeCell("R3C3")],
    [makeCell("Vabsorbed"), makeCell("R4C1"), makeCell("R4C2"), makeCell("R4C3")],
  ];
}

function defaultCellAt(rows: CellModel[][]): GridRowProps["cellAt"] {
  return (r, c) => rows[r]?.[c];
}

function defaultProps(
  overrides: Partial<GridRowProps> & { rowIdx?: number; rows?: CellModel[][] } = {},
): GridRowProps {
  const rows = overrides.rows ?? makeRows();
  const rowIdx = overrides.rowIdx ?? 1;
  const vr = overrides.vr ?? makeVirtualItem(rowIdx, rowIdx * 24, 24);

  return {
    vr,
    rowIdx,
    bodyWidth: BODY_WIDTH,
    rowNumColWidth: ROW_NUM_COL_WIDTH,
    totalCols: NUM_COLS,
    widths: WIDTHS,
    merges: MERGES,
    rowInSel: false,
    headerRow: 0,
    resizeDisabled: false,
    measureElement: vi.fn(),
    cellAt: defaultCellAt(rows),
    cellHighlight: vi.fn().mockReturnValue(null),
    headerFunnelFor: vi.fn().mockReturnValue(undefined),
    onRowHeaderPointerDown: vi.fn(),
    onResizePreview: vi.fn(),
    onResizeCommit: vi.fn(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GridRow — outer container", () => {
  it("renders [data-abs-row] with the correct rowIdx", () => {
    const { container } = renderWithProviders(<GridRow {...defaultProps({ rowIdx: 2 })} />);
    const row = container.querySelector("[data-abs-row='2']");
    expect(row).toBeInTheDocument();
  });

  it("outer div has className including 'flex'", () => {
    const { container } = renderWithProviders(<GridRow {...defaultProps()} />);
    const row = container.querySelector("[data-abs-row]") as HTMLElement;
    expect(row.className).toContain("flex");
  });

  it("is positioned absolute with top matching vr.start", () => {
    const vr = makeVirtualItem(3, 120, 24);
    const { container } = renderWithProviders(
      <GridRow {...defaultProps({ rowIdx: 3, vr })} />,
    );
    const row = container.querySelector("[data-abs-row='3']") as HTMLElement;
    expect(row.style.position).toBe("absolute");
    expect(row.style.top).toBe("120px");
  });

  it("passes ref to measureElement on the outer div", () => {
    const measureElement = vi.fn();
    renderWithProviders(<GridRow {...defaultProps({ measureElement })} />);
    // measureElement is called by React's ref callback once the element mounts
    expect(measureElement).toHaveBeenCalled();
  });
});

describe("GridRow — row-number header cell", () => {
  it("renders [data-row-header] with the correct row index value", () => {
    const { container } = renderWithProviders(<GridRow {...defaultProps({ rowIdx: 5 })} />);
    const header = container.querySelector("[data-row-header='5']");
    expect(header).toBeInTheDocument();
  });

  it("shows 1-indexed row number text (rowIdx+1)", () => {
    const { container } = renderWithProviders(<GridRow {...defaultProps({ rowIdx: 4 })} />);
    const header = container.querySelector("[data-row-header='4']") as HTMLElement;
    // text includes "5" (4+1)
    expect(header.textContent).toContain("5");
  });

  it("has title='Header row' when rowIdx === headerRow", () => {
    const { container } = renderWithProviders(
      <GridRow {...defaultProps({ rowIdx: 0, headerRow: 0 })} />,
    );
    const header = container.querySelector("[data-row-header='0']");
    expect(header?.getAttribute("title")).toBe("Header row");
  });

  it("has no title when rowIdx !== headerRow", () => {
    const { container } = renderWithProviders(
      <GridRow {...defaultProps({ rowIdx: 1, headerRow: 0 })} />,
    );
    const header = container.querySelector("[data-row-header='1']");
    expect(header?.getAttribute("title")).toBeNull();
  });

  it("applies amber styling when rowIdx === headerRow", () => {
    const { container } = renderWithProviders(
      <GridRow {...defaultProps({ rowIdx: 0, headerRow: 0 })} />,
    );
    const header = container.querySelector("[data-row-header='0']") as HTMLElement;
    expect(header.className).toContain("amber");
  });

  it("applies primary/20 styling when rowInSel=true", () => {
    const { container } = renderWithProviders(
      <GridRow {...defaultProps({ rowIdx: 1, rowInSel: true })} />,
    );
    const header = container.querySelector("[data-row-header='1']") as HTMLElement;
    expect(header.className).toContain("bg-primary/20");
  });

  it("applies muted styling for normal non-selected, non-header row", () => {
    const { container } = renderWithProviders(
      <GridRow {...defaultProps({ rowIdx: 1, headerRow: 0, rowInSel: false })} />,
    );
    const header = container.querySelector("[data-row-header='1']") as HTMLElement;
    expect(header.className).toContain("bg-muted/85");
  });

  it("renders ResizeHandle (role=separator, aria-orientation=horizontal) in the header", () => {
    const { container } = renderWithProviders(<GridRow {...defaultProps()} />);
    const handle = container.querySelector("[aria-orientation='horizontal']");
    expect(handle).toBeInTheDocument();
  });

  it("calls onRowHeaderPointerDown when header is clicked", () => {
    const onRowHeaderPointerDown = vi.fn();
    const { container } = renderWithProviders(
      <GridRow {...defaultProps({ rowIdx: 3, onRowHeaderPointerDown })} />,
    );
    const header = container.querySelector("[data-row-header='3']")!;
    fireEvent.pointerDown(header, { button: 0, pointerId: 1 });
    expect(onRowHeaderPointerDown).toHaveBeenCalledWith(
      expect.any(Object), // PointerEvent
      3,
    );
  });
});

describe("GridRow — cell case (a): horizontal-only merge anchor", () => {
  // Row 2 (0-indexed), col 0 is the horizontal-only merge anchor (colSpan=2).
  it("renders [data-r][data-c] for the anchor cell (row 2, col 0)", () => {
    const props = defaultProps({ rowIdx: 2 });
    const { container } = renderWithProviders(<GridRow {...props} />);
    const anchor = container.querySelector("[data-r='2'][data-c='0']");
    expect(anchor).toBeInTheDocument();
  });

  it("anchor cell width spans both columns (colSpan=2 → 2×80=160px)", () => {
    const props = defaultProps({ rowIdx: 2 });
    const { container } = renderWithProviders(<GridRow {...props} />);
    const anchor = container.querySelector("[data-r='2'][data-c='0']") as HTMLElement;
    // Cell wrapper div has width=160 in inline style
    expect(anchor.style.width).toBe("160px");
  });

  it("calls headerFunnelFor for the anchor cell column", () => {
    const headerFunnelFor = vi.fn().mockReturnValue(undefined);
    renderWithProviders(
      <GridRow {...defaultProps({ rowIdx: 2, headerFunnelFor })} />,
    );
    // headerFunnelFor is called for col 0 of row 2
    expect(headerFunnelFor).toHaveBeenCalledWith(0, 2);
  });
});

describe("GridRow — cell case (b): absorbed column of horizontal merge", () => {
  // Row 2, col 1 is absorbed by the horizontal merge at (2,0). It should render null.
  it("does NOT render [data-c='1'] for absorbed horizontal-merge column in row 2", () => {
    const props = defaultProps({ rowIdx: 2 });
    const { container } = renderWithProviders(<GridRow {...props} />);
    // col 1 is absorbed by horizontal merge → returns null (no element)
    const absorbed = container.querySelector("[data-r='2'][data-c='1']");
    expect(absorbed).toBeNull();
  });
});

describe("GridRow — cell case (c): vertical merge placeholder", () => {
  // Row 3, col 0 is the vertical merge anchor → isPlaceholder=true (anchor in map).
  // Row 4, col 0 is absorbed by the vertical merge → isPlaceholder=true.
  // Placeholder cells render a bare <div> (no data-r/data-c) to hold space in the
  // flex row layout. The real merged cell is rendered by MergeLayer absolutely.

  it("renders without crash for row with vertical merge anchor (row 3)", () => {
    const props = defaultProps({ rowIdx: 3 });
    const { container } = renderWithProviders(<GridRow {...props} />);
    // Row container is present
    const row = container.querySelector("[data-abs-row='3']");
    expect(row).toBeInTheDocument();
  });

  it("placeholder col (col 0 of row 3) does NOT render data-r/data-c (it's a spacer div)", () => {
    const props = defaultProps({ rowIdx: 3 });
    const { container } = renderWithProviders(<GridRow {...props} />);
    // Placeholder renders a bare div without data-r/data-c
    const mergeCell = container.querySelector("[data-r='3'][data-c='0']");
    expect(mergeCell).toBeNull();
  });

  it("renders without crash for row with absorbed vertical merge cell (row 4)", () => {
    const props = defaultProps({ rowIdx: 4 });
    const { container } = renderWithProviders(<GridRow {...props} />);
    const row = container.querySelector("[data-abs-row='4']");
    expect(row).toBeInTheDocument();
  });

  it("absorbed col (col 0 of row 4) does NOT render data-r/data-c (it's a spacer div)", () => {
    const props = defaultProps({ rowIdx: 4 });
    const { container } = renderWithProviders(<GridRow {...props} />);
    const absorbed = container.querySelector("[data-r='4'][data-c='0']");
    expect(absorbed).toBeNull();
  });

  it("placeholder cell does not call headerFunnelFor (no trailing prop)", () => {
    const headerFunnelFor = vi.fn().mockReturnValue(<span>funnel</span>);
    renderWithProviders(
      <GridRow {...defaultProps({ rowIdx: 3, headerFunnelFor })} />,
    );
    // headerFunnelFor should NOT be called for the placeholder col (col 0)
    const calls = (headerFunnelFor.mock.calls as [number, number][]).filter(
      ([col]) => col === 0,
    );
    expect(calls).toHaveLength(0);
  });

  it("non-placeholder cols in a row with a vertical merge render normally", () => {
    const props = defaultProps({ rowIdx: 3 });
    const { container } = renderWithProviders(<GridRow {...props} />);
    // Cols 1–3 are normal cells in row 3
    for (let c = 1; c < NUM_COLS; c++) {
      const cell = container.querySelector(`[data-r='3'][data-c='${c}']`);
      expect(cell).toBeInTheDocument();
    }
  });
});

describe("GridRow — cell case (d): normal cell", () => {
  it("renders all 4 normal cells for a plain row (row 1)", () => {
    const { container } = renderWithProviders(<GridRow {...defaultProps({ rowIdx: 1 })} />);
    for (let c = 0; c < NUM_COLS; c++) {
      const cell = container.querySelector(`[data-r='1'][data-c='${c}']`);
      expect(cell).toBeInTheDocument();
    }
  });

  it("normal cell text matches sheet data", () => {
    const { container } = renderWithProviders(<GridRow {...defaultProps({ rowIdx: 1 })} />);
    // Row 1, col 0 should render "R1C0"
    const cell = container.querySelector("[data-r='1'][data-c='0']") as HTMLElement;
    expect(cell?.textContent).toContain("R1C0");
  });

  it("calls cellHighlight for each normal cell", () => {
    const cellHighlight = vi.fn().mockReturnValue(null);
    renderWithProviders(
      <GridRow {...defaultProps({ rowIdx: 1, cellHighlight })} />,
    );
    expect(cellHighlight).toHaveBeenCalledWith(1, 0);
    expect(cellHighlight).toHaveBeenCalledWith(1, 1);
  });

  it("calls headerFunnelFor for each normal cell column", () => {
    const headerFunnelFor = vi.fn().mockReturnValue(undefined);
    renderWithProviders(
      <GridRow {...defaultProps({ rowIdx: 1, headerFunnelFor })} />,
    );
    expect(headerFunnelFor).toHaveBeenCalledWith(0, 1);
    expect(headerFunnelFor).toHaveBeenCalledWith(1, 1);
    expect(headerFunnelFor).toHaveBeenCalledWith(2, 1);
    expect(headerFunnelFor).toHaveBeenCalledWith(3, 1);
  });

  it("applies inHeaderRow prop when rowIdx === headerRow", () => {
    // Row 0 is the headerRow — its cells should receive inHeaderRow=true,
    // which adds a primary-colored top border (test via inline style).
    const { container } = renderWithProviders(
      <GridRow {...defaultProps({ rowIdx: 0, headerRow: 0 })} />,
    );
    // At least one cell for row 0 is in the DOM
    const cell = container.querySelector("[data-r='0'][data-c='0']") as HTMLElement;
    expect(cell).toBeInTheDocument();
    // inHeaderRow=true → borderTop contains var(--primary)
    expect(cell.style.borderTop).toContain("var(--primary)");
  });
});

describe("GridRow — resize callbacks forwarded", () => {
  it("onResizePreview is wired to row ResizeHandle", () => {
    const onResizePreview = vi.fn();
    const { container } = renderWithProviders(
      <GridRow {...defaultProps({ onResizePreview })} />,
    );
    const handle = container.querySelector("[aria-orientation='horizontal']")!;
    // Simulate drag: pointerDown + pointerMove + pointerUp
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 0, clientY: 30 });
    // onResizePreview should have been called during move
    expect(onResizePreview).toHaveBeenCalled();
  });

  it("onResizeCommit is wired to row ResizeHandle", () => {
    const onResizeCommit = vi.fn();
    const { container } = renderWithProviders(
      <GridRow {...defaultProps({ onResizeCommit })} />,
    );
    const handle = container.querySelector("[aria-orientation='horizontal']")!;
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 0, clientY: 30 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 0, clientY: 30 });
    expect(onResizeCommit).toHaveBeenCalled();
  });
});

describe("GridRow — headerFunnelFor renders trailing content", () => {
  it("renders funnel stub when headerFunnelFor returns a node", () => {
    const funnelNode = <span data-testid="funnel-stub">FUNNEL</span>;
    const headerFunnelFor = vi.fn().mockReturnValue(funnelNode);
    const { container } = renderWithProviders(
      <GridRow {...defaultProps({ rowIdx: 1, headerFunnelFor })} />,
    );
    // At least one funnel stub should be in the DOM
    const stubs = container.querySelectorAll("[data-testid='funnel-stub']");
    expect(stubs.length).toBeGreaterThan(0);
  });
});
