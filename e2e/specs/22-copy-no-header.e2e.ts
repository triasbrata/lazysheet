/**
 * Spec 22 — Copy with no header row set
 *
 * When no header has been marked, column letters (A, B, C …) should be used as
 * fallback headers in copied output, and the app should warn the user via a toast.
 */

import {
  T,
  FIX,
  tid,
  prepareApp,
  openFixture,
  installClipboardCapture,
  readCopied,
  selectCell,
  extendSelection,
  openContextMenuAt,
  synthClickItem,
} from "../helpers/app.js";

describe("copy-no-header", () => {
  before(async () => {
    await prepareApp();
  });

  it("copies with column letters and warns when no header set", async () => {
    await openFixture(FIX.csv);
    await installClipboardCapture();

    // Intentionally do NOT call markHeader — no header row is set.
    await selectCell(0, 0);
    await extendSelection(2, 2);

    // Navigate: Copy → Markdown → Table
    await openContextMenuAt('[data-r="0"][data-c="0"]');
    await browser.pause(200);
    await tid(T.contextMenu).waitForDisplayed({ timeout: 8000 });
    await tid("ctx-copy").click();
    await browser.pause(200);
    await tid("ctx-copy-markdown").click();
    await browser.pause(200);
    await synthClickItem("ctx-copy-table");
    await browser.pause(300);

    const c = await readCopied();
    // Column letters should be used as fallback headers.
    expect(c.includes("| A |")).toBe(true);
    expect(c.includes("| B |")).toBe(true);
    expect(c.includes("| C |")).toBe(true);

    // A warning toast should inform the user that no header row was set.
    const toast = $('[data-sonner-toast]');
    await toast.waitForDisplayed({ timeout: 5000 });
    expect((await toast.getText()).toLowerCase()).toContain("header");
  });
});
