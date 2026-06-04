import { T, FIX, tid, prepareApp, openFixture } from "../helpers/app.js";

// simple.csv content:
//   Name,Age,City
//   Ada,36,London
//   Linus,55,Helsinki
//   Grace,85,NewYork
// "Ada" appears once (row 1, col 0).

describe("find", () => {
  before(async () => {
    await prepareApp();
    await openFixture(FIX.csv);
  });

  it("Ctrl+F opens the find bar ([role=search] becomes visible)", async () => {
    // Ensure the grid is focused first by clicking the scroll container
    const grid = tid(T.gridScrollContainer);
    await grid.waitForDisplayed({ timeout: 10000 });
    await grid.click();

    // Open find bar with Ctrl+F
    await browser.keys(["Control", "f"]);

    const searchBar = $('[role="search"]');
    await searchBar.waitForDisplayed({ timeout: 10000 });
    expect(await searchBar.isDisplayed()).toBe(true);
  });

  it("typing 'Ada' in the find input shows a match count >= 1", async () => {
    const findInput = $('[aria-label="Find in sheet"]');
    await findInput.waitForDisplayed({ timeout: 10000 });

    await findInput.clearValue();
    await findInput.setValue("Ada");

    // Wait for find-match-count to update
    const matchCount = tid(T.findMatchCount);
    await matchCount.waitForDisplayed({ timeout: 10000 });

    await browser.waitUntil(
      async () => {
        const text = await matchCount.getText();
        // Match count text can be e.g. "1 / 1", "1 of 1", "1", etc.
        return text.length > 0 && text !== "0";
      },
      { timeout: 10000, timeoutMsg: "find-match-count did not show a result for 'Ada'" }
    );

    const countText = await matchCount.getText();
    // Extract any number from the string — should be at least 1
    const numbers = countText.match(/\d+/g);
    expect(numbers).not.toBeNull();
    expect(parseInt(numbers![0], 10)).toBeGreaterThanOrEqual(1);
  });

  it("pressing Enter advances to the next match without closing the find bar", async () => {
    const searchBar = $('[role="search"]');
    expect(await searchBar.isDisplayed()).toBe(true);

    await browser.keys(["Enter"]);

    // Find bar should still be open
    await searchBar.waitForDisplayed({ timeout: 5000 });
    expect(await searchBar.isDisplayed()).toBe(true);
  });

  it("pressing Escape closes the find bar ([role=search] disappears)", async () => {
    await browser.keys(["Escape"]);

    const searchBar = $('[role="search"]');
    await browser.waitUntil(
      async () => {
        try {
          return !(await searchBar.isDisplayed());
        } catch {
          // Element gone from DOM counts as not displayed
          return true;
        }
      },
      { timeout: 10000, timeoutMsg: '[role="search"] is still visible after Escape' }
    );

    expect(await searchBar.isDisplayed()).toBe(false);
  });
});
