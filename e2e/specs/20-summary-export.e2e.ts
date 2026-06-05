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

  it("copy as image selects the image format and persists it", async () => {
    await openFixture(FIX.csv);
    await installClipboardCapture();
    await openSummary(0, 0, 3, 1);

    // Select the image format via caret menu.
    await synthPointerOpen(`[data-testid="${T.summaryCopyCaret}"]`);
    await browser.pause(300);
    await tid(T.summaryCopyOptImg).click();
    await browser.pause(300);

    // Format selection is persisted to localStorage.
    const stored = await browser.execute(() =>
      localStorage.getItem("summary-panel:copy-format"),
    );
    expect(stored).toBe("image");

    // The copy button should be enabled (not stuck disabled/loading).
    expect(await tid(T.summaryCopyBtn).isEnabled()).toBe(true);
  });

  it("renders the summary table to a real non-blank PNG", async () => {
    await openFixture(FIX.csv);
    await installClipboardCapture();
    await openSummary(0, 0, 3, 1);

    // Allow the in-browser render (two html-to-image passes + decode) ample
    // time; the hook itself caps at 20s and always settles.
    await browser.setTimeout({ script: 30000 });

    // Run the REAL copy-as-image pipeline, capturing the PNG blob instead of
    // writing the clipboard (WebKit's WebDriver rejects clipboard.write). The
    // hook decodes the PNG so we can assert it's a valid, sized, non-blank image
    // — i.e. the WebKit first-render-blank workaround actually produced pixels.
    const res = await browser.executeAsync(
      (done: (v: unknown) => void) => {
        window.__E2E__!.captureSummaryImage().then(done).catch((e: unknown) =>
          done({ ok: false, error: String(e) }),
        );
      },
    );

    expect(res).toBeTruthy();
    const r = res as {
      ok: boolean;
      bytes?: number;
      width?: number;
      height?: number;
      nonBlank?: boolean;
      error?: string;
    };
    expect(r.ok).toBe(true);
    expect(r.bytes ?? 0).toBeGreaterThan(0);
    expect(r.width ?? 0).toBeGreaterThan(0);
    expect(r.height ?? 0).toBeGreaterThan(0);
    expect(r.nonBlank).toBe(true);
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
