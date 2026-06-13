import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen } from "@/test/render";
import { GridColumnRuler } from "./GridColumnRuler";
import type { GridColumnRulerProps } from "./GridColumnRuler";

const DEFAULT_WIDTHS = [80, 100, 60]; // A, B, C

function makeProps(overrides: Partial<GridColumnRulerProps> = {}): GridColumnRulerProps {
  return {
    widths: DEFAULT_WIDTHS,
    headerHeight: 24,
    rowNumColWidth: 44,
    bodyWidth: 284,
    resizeDisabled: false,
    expandedBounds: null,
    onCornerPointerDown: vi.fn(),
    onColHeaderPointerDown: vi.fn(),
    onResizePreview: vi.fn(),
    onResizeCommit: vi.fn(),
    onResizeAutofit: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GridColumnRuler", () => {
  describe("column header cells", () => {
    it("renders one [data-col-header] per column width", () => {
      renderWithProviders(<GridColumnRuler {...makeProps()} />);
      const headers = document.querySelectorAll("[data-col-header]");
      expect(headers).toHaveLength(DEFAULT_WIDTHS.length);
    });

    it("assigns correct letter labels (A, B, C) to headers", () => {
      renderWithProviders(<GridColumnRuler {...makeProps()} />);
      expect(screen.getByText("A")).toBeInTheDocument();
      expect(screen.getByText("B")).toBeInTheDocument();
      expect(screen.getByText("C")).toBeInTheDocument();
    });

    it("renders correct data-col-header indices (0-based)", () => {
      renderWithProviders(<GridColumnRuler {...makeProps()} />);
      const headers = document.querySelectorAll("[data-col-header]");
      headers.forEach((el, i) => {
        expect(el.getAttribute("data-col-header")).toBe(String(i));
      });
    });
  });

  describe("corner cell", () => {
    it("renders the corner (select-all) cell", () => {
      const { container } = renderWithProviders(<GridColumnRuler {...makeProps()} />);
      // Corner is the first sticky div with the select-all handler
      const corner = container.querySelector(".sticky.left-0.z-40");
      expect(corner).not.toBeNull();
    });

    it("calls onCornerPointerDown when corner is pressed", () => {
      const onCornerPointerDown = vi.fn();
      const { container } = renderWithProviders(
        <GridColumnRuler {...makeProps({ onCornerPointerDown })} />,
      );
      const corner = container.querySelector(".sticky.left-0.z-40") as HTMLElement;
      fireEvent.pointerDown(corner);
      expect(onCornerPointerDown).toHaveBeenCalledTimes(1);
    });
  });

  describe("pointerdown forwarding on column header", () => {
    it("calls onColHeaderPointerDown with the correct column index and event", () => {
      const onColHeaderPointerDown = vi.fn();
      renderWithProviders(
        <GridColumnRuler {...makeProps({ onColHeaderPointerDown })} />,
      );
      const headers = document.querySelectorAll("[data-col-header]");

      // Test each column header fires with the right index
      headers.forEach((el, i) => {
        fireEvent.pointerDown(el);
        expect(onColHeaderPointerDown).toHaveBeenLastCalledWith(
          expect.any(Object), // the synthetic PointerEvent
          i,
        );
      });
      expect(onColHeaderPointerDown).toHaveBeenCalledTimes(DEFAULT_WIDTHS.length);
    });
  });

  describe("in-selection styling", () => {
    it("applies highlight class to columns inside selection bounds", () => {
      renderWithProviders(
        <GridColumnRuler
          {...makeProps({ expandedBounds: { c1: 1, c2: 2 } })}
        />,
      );
      const headers = document.querySelectorAll("[data-col-header]");

      // Col 0 (A) — outside selection
      expect(headers[0]).not.toHaveClass("bg-primary/15");
      // Col 1 (B) — inside selection
      expect(headers[1]).toHaveClass("bg-primary/15");
      // Col 2 (C) — inside selection
      expect(headers[2]).toHaveClass("bg-primary/15");
    });

    it("applies no highlight when expandedBounds is null", () => {
      renderWithProviders(
        <GridColumnRuler {...makeProps({ expandedBounds: null })} />,
      );
      const headers = document.querySelectorAll("[data-col-header]");
      headers.forEach((el) => {
        expect(el).not.toHaveClass("bg-primary/15");
      });
    });
  });

  describe("ResizeHandle presence", () => {
    it("renders a ResizeHandle (separator) per column when not disabled", () => {
      renderWithProviders(<GridColumnRuler {...makeProps()} />);
      const handles = screen.getAllByRole("separator");
      // One per non-zero-width column
      expect(handles).toHaveLength(DEFAULT_WIDTHS.length);
    });

    it("marks all ResizeHandles as aria-disabled when resizeDisabled is true", () => {
      renderWithProviders(
        <GridColumnRuler {...makeProps({ resizeDisabled: true })} />,
      );
      const handles = screen.getAllByRole("separator");
      handles.forEach((handle) => {
        expect(handle).toHaveAttribute("aria-disabled", "true");
      });
    });

    it("does NOT render a ResizeHandle for zero-width columns", () => {
      // Width of 0 means hidden column — handle should be omitted
      const widths = [80, 0, 60];
      renderWithProviders(
        <GridColumnRuler {...makeProps({ widths })} />,
      );
      const handles = screen.getAllByRole("separator");
      // Only 2 non-zero columns
      expect(handles).toHaveLength(2);
    });
  });
});
