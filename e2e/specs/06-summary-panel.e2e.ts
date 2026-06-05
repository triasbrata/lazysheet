import { T, FIX, tid, prepareApp, openFixture, selectCell, extendSelection, gridKey, dispatchKeyOn } from "../helpers/app.js";

// Builds a 2-col × 3-row selection anchored at B2 and opens the summary panel.
async function selectRangeAndOpenSummary() {
  // Ctrl+Shift+Y toggles — close any panel a previous test left open (toggle it
  // off), else this call would close instead of open.
  if (await tid(T.summaryPanel).isDisplayed().catch(() => false)) {
    await gridKey("y", { ctrl: true, shift: true });
    await tid(T.summaryPanel).waitForDisplayed({ timeout: 3000, reverse: true });
  }
  // Select Name+Age (A1:B4): ≥2 cols × ≥2 rows, and the numeric Age becomes the
  // value field so the group-by table actually renders rows.
  await selectCell(0, 0); // A1
  await extendSelection(3, 1); // +1 col, +3 rows → A1:B4
  await gridKey("y", { ctrl: true, shift: true }); // open summary panel
  await tid(T.summaryPanel).waitForDisplayed({ timeout: 10000 });
}

describe("summary-panel", () => {
  before(async () => {
    await prepareApp();
  });

  it("opens summary panel via Ctrl+Shift+Y after selecting a numeric range", async () => {
    await openFixture(FIX.csv);
    await selectRangeAndOpenSummary();
  });

  it("summary table has at least one data row", async () => {
    await openFixture(FIX.csv);
    await selectRangeAndOpenSummary();

    const summaryTable = tid(T.summaryTable);
    await summaryTable.waitForDisplayed({ timeout: 5000 });
    const rows = await summaryTable.$$("tr");
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("summary copy button exists and is enabled", async () => {
    await openFixture(FIX.csv);
    await selectRangeAndOpenSummary();

    const copyBtn = tid(T.summaryCopyBtn);
    await copyBtn.waitForDisplayed({ timeout: 5000 });
    expect(await copyBtn.isEnabled()).toBe(true);
  });

  it("Esc closes the summary panel", async () => {
    await openFixture(FIX.csv);
    await selectRangeAndOpenSummary();

    // The panel closes via its own onKeyDown(Escape); deliver Escape directly to
    // the panel element (browser.keys can't deliver Escape on this driver).
    await dispatchKeyOn('[data-testid="summary-panel"]', "Escape");
    await tid(T.summaryPanel).waitForDisplayed({ timeout: 5000, reverse: true });
  });
});
