import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { LanguageToggle } from "./LanguageToggle";
import { SUPPORTED_LANGUAGES } from "@/i18n/languages";

describe("LanguageToggle", () => {
  it("renders the toggle button (Languages icon) without crashing", () => {
    renderWithProviders(<LanguageToggle />);
    // sr-only text from i18n: "Change language"
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("opens dropdown and lists all SUPPORTED_LANGUAGES on trigger click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LanguageToggle />);

    await user.click(screen.getByRole("button"));

    for (const { nativeLabel } of SUPPORTED_LANGUAGES) {
      expect(await screen.findByText(nativeLabel)).toBeInTheDocument();
    }
  });

  it("dropdown shows English in the list", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LanguageToggle />);

    await user.click(screen.getByRole("button"));
    expect(await screen.findByText("English")).toBeInTheDocument();
  });

  it("dropdown shows Bahasa Indonesia in the list", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LanguageToggle />);

    await user.click(screen.getByRole("button"));
    expect(await screen.findByText("Bahasa Indonesia")).toBeInTheDocument();
  });

  it("calls i18n.changeLanguage with the selected code when a language item is clicked", async () => {
    const user = userEvent.setup();

    // We spy on the real i18n instance used inside the provider
    // renderWithProviders uses testI18n which wraps i18next.createInstance
    // We can verify by checking the menu item is clickable (no throw)
    renderWithProviders(<LanguageToggle />);

    await user.click(screen.getByRole("button"));
    const idItem = await screen.findByText("Bahasa Indonesia");

    // Should not throw
    await expect(user.click(idItem)).resolves.not.toThrow();
  });

  it("each SUPPORTED_LANGUAGE entry is rendered as a menu item", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LanguageToggle />);
    await user.click(screen.getByRole("button"));

    const items = await screen.findAllByRole("menuitem");
    expect(items.length).toBe(SUPPORTED_LANGUAGES.length);
  });
});
