import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("renders unchecked by default", () => {
    renderWithProviders(<Checkbox />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it("renders with data-slot attribute", () => {
    renderWithProviders(<Checkbox />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("data-slot", "checkbox");
  });

  it("renders checked when defaultChecked is true", () => {
    renderWithProviders(<Checkbox defaultChecked />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
  });

  it("renders controlled checked state", () => {
    renderWithProviders(<Checkbox checked onCheckedChange={() => {}} />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
  });

  it("shows Check icon when checked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Checkbox />);
    const checkbox = screen.getByRole("checkbox");

    // Click to check
    await user.click(checkbox);
    // The checkbox indicator with check icon should be present
    // Radix renders indicator with data-state=checked
    expect(checkbox).toHaveAttribute("data-state", "checked");
  });

  it("toggles checked state via userEvent.click", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    renderWithProviders(<Checkbox onCheckedChange={onCheckedChange} />);
    const checkbox = screen.getByRole("checkbox");

    await user.click(checkbox);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("calls onCheckedChange with false when unchecked", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    renderWithProviders(
      <Checkbox defaultChecked onCheckedChange={onCheckedChange} />
    );
    const checkbox = screen.getByRole("checkbox");

    await user.click(checkbox);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it("applies custom className", () => {
    renderWithProviders(<Checkbox className="custom-check" />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox.className).toContain("custom-check");
  });

  it("is disabled when disabled prop passed", () => {
    renderWithProviders(<Checkbox disabled />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeDisabled();
  });
});
