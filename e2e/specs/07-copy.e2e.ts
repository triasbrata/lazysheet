import { FIX, prepareApp, openFixture, installClipboardCapture, readCopied, selectCell, extendSelection, gridKey } from "../helpers/app.js";

describe("copy", () => {
  before(async () => {
    await prepareApp();
  });

  it("Ctrl+C copies a multi-cell range (cells contain tab/newline-separated values)", async () => {
    await openFixture(FIX.csv);
    await installClipboardCapture();

    // Anchor at A1 ("Name" header) and extend to a 3×3 range (A1:C3).
    await selectCell(0, 0);
    await extendSelection(2, 2);

    // Copy with Ctrl+C (synthetic key so the grid onKeyDown reliably fires).
    await gridKey("c", { ctrl: true });
    await browser.pause(300); // let the async clipboard write settle

    const clipboardText = await readCopied();
    expect(clipboardText).toContain("Name");
    const hasDelimiter = clipboardText.includes("\t") || clipboardText.includes("\n");
    expect(hasDelimiter).toBe(true);
  });

  it("Ctrl+Shift+C on a formula cell copies the formula string (starts with =)", async () => {
    // B6 has formula SUM(B3:B5) → data-r=5, data-c=1 (0-based). See fixtures/generate.ts.
    await openFixture(FIX.xlsx);
    await installClipboardCapture();

    // Navigate straight to the formula cell via keyboard.
    await selectCell(5, 1);

    // Copy formula shortcut Ctrl+Shift+C.
    await gridKey("c", { ctrl: true, shift: true });
    await browser.pause(300);

    const formulaText = await readCopied();
    expect(formulaText.startsWith("=")).toBe(true);
  });
});
