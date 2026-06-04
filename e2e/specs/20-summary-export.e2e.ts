/**
 * Spec 20 — Summary panel export
 *
 * Opens a CSV fixture, opens the summary panel over Name+Age columns,
 * and exercises all copy-format options: Markdown (default), TSV (via caret
 * menu), image (smoke), and localStorage persistence.
 */

import {
  T,
  FIX,
  tid,
  prepareApp,
  openFixture,
  installClipboardCapture,
  readCopied,
  openSummary,
  synthPointerOpen,
} from "../helpers/app.js";

describe("summary-export", () => {
  before(async () => {
    await prepareApp();
  });

  it("copy as Markdown", async () => {
    await openFixture(FIX.csv);
    await installClipboardCapture();
    // A1:B4 — Name (category) + Age (value SUM)
    await openSummary(0, 0, 3, 1);

    // Default format is Markdown — click the main copy button directly.
    await tid(T.summaryCopyBtn).click();
    await browser.pause(300);

    const c = await readCopied();
    expect(c).toContain("|");
    expect(c).toContain("Name");
    expect(c).toContain("SUM(Age)");
    expect(c).toMatch(/\|\s*-+/);
  });

  it("copy as TSV via caret menu", async () => {
    await openFixture(FIX.csv);
    await installClipboardCapture();
    await openSummary(0, 0, 3, 1);

    // Open the caret dropdown and choose TSV.
    await synthPointerOpen(`[data-testid="${T.summaryCopyCaret}"]`);
    await browser.pause(200);
    await tid(T.summaryCopyOptTsv).click();
    await browser.pause(300);

    const c = await readCopied();
    expect(c).toContain("\t");
    expect(c).toContain("Name");
    expect(c).toContain("SUM(Age)");
  });

  it("copy as image fires (smoke)", async () => {
    await openFixture(FIX.csv);
    await installClipboardCapture();
    await openSummary(0, 0, 3, 1);

    // Select the image format via caret menu.
    await synthPointerOpen(`[data-testid="${T.summaryCopyCaret}"]`);
    await browser.pause(300);
    await tid(T.summaryCopyOptImg).click();
    await browser.pause(300);

    // Verify the format selection was persisted to localStorage.
    // navigator.clipboard.write(ClipboardItem) fails under WebKit webdriver
    // (no permission), so the success toast never appears — don't assert it.
    const stored = await browser.execute(() =>
      localStorage.getItem("summary-panel:copy-format"),
    );
    expect(stored).toBe("image");

    // The copy button should be enabled (not stuck in a disabled/loading state).
    expect(await tid(T.summaryCopyBtn).isEnabled()).toBe(true);

    // Optionally fire the copy — don't assert its result (clipboard.write may fail).
    try {
      await tid(T.summaryCopyBtn).click();
      await browser.pause(300);
    } catch {
      // Ignore — clipboard.write permission failure is expected under WebKit driver.
    }
  });

  it("copy format persists to localStorage", async () => {
    await openFixture(FIX.csv);
    await installClipboardCapture();
    await openSummary(0, 0, 3, 1);

    // Switch to TSV via caret menu.
    await synthPointerOpen(`[data-testid="${T.summaryCopyCaret}"]`);
    await browser.pause(200);
    await tid(T.summaryCopyOptTsv).click();
    await browser.pause(300);

    const stored = await browser.execute(() =>
      localStorage.getItem("summary-panel:copy-format"),
    );
    expect(stored).toBe("tsv");
  });
});
