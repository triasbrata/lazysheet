import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { SheetTabs } from "./SheetTabs";
import type { SheetSummary } from "@/lib/types";

describe("SheetTabs", () => {
  it("renders null when sheets.length <= 1 (zero sheets)", () => {
    const { container } = renderWithProviders(
      <SheetTabs sheets={[]} activeName="" onSwitch={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders null when sheets.length <= 1 (one sheet)", () => {
    const sheets: SheetSummary[] = [{ name: "Sheet1", index: 0 }];
    const { container } = renderWithProviders(
      <SheetTabs sheets={sheets} activeName="Sheet1" onSwitch={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders tab buttons for each sheet when multiple sheets provided", () => {
    const sheets: SheetSummary[] = [
      { name: "Sheet1", index: 0 },
      { name: "Sheet2", index: 1 },
      { name: "Sheet3", index: 2 },
    ];
    renderWithProviders(
      <SheetTabs sheets={sheets} activeName="Sheet1" onSwitch={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: "Sheet1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sheet2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sheet3" })).toBeInTheDocument();
  });

  it("calls onSwitch with the sheet name when a tab is clicked", async () => {
    const onSwitch = vi.fn();
    const sheets: SheetSummary[] = [
      { name: "Alpha", index: 0 },
      { name: "Beta", index: 1 },
    ];
    const user = userEvent.setup();
    renderWithProviders(
      <SheetTabs sheets={sheets} activeName="Alpha" onSwitch={onSwitch} />
    );

    await user.click(screen.getByRole("button", { name: "Beta" }));
    expect(onSwitch).toHaveBeenCalledOnce();
    expect(onSwitch).toHaveBeenCalledWith("Beta");
  });

  it("applies active styling (indicator span) only to the active tab", () => {
    const sheets: SheetSummary[] = [
      { name: "Active", index: 0 },
      { name: "Inactive", index: 1 },
    ];
    renderWithProviders(
      <SheetTabs sheets={sheets} activeName="Active" onSwitch={vi.fn()} />
    );

    // Active tab has the accent span child (indicator stripe)
    const activeBtn = screen.getByRole("button", { name: "Active" });
    // The active button has `text-foreground` class (not muted)
    expect(activeBtn.className).toContain("text-foreground");
    // Active button contains the indicator span
    expect(activeBtn.querySelector("span")).not.toBeNull();

    // Inactive tab does not have the indicator span
    const inactiveBtn = screen.getByRole("button", { name: "Inactive" });
    expect(inactiveBtn.className).toContain("text-muted-foreground");
    expect(inactiveBtn.querySelector("span")).toBeNull();
  });

  it("first tab is called with its name on click", async () => {
    const onSwitch = vi.fn();
    const sheets: SheetSummary[] = [
      { name: "First", index: 0 },
      { name: "Second", index: 1 },
    ];
    const user = userEvent.setup();
    renderWithProviders(
      <SheetTabs sheets={sheets} activeName="Second" onSwitch={onSwitch} />
    );

    await user.click(screen.getByRole("button", { name: "First" }));
    expect(onSwitch).toHaveBeenCalledWith("First");
  });
});
