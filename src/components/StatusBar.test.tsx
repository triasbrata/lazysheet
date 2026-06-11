import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { StatusBar } from "./StatusBar";
import type { SheetModel } from "@/lib/types";
import type { Selection } from "@/components/Grid/Grid";

// Minimal sheet factory
function makeSheet(
  rows: { [col: number]: { v: { t: string; c: unknown } } }[],
  maxCol = 3
): SheetModel {
  return {
    name: "Sheet1",
    rows: rows as SheetModel["rows"],
    col_widths: [],
    row_heights: [],
    merges: [],
    frozen_rows: 0,
    frozen_cols: 0,
    max_col: maxCol,
  };
}

function makeSelection(
  anchorRow: number,
  anchorCol: number,
  focusRow?: number,
  focusCol?: number,
  mode: "cell" | "row" | "col" | "all" = "cell"
): Selection {
  return {
    anchor: { row: anchorRow, col: anchorCol },
    focus: { row: focusRow ?? anchorRow, col: focusCol ?? anchorCol },
    mode,
    nonce: 0,
  };
}

describe("StatusBar — no sheet or no selection", () => {
  it("renders the empty/minimal bar when sheet is null", () => {
    renderWithProviders(
      <StatusBar sheet={null} selection={null} />
    );
    // shows the dash placeholder
    expect(screen.getByTestId("statusbar-cell-ref")).toHaveTextContent("—");
  });

  it("renders minimal bar when sheet provided but selection is null", () => {
    const sheet = makeSheet([]);
    renderWithProviders(
      <StatusBar sheet={sheet} selection={null} />
    );
    expect(screen.getByTestId("statusbar-cell-ref")).toHaveTextContent("—");
  });

  it("renders zoom controls when sheet has selection=null but zoom props are supplied", () => {
    const sheet = makeSheet([]);
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onZoomReset = vi.fn();
    renderWithProviders(
      <StatusBar
        sheet={sheet}
        selection={null}
        zoom={1}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onZoomReset={onZoomReset}
      />
    );
    expect(screen.getByTestId("statusbar-zoom-label")).toBeInTheDocument();
    expect(screen.getByTestId("statusbar-cell-ref")).toHaveTextContent("—");
  });

  it("does not render zoom controls when zoom props are absent (sheet=null, selection=null)", () => {
    renderWithProviders(
      <StatusBar sheet={null} selection={null} />
    );
    expect(screen.getByTestId("statusbar-cell-ref")).toHaveTextContent("—");
    expect(screen.queryByTestId("statusbar-zoom-label")).toBeNull();
  });
});

describe("StatusBar — single-cell selection", () => {
  it("shows the cell reference (e.g. A1) for a single cell", () => {
    const sheet = makeSheet([[{ v: { t: "Text", c: "Hello" } }]]);
    const sel = makeSelection(0, 0);
    renderWithProviders(<StatusBar sheet={sheet} selection={sel} />);
    expect(screen.getByText("A1")).toBeInTheDocument();
  });

  it("shows the cell value preview for single-cell selection", () => {
    const sheet = makeSheet([[{ v: { t: "Text", c: "World" } }]]);
    const sel = makeSelection(0, 0);
    renderWithProviders(<StatusBar sheet={sheet} selection={sel} />);
    expect(screen.getByText("World")).toBeInTheDocument();
  });
});

describe("StatusBar — range selection", () => {
  it("shows selection size text for a range", () => {
    // Create sheet with a 2x2 block of numbers for stats
    const sheet = makeSheet([
      [
        { v: { t: "Number", c: 10 } },
        { v: { t: "Number", c: 20 } },
      ],
      [
        { v: { t: "Number", c: 30 } },
        { v: { t: "Number", c: 40 } },
      ],
    ], 2);
    const sel = makeSelection(0, 0, 1, 1);
    renderWithProviders(<StatusBar sheet={sheet} selection={sel} />);
    // Should contain selection size info
    expect(screen.getByText(/2R × 2C/)).toBeInTheDocument();
  });

  it("shows numeric stats (SUM, AVG, MIN, MAX, COUNT) for a numeric range", () => {
    const sheet = makeSheet([
      [
        { v: { t: "Number", c: 10 } },
        { v: { t: "Number", c: 20 } },
      ],
      [
        { v: { t: "Number", c: 30 } },
        { v: { t: "Number", c: 40 } },
      ],
    ], 2);
    // Range selection: anchor=(0,0), focus=(1,1)
    const sel = makeSelection(0, 0, 1, 1);
    renderWithProviders(<StatusBar sheet={sheet} selection={sel} />);
    // Stats label like "SUM: 100 · AVG: 25 · MIN: 10 · MAX: 40 · COUNT: 4"
    expect(screen.getByText(/SUM:/)).toBeInTheDocument();
    expect(screen.getByText(/AVG:/)).toBeInTheDocument();
    expect(screen.getByText(/COUNT:/)).toBeInTheDocument();
  });

  it("shows anchor label (⇢ B2) when range selection is active", () => {
    const sheet = makeSheet([
      [{ v: { t: "Number", c: 1 } }, { v: { t: "Number", c: 2 } }],
      [{ v: { t: "Number", c: 3 } }, { v: { t: "Number", c: 4 } }],
    ], 2);
    // anchor at row=1, col=1 → B2
    const sel: Selection = {
      anchor: { row: 1, col: 1 },
      focus: { row: 0, col: 0 },
      mode: "cell",
      nonce: 0,
    };
    renderWithProviders(<StatusBar sheet={sheet} selection={sel} />);
    expect(screen.getByText(/⇢ B2/)).toBeInTheDocument();
  });
});

describe("StatusBar — summarize button", () => {
  it("renders the Analyze button when canSummarize and onOpenSummary are provided", () => {
    const sheet = makeSheet([[{ v: { t: "Text", c: "hi" } }]]);
    const sel = makeSelection(0, 0);
    const onOpenSummary = vi.fn();
    renderWithProviders(
      <StatusBar
        sheet={sheet}
        selection={sel}
        canSummarize
        onOpenSummary={onOpenSummary}
      />
    );
    expect(screen.getByRole("button", { name: /Analyze/i })).toBeInTheDocument();
  });

  it("calls onOpenSummary when Analyze button is clicked", async () => {
    const sheet = makeSheet([[{ v: { t: "Text", c: "hi" } }]]);
    const sel = makeSelection(0, 0);
    const onOpenSummary = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <StatusBar
        sheet={sheet}
        selection={sel}
        canSummarize
        onOpenSummary={onOpenSummary}
      />
    );
    await user.click(screen.getByRole("button", { name: /Analyze/i }));
    expect(onOpenSummary).toHaveBeenCalledOnce();
  });

  it("does not render Analyze button when canSummarize is false", () => {
    const sheet = makeSheet([[{ v: { t: "Text", c: "hi" } }]]);
    const sel = makeSelection(0, 0);
    renderWithProviders(
      <StatusBar sheet={sheet} selection={sel} canSummarize={false} />
    );
    expect(screen.queryByRole("button", { name: /Analyze/i })).toBeNull();
  });

  it("does not render Analyze button when onOpenSummary is missing", () => {
    const sheet = makeSheet([[{ v: { t: "Text", c: "hi" } }]]);
    const sel = makeSelection(0, 0);
    renderWithProviders(
      <StatusBar sheet={sheet} selection={sel} canSummarize={true} />
    );
    expect(screen.queryByRole("button", { name: /Analyze/i })).toBeNull();
  });
});
