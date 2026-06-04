import { T, FIX, tid, cell, prepareApp, openFixture } from "../helpers/app.js";

// multi.xlsx has two sheets: "People" and "Nums"
//   People sheet: row 0 = merged title "People Directory", row 1 = ["Name","Age","City"]
//   Nums sheet:   row 0 = ["N", "Square"], rows 1-3 = data

describe("sheet-tabs", () => {
  before(async () => {
    await prepareApp();
    await openFixture(FIX.xlsx);
  });

  it("renders exactly 2 sheet tabs for multi.xlsx", async () => {
    // Wait for the sheet tabs container to appear
    const tabsContainer = tid(T.sheetTabs);
    await tabsContainer.waitForDisplayed({ timeout: 10000 });

    const tabs = await $$(`[data-testid="${T.sheetTab}"]`);
    expect(tabs.length).toBe(2);
  });

  it("clicking the Nums tab switches the sheet and cell(0,0) has header 'N'", async () => {
    // Click the Nums tab by data-sheet-name attribute
    const numsTab = $('[data-sheet-name="Nums"]');
    await numsTab.waitForDisplayed({ timeout: 10000 });
    await numsTab.click();

    // Wait for grid to update — cell(0,0) on Nums sheet = "N"
    const firstCell = cell(0, 0);
    await browser.waitUntil(
      async () => {
        try {
          await firstCell.waitForDisplayed({ timeout: 3000 });
          const text = await firstCell.getText();
          return text === "N";
        } catch {
          return false;
        }
      },
      { timeout: 15000, timeoutMsg: "Nums sheet cell(0,0) did not show 'N' after tab click" }
    );

    expect(await firstCell.getText()).toBe("N");
  });

  it("switching back to People tab restores People sheet content", async () => {
    const peopleTab = $('[data-sheet-name="People"]');
    await peopleTab.waitForDisplayed({ timeout: 10000 });
    await peopleTab.click();

    // row 0 on People sheet = merged title "People Directory"
    const titleCell = cell(0, 0);
    await browser.waitUntil(
      async () => {
        try {
          await titleCell.waitForDisplayed({ timeout: 3000 });
          const text = await titleCell.getText();
          return text.length > 0;
        } catch {
          return false;
        }
      },
      { timeout: 15000, timeoutMsg: "People sheet cell(0,0) did not appear after switching back" }
    );

    const text = await titleCell.getText();
    expect(text).toContain("People");
  });
});
