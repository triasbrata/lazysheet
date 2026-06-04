/**
 * Spec 08 — Markdown export
 *
 * Opens a CSV fixture, selects a range, opens the context menu on a selected
 * cell, navigates Copy → Markdown → Table, then asserts the clipboard contains
 * a Markdown table (pipe characters and a separator row of dashes).
 */

import { T, FIX, tid, prepareApp, openFixture, installClipboardCapture, readCopied, openContextMenuAt, selectCell, extendSelection, synthClickItem } from "../helpers/app.js";

describe("markdown-export", () => {
  before(async () => {
    await prepareApp();
  });

  it("copies a selected range as a Markdown table via context menu", async () => {
    await openFixture(FIX.csv);
    await installClipboardCapture();

    // Build a 2×2 selection (A1:B2) via synthetic keys.
    await selectCell(0, 0);
    await extendSelection(1, 1);

    // Open the context menu on a selected cell via synthetic contextmenu dispatch.
    await openContextMenuAt('[data-r="0"][data-c="0"]');
    await browser.pause(200);
    await tid(T.contextMenu).waitForDisplayed({ timeout: 8000 });

    // Radix subtriggers expand on a normal click; the leaf's onSelect needs a
    // synthetic-pointer click to fire on WebKit.
    await tid("ctx-copy").click();
    await browser.pause(200);
    await tid("ctx-copy-markdown").click();
    await browser.pause(200);
    await synthClickItem("ctx-copy-table");
    await browser.pause(300);

    const clipboardText = await readCopied();
    expect(clipboardText).toContain("|");
    // Markdown table separator row: "| --- | --- |" (pipes + dashes, spaces ok).
    expect(clipboardText).toMatch(/\|\s*-+/);
  });
});
