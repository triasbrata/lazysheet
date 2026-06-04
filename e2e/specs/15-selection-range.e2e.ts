import {
  T,
  FIX,
  tid,
  prepareApp,
  openFixture,
  selectCell,
  extendSelection,
  focusGrid,
  gridKey,
} from "../helpers/app.js";

describe("selection-range", () => {
  before(async () => {
    await prepareApp();
  });

  it("single cell shows A1 reference", async () => {
    await openFixture(FIX.csv);
    await selectCell(0, 0);

    const statusRef = tid(T.statusbarCellRef);
    await browser.waitUntil(
      async () => (await statusRef.getText()) === "A1",
      { timeout: 5000, timeoutMsg: "statusbar-cell-ref did not show A1 after selecting cell (0,0)" },
    );

    expect(await statusRef.getText()).toBe("A1");
  });

  it("range shows A1:C3 reference", async () => {
    await openFixture(FIX.csv);
    await selectCell(0, 0);
    await extendSelection(2, 2);

    const statusRef = tid(T.statusbarCellRef);
    await browser.waitUntil(
      async () => (await statusRef.getText()) === "A1:C3",
      { timeout: 5000, timeoutMsg: "statusbar-cell-ref did not show A1:C3 after extending selection to (2,2)" },
    );

    expect(await statusRef.getText()).toBe("A1:C3");
  });

  it("selecting a column tints its header", async () => {
    await openFixture(FIX.csv);
    // Select col 1 (B) rows 0-2 — anchor at (0,1) then extend 2 rows down
    await selectCell(0, 1);
    await extendSelection(2, 0);

    await browser.pause(300);

    const colHeader = $('[data-col-header="1"]');
    await colHeader.waitForDisplayed({ timeout: 5000 });

    const className = await colHeader.getAttribute("class");
    expect(className).toContain("bg-primary");
  });

  it("Ctrl+A selects all", async () => {
    await openFixture(FIX.csv);
    await focusGrid();
    await gridKey("a", { ctrl: true });

    const statusRef = tid(T.statusbarCellRef);
    await browser.waitUntil(
      async () => /^A1:/.test(await statusRef.getText()),
      { timeout: 5000, timeoutMsg: "statusbar-cell-ref did not show A1:... after Ctrl+A" },
    );

    expect(await statusRef.getText()).toMatch(/^A1:/);
  });
});
