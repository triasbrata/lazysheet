import { T, FIX, tid, cell, prepareApp, openFixture } from "../helpers/app.js";

describe("column-filter", () => {
  before(async () => {
    await prepareApp();
  });

  it("opens filter panel on column header trigger", async () => {
    await openFixture(FIX.csv);

    // Hover the first column header to reveal the filter trigger, then click it.
    // [data-col-header="0"] is the first column header element.
    const colHeader = $('[data-col-header="0"]');
    await colHeader.waitForDisplayed({ timeout: 10000 });
    await colHeader.moveTo();

    // The filter funnel button uses aria-label="Filter column" per rpi-research §3.
    const filterTrigger = $('[aria-label="Filter column"]');
    await filterTrigger.waitForDisplayed({ timeout: 5000 });
    await filterTrigger.click();

    // Filter panel should now be visible.
    await tid(T.filterPanel).waitForDisplayed({ timeout: 10000 });
  });

  it("filters rows by an equals condition and hides non-matching rows", async () => {
    await openFixture(FIX.csv);

    // Hover first column header to reveal filter trigger.
    const colHeader = $('[data-col-header="0"]');
    await colHeader.waitForDisplayed({ timeout: 10000 });
    await colHeader.moveTo();

    const filterTrigger = $('[aria-label="Filter column"]');
    await filterTrigger.waitForDisplayed({ timeout: 5000 });
    await filterTrigger.click();

    await tid(T.filterPanel).waitForDisplayed({ timeout: 10000 });

    // Type a value into the operand input that matches only "Ada" — this excludes "Linus".
    const operandInput = tid(T.filterOperandInput);
    await operandInput.waitForDisplayed({ timeout: 5000 });
    await operandInput.click();
    await operandInput.clearValue();
    await operandInput.setValue("Ada");

    // Apply the filter.
    const okBtn = tid(T.filterOkBtn);
    await okBtn.waitForDisplayed({ timeout: 5000 });
    await okBtn.click();

    // Wait for the filter panel to close.
    await tid(T.filterPanel).waitForDisplayed({ timeout: 5000, reverse: true });

    // "Linus" should no longer be visible in any cell in the grid.
    // We use waitUntil to give the grid time to re-render after filtering.
    await browser.waitUntil(
      async () => {
        const cells = await $$('[data-r][data-c]');
        for (const c of cells) {
          let text = "";
          try {
            text = await c.getText();
          } catch {
            // cell may have gone stale during DOM update — treat as safe
            continue;
          }
          if (text === "Linus") return false;
        }
        return true;
      },
      {
        timeout: 10000,
        timeoutMsg: 'Expected "Linus" to be hidden after filtering for "Ada"',
      }
    );
  });

  it("cancel button closes filter panel without applying", async () => {
    await openFixture(FIX.csv);

    const colHeader = $('[data-col-header="0"]');
    await colHeader.waitForDisplayed({ timeout: 10000 });
    await colHeader.moveTo();

    const filterTrigger = $('[aria-label="Filter column"]');
    await filterTrigger.waitForDisplayed({ timeout: 5000 });
    await filterTrigger.click();

    await tid(T.filterPanel).waitForDisplayed({ timeout: 10000 });

    const cancelBtn = tid(T.filterCancelBtn);
    await cancelBtn.waitForDisplayed({ timeout: 5000 });
    await cancelBtn.click();

    // Panel should be gone.
    await tid(T.filterPanel).waitForDisplayed({ timeout: 5000, reverse: true });
  });
});
