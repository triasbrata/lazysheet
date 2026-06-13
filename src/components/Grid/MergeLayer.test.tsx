import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MergeLayer } from "./MergeLayer";
import { buildMergeInfo } from "./grid-utils";
import type { SheetModel } from "@/lib/types";

vi.mock("@/lib/tauri-api", () => ({
  openExternal: vi.fn().mockResolvedValue(undefined),
}));

// Build a minimal measurements array for N rows of a given height
function makeMeasurements(
  count: number,
  rowHeight = 24,
): ReadonlyArray<{ index: number; start: number; end: number; size: number }> {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    start: i * rowHeight,
    end: (i + 1) * rowHeight,
    size: rowHeight,
  }));
}

// Build a visiblePos map: absolute row index → virtual position (identity when no filter)
function makeVisiblePos(count: number): Map<number, number> {
  return new Map(Array.from({ length: count }, (_, i) => [i, i]));
}

function makeCell(text: string): SheetModel["rows"][number][number] {
  return { v: { t: "Text" as const, c: text } };
}

// Minimal SheetModel fixture with a 2-row vertical merge at 0-indexed (row 0, col 0).
// MergeRange values are 1-indexed (matching the xlsx backend convention):
// r1=1, c1=1 → 0-indexed row 0, col 0; r2=2 → 0-indexed row 1.
function makeSheetWithMerges(): SheetModel {
  return {
    name: "Sheet1",
    max_col: 3,
    col_widths: [80, 100, 120],
    row_heights: [24, 24, 24],
    frozen_rows: 0,
    frozen_cols: 0,
    rows: [
      [makeCell("merged cell"), makeCell("B1"), makeCell("C1")],
      [makeCell("A2"), makeCell("B2"), makeCell("C2")],
      [makeCell("A3"), makeCell("B3"), makeCell("C3")],
    ],
    // Vertical merge spanning 1-indexed rows 1–2, col 1 → 0-indexed rows 0–1, col 0
    merges: [{ r1: 1, c1: 1, r2: 2, c2: 1 }],
  };
}

describe("MergeLayer", () => {
  it("renders an absolute-positioned merged Cell anchor for a vertical merge", () => {
    const sheet = makeSheetWithMerges();
    const merges = buildMergeInfo(sheet.merges);
    const widths = [80, 100, 120];
    const cumColX = [0, 80, 180];
    const measurements = makeMeasurements(3);
    const visiblePos = makeVisiblePos(3);

    const { container } = render(
      <MergeLayer
        merges={merges}
        measurements={measurements}
        visiblePos={visiblePos}
        sheet={sheet}
        widths={widths}
        cumColX={cumColX}
        leftOffset={40}
        cellHighlight={() => null}
        headerRow={null}
      />,
    );

    // The merge anchor cell should be rendered; it uses absolute positioning
    // Check that a data cell at data-r=0 data-c=0 is in the DOM
    const mergeCell = container.querySelector("[data-r='0'][data-c='0']");
    expect(mergeCell).not.toBeNull();

    // The cell should be absolutely positioned (MergeLayer passes absolute=true to Cell)
    // Cell renders the wrapper div with position:absolute via inline style
    const cellEl = mergeCell as HTMLElement | null;
    expect(cellEl?.style.position).toBe("absolute");
  });

  it("renders nothing when there are no merges (empty anchors)", () => {
    const sheet: SheetModel = {
      name: "Sheet1",
      max_col: 2,
      col_widths: [80, 100],
      row_heights: [24, 24],
      frozen_rows: 0,
      frozen_cols: 0,
      rows: [
        [makeCell("A1"), makeCell("B1")],
        [makeCell("A2"), makeCell("B2")],
      ],
      merges: [],
    };

    const merges = buildMergeInfo(sheet.merges);
    const measurements = makeMeasurements(2);
    const visiblePos = makeVisiblePos(2);

    const { container } = render(
      <MergeLayer
        merges={merges}
        measurements={measurements}
        visiblePos={visiblePos}
        sheet={sheet}
        widths={[80, 100]}
        cumColX={[0, 80]}
        leftOffset={40}
        cellHighlight={() => null}
        headerRow={null}
      />,
    );

    // No data-r/data-c cells should be rendered (nothing to merge)
    expect(container.querySelector("[data-r]")).toBeNull();
  });

  it("skips horizontal-only merges (they are rendered inline in the row, not by MergeLayer)", () => {
    // A merge spanning 1 row × 2 cols is horizontal-only — MergeLayer skips it
    const sheet: SheetModel = {
      name: "Sheet1",
      max_col: 3,
      col_widths: [80, 100, 120],
      row_heights: [24, 24],
      frozen_rows: 0,
      frozen_cols: 0,
      rows: [
        [makeCell("merged"), makeCell(""), makeCell("C1")],
        [makeCell("A2"), makeCell("B2"), makeCell("C2")],
      ],
      // Horizontal-only merge: 1-indexed row 1, cols 1–2 → 0-indexed row 0, cols 0–1 (rowSpan=1, colSpan=2)
      merges: [{ r1: 1, c1: 1, r2: 1, c2: 2 }],
    };

    const merges = buildMergeInfo(sheet.merges);
    const measurements = makeMeasurements(2);
    const visiblePos = makeVisiblePos(2);

    const { container } = render(
      <MergeLayer
        merges={merges}
        measurements={measurements}
        visiblePos={visiblePos}
        sheet={sheet}
        widths={[80, 100, 120]}
        cumColX={[0, 80, 180]}
        leftOffset={40}
        cellHighlight={() => null}
        headerRow={null}
      />,
    );

    // Horizontal-only merge is skipped; MergeLayer renders nothing
    expect(container.querySelector("[data-r]")).toBeNull();
  });

  it("applies cellHighlight to the anchor cell", () => {
    const sheet = makeSheetWithMerges();
    const merges = buildMergeInfo(sheet.merges);
    const measurements = makeMeasurements(3);
    const visiblePos = makeVisiblePos(3);

    const { container } = render(
      <MergeLayer
        merges={merges}
        measurements={measurements}
        visiblePos={visiblePos}
        sheet={sheet}
        widths={[80, 100, 120]}
        cumColX={[0, 80, 180]}
        leftOffset={40}
        cellHighlight={(r, c) => (r === 0 && c === 0 ? "selected" : null)}
        headerRow={null}
      />,
    );

    // The merge anchor cell should be in DOM — cellHighlight is passed through to Cell
    const mergeCell = container.querySelector("[data-r='0'][data-c='0']");
    expect(mergeCell).not.toBeNull();
  });
});
