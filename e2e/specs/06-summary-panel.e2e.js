import { T, FIX, tid, cell, prepareApp, openFixture } from "../helpers/app.js";

describe("summary-panel", () => {
  before(async () => {
    await prepareApp();
  });

  it("opens summary panel via Ctrl+Shift+Y after selecting a numeric range", async () => {
    await openFixture(FIX.csv);

    // Select starting cell (row 1, col 1 — first data row, Age column assuming Name,Age,City header).
    const startCell = cell(1, 1);
    await startCell.waitForDisplayed({ timeout: 10000 });
    await startCell.click();

    // Extend selection downward using Shift+ArrowDown twice to reach row 3, col 1.
    await browser.keys(["Shift", "ArrowDown"]);
    await browser.keys(["Shift", "ArrowDown"]);

    // Open summary panel with Ctrl+Shift+Y.
    await browser.keys(["Control", "Shift", "Y"]);

    // Summary panel must be visible.
    await tid(T.summaryPanel).waitForDisplayed({ timeout: 10000 });
  });

  it("summary table has at least one data row", async () => {
    await openFixture(FIX.csv);

    const startCell = cell(1, 1);
    await startCell.waitForDisplayed({ timeout: 10000 });
    await startCell.click();

    await browser.keys(["Shift", "ArrowDown"]);
    await browser.keys(["Shift", "ArrowDown"]);

    await browser.keys(["Control", "Shift", "Y"]);

    await tid(T.summaryPanel).waitForDisplayed({ timeout: 10000 });

    // The summary table should have at least one row (e.g. Count, Sum, etc.).
    const summaryTable = tid(T.summaryTable);
    await summaryTable.waitForDisplayed({ timeout: 5000 });

    // Check for at least one <tr> inside the table.
    const rows = await summaryTable.$$("tr");
    const rowCount = rows.length;
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  it("summary copy button exists and is enabled", async () => {
    await openFixture(FIX.csv);

    const startCell = cell(1, 1);
    await startCell.waitForDisplayed({ timeout: 10000 });
    await startCell.click();

    await browser.keys(["Shift", "ArrowDown"]);
    await browser.keys(["Shift", "ArrowDown"]);

    await browser.keys(["Control", "Shift", "Y"]);

    await tid(T.summaryPanel).waitForDisplayed({ timeout: 10000 });

    const copyBtn = tid(T.summaryCopyBtn);
    await copyBtn.waitForDisplayed({ timeout: 5000 });

    // The button should not be disabled.
    const isEnabled = await copyBtn.isEnabled();
    expect(isEnabled).toBe(true);
  });

  it("Esc closes the summary panel", async () => {
    await openFixture(FIX.csv);

    const startCell = cell(1, 1);
    await startCell.waitForDisplayed({ timeout: 10000 });
    await startCell.click();

    await browser.keys(["Shift", "ArrowDown"]);
    await browser.keys(["Shift", "ArrowDown"]);

    await browser.keys(["Control", "Shift", "Y"]);

    await tid(T.summaryPanel).waitForDisplayed({ timeout: 10000 });

    await browser.keys(["Escape"]);

    await tid(T.summaryPanel).waitForDisplayed({ timeout: 5000, reverse: true });
  });
});
