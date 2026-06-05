import {
  T,
  FIX,
  tid,
  prepareApp,
  openFixture,
  openContextMenuAt,
  synthClickItem,
} from "../helpers/app.js";

// Column filter funnels only render on a marked header row.
async function markHeaderRow() {
  const rh = $('[data-row-header="0"]');
  await rh.waitForDisplayed({ timeout: 10000 });
  await rh.click();
  await openContextMenuAt('[data-row-header="0"]');
  await tid(T.contextMenu).waitForDisplayed({ timeout: 5000 });
  await synthClickItem("ctx-mark-header");
}

async function openFirstColumnFilter() {
  await markHeaderRow();
  const funnel = $('[aria-label="Filter column"]');
  await funnel.waitForDisplayed({ timeout: 10000 });
  await funnel.click();
  await tid(T.filterPanel).waitForDisplayed({ timeout: 10000 });
}

describe("column-filter", () => {
  // Reset per test: prepareApp() clears lazysheet:file-state (persisted header
  // marks/filters) and reloads. Without this, test 1's marked header leaks into
  // test 2 — markHeaderRow() then toggles it OFF and the filter funnel vanishes.
  beforeEach(async () => {
    await prepareApp();
  });

  it("opens filter panel on column header trigger", async () => {
    await openFixture(FIX.csv);
    await openFirstColumnFilter();
  });

  it("filters rows by an equals condition and hides non-matching rows", async () => {
    await openFixture(FIX.csv);
    await openFirstColumnFilter();

    await tid("filter-condition-trigger").click();
    await tid("filter-condition-isExactly").waitForDisplayed({ timeout: 5000 });
    await tid("filter-condition-isExactly").click();

    const operandInput = tid(T.filterOperandInput);
    await operandInput.waitForDisplayed({ timeout: 5000 });
    await operandInput.click();
    await operandInput.clearValue();
    await operandInput.setValue("Ada");

    const okBtn = tid(T.filterOkBtn);
    await okBtn.waitForDisplayed({ timeout: 5000 });
    await okBtn.click();
    await tid(T.filterPanel).waitForDisplayed({ timeout: 5000, reverse: true });

    await browser.waitUntil(
      async () => {
        const cells = await $$("[data-r][data-c]");
        for (const c of cells) {
          let text = "";
          try {
            text = await c.getText();
          } catch {
            continue;
          }
          if (text === "Linus") return false;
        }
        return true;
      },
      {
        timeout: 10000,
        timeoutMsg: 'Expected "Linus" to be hidden after filtering for "Ada"',
      },
    );
  });

  it("cancel button closes filter panel without applying", async () => {
    await openFixture(FIX.csv);
    await openFirstColumnFilter();

    const cancelBtn = tid(T.filterCancelBtn);
    await cancelBtn.waitForDisplayed({ timeout: 5000 });
    await cancelBtn.click();
    await tid(T.filterPanel).waitForDisplayed({ timeout: 5000, reverse: true });
  });
});
