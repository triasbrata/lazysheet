/**
 * Spec 08 — Markdown export
 *
 * Opens a CSV fixture, selects a range, opens the context menu on a selected
 * cell, navigates Copy → Markdown → Table, then asserts the clipboard contains
 * a Markdown table (pipe characters and a separator row of dashes).
 *
 * NOTE: The Copy→Markdown→Table path uses Radix nested menus ([role="menuitem"]).
 * If the submenu navigation proves flaky in CI the test documents the fallback
 * path (command palette) but keeps the context-menu path as primary.
 */

import { T, FIX, tid, cell, prepareApp, openFixture, readClipboard } from "../helpers/app.js";

describe("markdown-export", () => {
  before(async () => {
    await prepareApp();
  });

  it("copies a selected range as a Markdown table via context menu", async () => {
    // Open the CSV fixture so the grid is visible.
    await openFixture(FIX.csv);

    // Click cell (0,0) to start selection.
    const startCell = cell(0, 0);
    await startCell.waitForDisplayed({ timeout: 10000 });
    await startCell.click();

    // Extend the selection to (2,2) using Shift+click.
    const endCell = cell(2, 2);
    await endCell.waitForDisplayed({ timeout: 10000 });
    await endCell.click({ shiftKey: true });

    // Right-click on a selected cell to open the context menu.
    await startCell.click({ button: "right" });

    // Wait for the context menu to appear.
    const ctxMenu = tid(T.contextMenu);
    await ctxMenu.waitForDisplayed({ timeout: 8000 });

    // Navigate to the "Copy" menu item.
    const copyItem = await ctxMenu.$('[role="menuitem"]=Copy');
    await copyItem.waitForDisplayed({ timeout: 5000 });
    await copyItem.moveTo();

    // Wait for the Copy submenu to open and click "Markdown".
    const markdownItem = await browser.$('[role="menuitem"]=Markdown');
    await markdownItem.waitForDisplayed({ timeout: 5000 });
    await markdownItem.moveTo();

    // Wait for the Markdown submenu and click "Table".
    const tableItem = await browser.$('[role="menuitem"]=Table');
    await tableItem.waitForDisplayed({ timeout: 5000 });
    await tableItem.click();

    // Wait briefly for the clipboard write to complete.
    await browser.pause(300);

    // Assert the clipboard contains a Markdown table.
    const clipboardText = await readClipboard();
    expect(clipboardText).toContain("|");
    // A Markdown table separator row contains dashes: "| --- |" or similar.
    expect(clipboardText).toMatch(/\|-+/);
  });
});
