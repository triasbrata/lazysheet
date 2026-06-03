/**
 * Spec 10 — Command palette
 *
 * Opens a CSV fixture, triggers the command palette with Ctrl+K, asserts it
 * appears, types a few characters to filter results, asserts at least one item
 * remains visible, then presses Escape and asserts the palette is gone.
 *
 * NOTE: We deliberately avoid executing a command that would open a native OS
 * dialog (e.g., "Open file…") — we only filter and then dismiss with Escape.
 */

import { T, FIX, tid, prepareApp, openFixture } from "../helpers/app.js";

describe("command-palette", () => {
  before(async () => {
    await prepareApp();
  });

  it("opens with Ctrl+K, filters items as the user types, and closes on Escape", async () => {
    // Open the CSV fixture so the grid is visible and can receive focus.
    await openFixture(FIX.csv);

    // Click on any cell to ensure the app window has focus.
    const firstCell = await $('[data-r="0"][data-c="0"]');
    await firstCell.waitForDisplayed({ timeout: 10000 });
    await firstCell.click();

    // Open the command palette with Ctrl+K.
    await browser.keys(["Control", "k"]);

    // Wait for the command palette to appear.
    const palette = tid(T.commandPalette);
    await palette.waitForDisplayed({ timeout: 8000 });

    // Count all items before typing (palette shows all commands initially).
    const allItems = await $$(`[data-testid="${T.commandPaletteItem}"]`);
    const totalCount = allItems.length;
    expect(totalCount).toBeGreaterThanOrEqual(1);

    // Type a search string that should match at least one command.
    // "Copy" is a safe term — it should not open a native dialog.
    const paletteInput = tid(T.commandPaletteInput);
    await paletteInput.waitForDisplayed({ timeout: 5000 });
    await paletteInput.setValue("cop");

    // Wait for the list to update (short debounce expected).
    await browser.pause(300);

    // Assert at least one command-palette-item is visible after filtering.
    await browser.waitUntil(
      async () => {
        const items = await $$(`[data-testid="${T.commandPaletteItem}"]`);
        return items.length >= 1;
      },
      { timeout: 5000, timeoutMsg: "No command-palette-item visible after typing 'cop'" }
    );

    const filteredItems = await $$(`[data-testid="${T.commandPaletteItem}"]`);
    expect(filteredItems.length).toBeGreaterThanOrEqual(1);

    // Press Escape to close the palette.
    await browser.keys(["Escape"]);

    // Assert the command palette is no longer displayed.
    await palette.waitForDisplayed({ timeout: 5000, reverse: true });
  });
});
