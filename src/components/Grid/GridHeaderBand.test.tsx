/**
 * GridHeaderBand.test.tsx
 *
 * Tests for the sticky header band component that mirrors the marked header
 * row under the column-letter ruler when it has scrolled off-screen.
 *
 * motion/react is mocked to plain elements (matching Grid.test.tsx pattern).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { GridHeaderBand, type GridHeaderBandProps } from "./GridHeaderBand";
import { buildMergeInfo } from "./grid-utils";
import type { SheetModel, CellModel } from "@/lib/types";
import type { HeaderGroup } from "@/lib/grid-filter";
import React from "react";

// ─── Mock motion/react (same pattern as Grid.test.tsx) ────────────────────────

vi.mock("motion/react", () => ({
  motion: new Proxy({} as Record<string, unknown>, {
    get: (_target, prop) => {
      if (prop === "span") {
        return ({ children, ...rest }: React.HTMLAttributes<HTMLSpanElement> & { children?: React.ReactNode }) => {
          return React.createElement("span", rest, children);
        };
      }
      return ({ children, ...rest }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) => {
        return React.createElement("div", rest, children);
      };
    },
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  useAnimationControls: () => ({ start: vi.fn(), set: vi.fn() }),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCell(text: string, extra: Partial<CellModel> = {}): CellModel {
  return { v: { t: "Text", c: text }, ...extra };
}

/** 4-column sheet with header row 0: ["ColA", "ColB", "ColC", "ColD"] */
function makeSheet(overrides: Partial<SheetModel> = {}): SheetModel {
  const NUM_COLS = 4;
  const NUM_ROWS = 5;
  const rows: CellModel[][] = Array.from({ length: NUM_ROWS }, (_, r) =>
    Array.from({ length: NUM_COLS }, (_, c) =>
      r === 0
        ? makeCell(`Col${String.fromCharCode(65 + c)}`)
        : makeCell(`R${r}C${c}`),
    ),
  );
  return {
    name: "Sheet1",
    rows,
    col_widths: Array.from({ length: NUM_COLS }, () => 80),
    row_heights: Array.from({ length: NUM_ROWS }, () => 24),
    merges: [],
    frozen_rows: 0,
    frozen_cols: 0,
    max_col: NUM_COLS,
    ...overrides,
  };
}

/** Build a groupByAnchor Map for the given anchor cols */
function makeGroupByAnchor(anchorCols: number[]): Map<number, HeaderGroup> {
  const m = new Map<number, HeaderGroup>();
  for (const col of anchorCols) {
    m.set(col, { anchorCol: col, cols: [col] });
  }
  return m;
}

