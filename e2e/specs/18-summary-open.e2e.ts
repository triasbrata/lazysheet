/**
 * Spec 18 — Summary panel open / close paths
 *
 * Verifies all four ways to open the summary panel (Ctrl+Shift+Y, statusbar
 * Analyze button, context-menu Summarize, command palette) and both ways to
 * close it (Escape key, X button). Uses the simple.csv fixture (Name/Age/City).
 *
 * Eligible selection: >=2 rows AND >=2 cols.
 * We select A1:B4 (Name+Age, 4 rows × 2 cols) before each open attempt.
 */

import {
  T,
  FIX,
  tid,
  prepareApp,
  openFixture,
  selectCell,
  extendSelection,
  gridKey,
  dispatchKeyOn,
  openContextMenuAt,
  synthPointerClick,
  synthClickItem,
} from "../helpers/app.js";

/** Selects A1:B4 (Name+Age, 4 rows × 2 cols) — eligible for the summary panel. */
async function selectRange(): Promise<void> {
  await selectCell(0, 0);        // anchor at A1
  await extendSelection(3, 1);   // +1 col right, +3 rows down → A1:B4
}

describe("summary-open", () => {
  beforeEach(async () => {
    // Reload the app before each test so the summary panel is always closed.
    // openFixture alone does NOT reload (Radix panel state leaks across `it`s),
    // so we use prepareApp (which reloads) + openFixture for a clean slate.
    await prepareApp();
    await openFixture(FIX.csv);
  });

  it("opens via Ctrl+Shift+Y and toggles closed with the same shortcut", async () => {
    await selectRange();

    // Open
    await gridKey("y", { ctrl: true, shift: true });
    await tid(T.summaryPanel).waitForDisplayed({ timeout: 10000 });

    // Toggle closed
    await gridKey("y", { ctrl: true, shift: true });
    await tid(T.summaryPanel).waitForDisplayed({ timeout: 5000, reverse: true });
  });

  it("opens via statusbar Analyze button", async () => {
    await selectRange();

    await synthPointerClick(`[data-testid="${T.statusbarAnalyze}"]`);
    await tid(T.summaryPanel).waitForDisplayed({ timeout: 10000 });
  });

  it("opens via context menu Summarize", async () => {
    await selectRange();

    await openContextMenuAt(`[data-r="0"][data-c="0"]`);
    await tid(T.contextMenu).waitForDisplayed({ timeout: 8000 });
    await synthClickItem(T.ctxSummarize);
    await tid(T.summaryPanel).waitForDisplayed({ timeout: 10000 });
  });

  it("opens via command palette", async () => {
    await selectRange();

    // Open command palette with Ctrl+K
    await browser.keys(["Control", "k"]);
    await tid(T.commandPaletteInput).waitForDisplayed({ timeout: 8000 });

    // Type "summar" to filter to the Summarize command
    await tid(T.commandPaletteInput).click();
    await browser.keys(["s", "u", "m", "m", "a", "r"]);
    await browser.pause(300);

    // Wait for at least one matching item and click the first one containing "ummar"
    await browser.waitUntil(
      async () => {
        const items = await $$(`[data-testid="${T.commandPaletteItem}"]`);
        for (const item of items) {
          const text = await item.getText().catch(() => "");
          if (text.toLowerCase().includes("ummar")) return true;
        }
        return false;
      },
      { timeout: 5000, timeoutMsg: "No command-palette-item with text 'ummar' found after typing" },
    );

    // Click the first item whose text includes "ummar" / "Summarize"
    const items = await $$(`[data-testid="${T.commandPaletteItem}"]`);
    for (const item of items) {
      const text = await item.getText().catch(() => "");
      if (text.toLowerCase().includes("ummar")) {
        await item.click();
        break;
      }
    }

    await tid(T.summaryPanel).waitForDisplayed({ timeout: 10000 });
  });

  it("closes via Escape key dispatched on the panel", async () => {
    await selectRange();

    await gridKey("y", { ctrl: true, shift: true });
    await tid(T.summaryPanel).waitForDisplayed({ timeout: 10000 });

    await dispatchKeyOn(`[data-testid="${T.summaryPanel}"]`, "Escape");
    await tid(T.summaryPanel).waitForDisplayed({ timeout: 5000, reverse: true });
  });

  it("closes via the X (close) button", async () => {
    await selectRange();

    await gridKey("y", { ctrl: true, shift: true });
    await tid(T.summaryPanel).waitForDisplayed({ timeout: 10000 });

    await synthPointerClick(`[data-testid="${T.summaryClose}"]`);
    await tid(T.summaryPanel).waitForDisplayed({ timeout: 5000, reverse: true });
  });
});
