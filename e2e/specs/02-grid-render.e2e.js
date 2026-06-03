import { T, FIX, tid, cell, prepareApp, openFixture } from "../helpers/app.js";

// multi.xlsx "People" sheet layout (from generate.ts):
//   row 0: ["People Directory", null, null]  — merged A1:C1 (title)
//   row 1: ["Name", "Age", "City"]           — column headers
//   row 2: ["Ada", 36, "London"]
//   row 3: ["Linus", 55, "Helsinki"]
//   row 4: ["Grace", 85, "NewYork"]
//   row 5: [null, null, null]                — B6 = SUM(B3:B5) formula

describe("grid-render", () => {
  before(async () => {
    await prepareApp();
    await openFixture(FIX.xlsx);
  });

  it("column header 0 exists in DOM", async () => {
    const colHeader = $('[data-col-header="0"]');
    await colHeader.waitForExist({ timeout: 10000 });
    expect(await colHeader.isExisting()).toBe(true);
  });

  it("renders known cell values from the People sheet", async () => {
    // row 1 = column headers: "Name", "Age", "City"
    const nameHeader = cell(1, 0);
    await nameHeader.waitForDisplayed({ timeout: 10000 });
    expect(await nameHeader.getText()).toBe("Name");

    const ageHeader = cell(1, 1);
    await ageHeader.waitForDisplayed({ timeout: 5000 });
    expect(await ageHeader.getText()).toBe("Age");

    // row 2: Ada, 36, London
    const adaName = cell(2, 0);
    await adaName.waitForDisplayed({ timeout: 5000 });
    expect(await adaName.getText()).toBe("Ada");

    const adaAge = cell(2, 1);
    await adaAge.waitForDisplayed({ timeout: 5000 });
    // Age is a number; getText returns the rendered string
    expect(await adaAge.getText()).toBe("36");
  });

  it("scrolls grid-scroll-container and higher data-index rows become present", async () => {
    const scrollContainer = tid(T.gridScrollContainer);
    await scrollContainer.waitForDisplayed({ timeout: 10000 });

    // Scroll down to expose more rows — pass the wdio element directly;
    // wdio serialises it as a WebElement reference for browser.execute.
    await browser.execute((el) => {
      el.scrollTop = el.scrollHeight;
    }, scrollContainer);

    // After scroll, wait a moment for virtualisation to catch up
    await browser.waitUntil(
      async () => {
        const rows = await $$("[data-r]");
        return rows.length > 0;
      },
      { timeout: 10000, timeoutMsg: "No [data-r] rows found after scroll" }
    );

    // Assert at least one row with a data-r value >= 2 is present (rows 2-4 are data rows)
    const higherRow = $('[data-r="4"]');
    await higherRow.waitForExist({ timeout: 10000 });
    expect(await higherRow.isExisting()).toBe(true);
  });

  it("merged title cell (row 0, col 0) is present in DOM", async () => {
    // The merged title "People Directory" occupies row 0, cols 0-2.
    // It should render as cell(0,0).
    const titleCell = cell(0, 0);
    await titleCell.waitForExist({ timeout: 10000 });
    expect(await titleCell.isExisting()).toBe(true);

    const titleText = await titleCell.getText();
    expect(titleText).toContain("People Directory");
  });
});
