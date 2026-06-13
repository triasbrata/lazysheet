import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SelectionFrame } from "./SelectionFrame";

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

describe("SelectionFrame", () => {
  it("renders an SVG selection frame with correct dimensions when bounds are valid", () => {
    // Selecting rows 0–1, cols 0–1: 2 rows × 2 cols
    const widths = [80, 100, 120];
    const cumColX = [0, 80, 180];
    const measurements = makeMeasurements(5);
    const visiblePos = makeVisiblePos(5);

    const { container } = render(
      <SelectionFrame
        bounds={{ r1: 0, r2: 1, c1: 0, c2: 1 }}
        mode="cell"
        widths={widths}
        cumColX={cumColX}
        visiblePos={visiblePos}
        measurements={measurements}
        leftOffset={40}
      />,
    );

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    // aria-hidden must be set
    expect(svg).toHaveAttribute("aria-hidden");

    // Width = widths[0] + widths[1] = 180; height = 2 rows * 24 = 48
    const expectedW = Math.round(80 + 100); // 180
    const expectedH = Math.round(2 * 24); // 48
    expect(svg).toHaveAttribute("width", String(expectedW));
    expect(svg).toHaveAttribute("height", String(expectedH));
    expect(svg).toHaveAttribute("viewBox", `0 0 ${expectedW} ${expectedH}`);

    // Position: left = leftOffset(40) + cumColX[0](0) = 40; top = measurements[0].start = 0
    expect(svg).toHaveStyle({ left: "40px", top: "0px" });

    // The inner rect should carry the selection-ants class
    const rect = container.querySelector("rect.selection-ants");
    expect(rect).not.toBeNull();
  });

  it("renders frame starting at a non-zero column with leftOffset applied", () => {
    const widths = [80, 100, 120];
    const cumColX = [0, 80, 180];
    const measurements = makeMeasurements(5);
    const visiblePos = makeVisiblePos(5);

    const { container } = render(
      <SelectionFrame
        bounds={{ r1: 2, r2: 3, c1: 1, c2: 2 }}
        mode="cell"
        widths={widths}
        cumColX={cumColX}
        visiblePos={visiblePos}
        measurements={measurements}
        leftOffset={50}
      />,
    );

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();

    // Width = widths[1] + widths[2] = 220; height = 2 rows * 24 = 48
    expect(svg).toHaveAttribute("width", "220");
    expect(svg).toHaveAttribute("height", "48");

    // left = leftOffset(50) + cumColX[1](80) = 130; top = measurements[2].start = 48
    expect(svg).toHaveStyle({ left: "130px", top: "48px" });
  });

  it("renders nothing when bounds is null", () => {
    const { container } = render(
      <SelectionFrame
        bounds={null}
        mode="cell"
        widths={[80]}
        cumColX={[0]}
        visiblePos={new Map()}
        measurements={[]}
        leftOffset={0}
      />,
    );

    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders nothing when mode is null", () => {
    const { container } = render(
      <SelectionFrame
        bounds={{ r1: 0, r2: 0, c1: 0, c2: 0 }}
        mode={null}
        widths={[80]}
        cumColX={[0]}
        visiblePos={new Map([[0, 0]])}
        measurements={makeMeasurements(1)}
        leftOffset={0}
      />,
    );

    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders nothing when rows are not in the visible set (empty visiblePos)", () => {
    // visiblePos has no entry for rows 0–1, so selectionRowSpan returns null
    const { container } = render(
      <SelectionFrame
        bounds={{ r1: 0, r2: 1, c1: 0, c2: 1 }}
        mode="cell"
        widths={[80, 100]}
        cumColX={[0, 80]}
        visiblePos={new Map()}
        measurements={makeMeasurements(5)}
        leftOffset={0}
      />,
    );

    expect(container.querySelector("svg")).toBeNull();
  });
});
