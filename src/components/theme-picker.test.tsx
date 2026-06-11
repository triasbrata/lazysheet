import { describe, it, expect } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { ThemePicker } from "./theme-picker";
import { THEME_PRESETS } from "@/lib/themes";

describe("ThemePicker", () => {
  it("renders the trigger button without crashing", () => {
    renderWithProviders(<ThemePicker />);
    expect(screen.getByTestId("theme-toggle-btn")).toBeInTheDocument();
  });

  it("opens dropdown and shows Light, Dark, System items", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemePicker />);

    await user.click(screen.getByTestId("theme-toggle-btn"));

    expect(await screen.findByTestId("theme-item-light")).toBeInTheDocument();
    expect(await screen.findByTestId("theme-item-dark")).toBeInTheDocument();
    expect(await screen.findByTestId("theme-item-system")).toBeInTheDocument();
  });

  it("shows at least one palette item (palenight)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemePicker />);

    await user.click(screen.getByTestId("theme-toggle-btn"));

    expect(await screen.findByTestId("theme-item-palenight")).toBeInTheDocument();
  });

  it("clicking theme-item-palenight does not throw", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemePicker />);

    await user.click(screen.getByTestId("theme-toggle-btn"));
    const palenightItem = await screen.findByTestId("theme-item-palenight");

    await expect(user.click(palenightItem)).resolves.not.toThrow();
  });

  it("clicking theme-item-light (a DEFAULT item) does not throw", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemePicker />);

    await user.click(screen.getByTestId("theme-toggle-btn"));
    const lightItem = await screen.findByTestId("theme-item-light");
    expect(lightItem).toBeInTheDocument();

    await expect(user.click(lightItem)).resolves.not.toThrow();
  });

  it("total menu items equals 3 defaults + palette count from registry", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemePicker />);

    await user.click(screen.getByTestId("theme-toggle-btn"));

    const items = await screen.findAllByRole("menuitem");
    const paletteCount = THEME_PRESETS.filter((p) => p.palette).length;
    expect(items.length).toBe(3 + paletteCount);
  });
});
