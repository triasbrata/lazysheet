import {
  T,
  FIX,
  tid,
  prepareApp,
  openFixture,
  selectCell,
  extendSelection,
} from "../helpers/app.js";

describe("selection-stats", () => {
  before(async () => {
    await prepareApp();
  });

  it("aggregate stats for numeric range", async () => {
    await openFixture(FIX.csv);
    // Age column (col 1): row1=36, row2=55, row3=85
    // selectCell(1,1) anchors at Age=36; extendSelection(2,0) adds rows down → 36,55,85
    await selectCell(1, 1);
    await extendSelection(2, 0);

    const statsEl = tid(T.statusbarStats);
    await browser.waitUntil(
      async () => {
        try {
          return await statsEl.isDisplayed();
        } catch {
          return false;
        }
      },
      { timeout: 5000, timeoutMsg: "statusbar-stats did not appear after selecting numeric range" },
    );

    const text = await statsEl.getText();
    expect(text).toContain("SUM: 176");
    expect(text).toContain("COUNT: 3");
    expect(text).toContain("MIN: 36");
    expect(text).toContain("MAX: 85");
    expect(text).toContain("AVG: 58.6667");
  });

  it("no stats for single cell", async () => {
    await openFixture(FIX.csv);
    await selectCell(1, 1);

    await browser.pause(300);

    const statsEl = tid(T.statusbarStats);
    expect(await statsEl.isExisting()).toBe(false);
  });

  it("no stats for non-numeric range", async () => {
    await openFixture(FIX.csv);
    // City column (col 2): London, Helsinki, NewYork — all strings
    await selectCell(1, 2);
    await extendSelection(2, 0);

    await browser.pause(300);

    const statsEl = tid(T.statusbarStats);
    expect(await statsEl.isExisting()).toBe(false);
  });
});