function makeProps(overrides: Partial<GridHeaderBandProps> = {}): GridHeaderBandProps {
  const sheet = makeSheet();
  return {
    headerRow: 0,
    headerHeight: 24,
    bodyWidth: 364, // 4*80 + 44 row-num col
    rowNumColWidth: 44,
    totalCols: 4,
    widths: [80, 80, 80, 80],
    sheet,
    rowOverrides: undefined,
    merges: buildMergeInfo([]),
    groupByAnchor: new Map(),
    zoom: 1,
    renderFilterControl: vi.fn().mockReturnValue(null),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GridHeaderBand", () => {
  describe("header cell text", () => {
    it("renders one cell div per column", () => {
      const { container } = renderWithProviders(
        <GridHeaderBand {...makeProps()} />,
      );
      // 4 data columns + 1 corner spacer = 5 immediate children
      const band = container.firstElementChild!;
      expect(band.children.length).toBe(5);
    });

    it("shows the text from the header row cells", () => {
      renderWithProviders(<GridHeaderBand {...makeProps()} />);
      expect(screen.getByText("ColA")).toBeInTheDocument();
      expect(screen.getByText("ColB")).toBeInTheDocument();
      expect(screen.getByText("ColC")).toBeInTheDocument();
      expect(screen.getByText("ColD")).toBeInTheDocument();
    });

    it("renders empty text for a missing cell in the header row", () => {
      const sheet = makeSheet();
      // Remove cell at col 2
      sheet.rows[0][2] = undefined as unknown as CellModel;
      const { container } = renderWithProviders(
        <GridHeaderBand {...makeProps({ sheet })} />,
      );
      // Should render without crash; the span for col 2 is present but empty
      const spans = container.querySelectorAll("span.truncate");
      expect(spans[2].textContent).toBe("");
    });
  });

  describe("corner spacer", () => {
    it("renders a corner spacer as the first child of the band", () => {
      const { container } = renderWithProviders(
        <GridHeaderBand {...makeProps()} />,
      );
      const band = container.firstElementChild!;
      const corner = band.firstElementChild as HTMLElement;
      expect(corner.style.width).toBe("44px");
      expect(corner.className).toContain("sticky");
      expect(corner.className).toContain("left-0");
    });
  });

  describe("filter control slot", () => {
    it("does NOT invoke renderFilterControl for columns without a groupByAnchor entry", () => {
      const renderFilterControl = vi.fn().mockReturnValue(null);
      renderWithProviders(
        <GridHeaderBand {...makeProps({ renderFilterControl, groupByAnchor: new Map() })} />,
      );
      expect(renderFilterControl).not.toHaveBeenCalled();
    });

    it("invokes renderFilterControl with (col, 'band') for anchor columns", () => {
      const renderFilterControl = vi.fn().mockReturnValue(null);
      const groupByAnchor = makeGroupByAnchor([1, 3]);
      renderWithProviders(
        <GridHeaderBand {...makeProps({ renderFilterControl, groupByAnchor })} />,
      );
      expect(renderFilterControl).toHaveBeenCalledWith(1, "band");
      expect(renderFilterControl).toHaveBeenCalledWith(3, "band");
      expect(renderFilterControl).not.toHaveBeenCalledWith(0, expect.any(String));
      expect(renderFilterControl).not.toHaveBeenCalledWith(2, expect.any(String));
    });

    it("renders marker elements returned by renderFilterControl", () => {
      const MARKER = "FILTER_MARKER_COL1";
      const renderFilterControl = vi.fn((col: number) =>
        col === 1 ? <span data-testid={MARKER} /> : null,
      );
      const groupByAnchor = makeGroupByAnchor([1]);
      renderWithProviders(
        <GridHeaderBand {...makeProps({ renderFilterControl, groupByAnchor })} />,
      );
      expect(screen.getByTestId(MARKER)).toBeInTheDocument();
    });

    it("renders filter markers for multiple anchor columns", () => {
      const renderFilterControl = vi.fn((col: number) => (
        <span data-testid={`marker-col-${col}`} />
      ));
      const groupByAnchor = makeGroupByAnchor([0, 2]);
      renderWithProviders(
        <GridHeaderBand {...makeProps({ renderFilterControl, groupByAnchor })} />,
      );
      expect(screen.getByTestId("marker-col-0")).toBeInTheDocument();
      expect(screen.getByTestId("marker-col-2")).toBeInTheDocument();
      expect(screen.queryByTestId("marker-col-1")).toBeNull();
      expect(screen.queryByTestId("marker-col-3")).toBeNull();
    });
  });

  describe("merge handling", () => {
    it("skips absorbed cells of a horizontal merge", () => {
      // MergeRange uses 1-indexed coords (same as Excel cell refs).
      // Row 0 (0-indexed) = r=1; cols 1-2 (0-indexed) = c=2..3
      const merges = buildMergeInfo([{ r1: 1, c1: 2, r2: 1, c2: 3 }]);
      const { container } = renderWithProviders(
        <GridHeaderBand {...makeProps({ merges })} />,
      );
      // The anchor cell (col 1, key "1:2") renders with horizSpan=2.
      // The absorbed cell (col 2, key "1:3") returns null → no DOM node.
      // DOM children: corner + col0 div + col1 div (span-2) + col3 div = 4
      const band = container.firstElementChild!;
      expect(band.children.length).toBe(4);
    });
  });

  describe("sticky positioning", () => {
    it("applies top equal to headerHeight via inline style", () => {
      const { container } = renderWithProviders(
        <GridHeaderBand {...makeProps({ headerHeight: 32 })} />,
      );
      const band = container.firstElementChild as HTMLElement;
      expect(band.style.top).toBe("32px");
    });

    it("applies width equal to bodyWidth via inline style", () => {
      const { container } = renderWithProviders(
        <GridHeaderBand {...makeProps({ bodyWidth: 500 })} />,
      );
      const band = container.firstElementChild as HTMLElement;
      expect(band.style.width).toBe("500px");
    });
  });
});
