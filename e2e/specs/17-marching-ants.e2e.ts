import {
  FIX,
  prepareApp,
  openFixture,
  selectCell,
  extendSelection,
} from "../helpers/app.js";

describe("marching-ants", () => {
  before(async () => {
    await prepareApp();
  });

  it("selection renders marching-ants frame", async () => {
    await openFixture(FIX.csv);
    await selectCell(0, 0);
    await extendSelection(2, 2);

    await browser.waitUntil(
      async () => (await $$(".selection-ants").length) > 0,
      { timeout: 5000, timeoutMsg: "no .selection-ants element found after selecting range A1:C3" },
    );

    const firstAnts = $(".selection-ants");
    expect(await firstAnts.isExisting()).toBe(true);
  });

  it("frame grows when selection extends", async () => {
    await openFixture(FIX.csv);
    // Start with single cell selection
    await selectCell(0, 0);
    await browser.pause(300);

    // Read initial bounding rect width via browser.execute
    const w1 = await browser.execute((): number => {
      const el = document.querySelector(".selection-ants");
      if (!el) return 0;
      return el.getBoundingClientRect().width;
    });

    // Extend to a larger range
    await extendSelection(2, 2);
    await browser.pause(400);

    const w2 = await browser.execute((): number => {
      const el = document.querySelector(".selection-ants");
      if (!el) return 0;
      return el.getBoundingClientRect().width;
    });

    expect(w2).toBeGreaterThan(w1);
  });
});
