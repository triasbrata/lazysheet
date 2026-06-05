import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, userEvent, fireEvent } from "@/test/render";
import { FormulaBadge } from "./FormulaBadge";

vi.mock("@/lib/formula-copy", () => ({
  copyFormula: vi.fn().mockResolvedValue(true),
}));

import { copyFormula } from "@/lib/formula-copy";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FormulaBadge", () => {
  it("renders the trigger button with aria-label 'Show formula'", () => {
    renderWithProviders(<FormulaBadge formula="=SUM(A1:A5)" />);
    expect(
      screen.getByRole("button", { name: /Show formula/i })
    ).toBeInTheDocument();
  });

  it("does not show the formula popover content by default", () => {
    renderWithProviders(<FormulaBadge formula="=SUM(A1:A5)" />);
    // Popover is closed — formula text not rendered in DOM
    expect(screen.queryByText("=SUM(A1:A5)")).toBeNull();
  });

  it("opens popover and shows formula when trigger button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FormulaBadge formula="=AVERAGE(B2:B10)" />);

    await user.click(screen.getByRole("button", { name: /Show formula/i }));

    // Formula text should now be visible
    expect(await screen.findByText("=AVERAGE(B2:B10)")).toBeInTheDocument();
  });

  it("renders a Copy button inside the open popover", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FormulaBadge formula="=MAX(C1:C5)" />);

    await user.click(screen.getByRole("button", { name: /Show formula/i }));

    expect(await screen.findByRole("button", { name: /Copy/i })).toBeInTheDocument();
  });

  it("calls copyFormula with the formula string when Copy button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FormulaBadge formula="=SUM(A1:A5)" />);

    // Open popover
    await user.click(screen.getByRole("button", { name: /Show formula/i }));

    // Click Copy
    const copyBtn = await screen.findByRole("button", { name: /Copy/i });
    await user.click(copyBtn);

    expect(copyFormula).toHaveBeenCalledOnce();
    expect(copyFormula).toHaveBeenCalledWith("=SUM(A1:A5)");
  });

  it("closes the popover after copying formula", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FormulaBadge formula="=MIN(D1:D5)" />);

    // Open popover
    await user.click(screen.getByRole("button", { name: /Show formula/i }));
    expect(await screen.findByText("=MIN(D1:D5)")).toBeInTheDocument();

    // Copy
    const copyBtn = await screen.findByRole("button", { name: /Copy/i });
    await user.click(copyBtn);

    // Popover should close — formula text no longer in DOM
    // (waitFor not needed if copyFormula resolves immediately via mock)
    expect(screen.queryByText("=MIN(D1:D5)")).toBeNull();
  });

  // Lines 46-47: PopoverContent onPointerDown and onClick call e.stopPropagation()
  it("PopoverContent onPointerDown stops propagation to outer element", async () => {
    const user = userEvent.setup();
    const outerPointerDown = vi.fn();
    renderWithProviders(
      <div onPointerDown={outerPointerDown}>
        <FormulaBadge formula="=SUM(A1:A5)" />
      </div>
    );

    // Open popover
    await user.click(screen.getByRole("button", { name: /Show formula/i }));
    const formulaText = await screen.findByText("=SUM(A1:A5)");
    expect(formulaText).toBeInTheDocument();

    // Find the PopoverContent element (the popover panel, not the trigger)
    // The formula code element is inside PopoverContent
    const codeEl = screen.getByText("=SUM(A1:A5)");
    // pointerDown on the content — should NOT bubble to outer div
    fireEvent.pointerDown(codeEl);
    expect(outerPointerDown).not.toHaveBeenCalled();
  });

  it("PopoverContent onClick stops propagation to outer element", async () => {
    const user = userEvent.setup();
    const outerClick = vi.fn();
    renderWithProviders(
      <div onClick={outerClick}>
        <FormulaBadge formula="=AVERAGE(B1:B5)" />
      </div>
    );

    // Open popover
    await user.click(screen.getByRole("button", { name: /Show formula/i }));
    const formulaText = await screen.findByText("=AVERAGE(B1:B5)");
    expect(formulaText).toBeInTheDocument();

    // Click inside the popover content — should not bubble to wrapper div
    fireEvent.click(formulaText);
    expect(outerClick).not.toHaveBeenCalled();
    // Formula text still visible (popover stays open — click on code doesn't close it)
    expect(screen.queryByText("=AVERAGE(B1:B5)")).toBeInTheDocument();
  });
});
