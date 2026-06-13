/**
 * GridFilterControl.test.tsx
 *
 * Tests for the GridFilterControl component.
 * motion/react is mocked to plain elements (matching Grid.test.tsx pattern).
 */
import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { GridFilterControl, type GridFilterControlProps } from "./GridFilterControl";
import type { ColumnFilter } from "@/lib/grid-filter";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inactiveFilter: ColumnFilter = {
  condition: { op: "none", operand: "" },
  excluded: [],
};

const activeFilter: ColumnFilter = {
  condition: { op: "contains", operand: "foo" },
  excluded: [],
};

function makeProps(overrides: Partial<GridFilterControlProps> = {}): GridFilterControlProps {
  return {
    col: 0,
    isOpen: false,
    onOpenChange: vi.fn(),
    colFilter: undefined,
    distinctValues: [],
    onApply: vi.fn(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GridFilterControl", () => {
  it("renders the funnel button with aria-label", () => {
    const { container } = renderWithProviders(
      <GridFilterControl {...makeProps()} />
    );
    const btn = container.querySelector('[aria-label="Filter column"]');
    expect(btn).not.toBeNull();
  });

  it("renders a plain Filter icon when filter is inactive", () => {
    const { container } = renderWithProviders(
      <GridFilterControl {...makeProps({ colFilter: inactiveFilter })} />
    );
    // No animated motion.span wrapper — only a static svg (lucide icon)
    const btn = container.querySelector('[aria-label="Filter column"]');
    expect(btn).not.toBeNull();
    // The motion.span (which becomes a <span>) should NOT be present
    // because filterIsActive = false
    const spans = btn!.querySelectorAll("span");
    expect(spans.length).toBe(0);
  });

  it("wraps Filter icon in motion.span when filter is active", () => {
    const { container } = renderWithProviders(
      <GridFilterControl {...makeProps({ colFilter: activeFilter })} />
    );
    const btn = container.querySelector('[aria-label="Filter column"]');
    expect(btn).not.toBeNull();
    // motion.span is mocked to a plain <span>
    const spans = btn!.querySelectorAll("span");
    expect(spans.length).toBeGreaterThan(0);
  });

  it("wraps Filter icon in motion.span when filter has excluded values", () => {
    const filterWithExcluded: ColumnFilter = {
      condition: { op: "none", operand: "" },
      excluded: ["foo", "bar"],
    };
    const { container } = renderWithProviders(
      <GridFilterControl {...makeProps({ colFilter: filterWithExcluded })} />
    );
    const btn = container.querySelector('[aria-label="Filter column"]');
    expect(btn).not.toBeNull();
    const spans = btn!.querySelectorAll("span");
    expect(spans.length).toBeGreaterThan(0);
  });

  it("clicking the trigger calls onOpenChange(true)", () => {
    const onOpenChange = vi.fn();
    const { container } = renderWithProviders(
      <GridFilterControl {...makeProps({ onOpenChange })} />
    );
    const btn = container.querySelector('[aria-label="Filter column"]')!;
    fireEvent.click(btn);
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("pointerDown on trigger calls stopPropagation (does not bubble)", () => {
    const outerPointerDown = vi.fn();
    const { container } = renderWithProviders(
      <div onPointerDown={outerPointerDown}>
        <GridFilterControl {...makeProps()} />
      </div>
    );
    const btn = container.querySelector('[aria-label="Filter column"]')!;
    fireEvent.pointerDown(btn);
    // stopPropagation should prevent the outer handler from firing
    expect(outerPointerDown).not.toHaveBeenCalled();
  });

  it("forwards iconColor to button style", () => {
    const { container } = renderWithProviders(
      <GridFilterControl {...makeProps({ iconColor: "#ff0000" })} />
    );
    const btn = container.querySelector('[aria-label="Filter column"]') as HTMLButtonElement;
    expect(btn.style.color).toBe("rgb(255, 0, 0)");
  });

  it("does not set color style when iconColor is omitted", () => {
    const { container } = renderWithProviders(
      <GridFilterControl {...makeProps({ iconColor: undefined })} />
    );
    const btn = container.querySelector('[aria-label="Filter column"]') as HTMLButtonElement;
    // color should be empty/unset
    expect(btn.style.color).toBe("");
  });
});
