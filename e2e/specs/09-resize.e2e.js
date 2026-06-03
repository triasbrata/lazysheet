/**
 * Spec 09 — Column resize dialog
 *
 * Opens a CSV fixture, right-clicks a column header to open the context menu,
 * clicks "Column width…", fills in 200 in the resize dialog, confirms, and
 * asserts that the column header element's rendered width is approximately 200px.
 */

import { T, FIX, tid, prepareApp, openFixture } from "../helpers/app.js";

/** Allowed pixel tolerance when comparing widths. */
const WIDTH_TOLERANCE = 10;

describe("resize", () => {
  before(async () => {
    await prepareApp();
  });

  it("opens Column width dialog and applies the new width to the column header", async () => {
    // Open the CSV fixture.
    await openFixture(FIX.csv);

    // Locate the first column header (column index 0).
    const colHeader = await $('[data-col-header="0"]');
    await colHeader.waitForDisplayed({ timeout: 10000 });

    // Right-click the column header to open the context menu.
    await colHeader.click({ button: "right" });

    // Wait for the context menu.
    const ctxMenu = tid(T.contextMenu);
    await ctxMenu.waitForDisplayed({ timeout: 8000 });

    // Click the "Column width…" menu item.
    const widthItem = await ctxMenu.$('[role="menuitem"]=Column width…');
    await widthItem.waitForDisplayed({ timeout: 5000 });
    await widthItem.click();

    // Wait for the resize dialog to appear.
    const resizeDialog = tid(T.resizeDialog);
    await resizeDialog.waitForDisplayed({ timeout: 8000 });

    // Clear the input and set the new width to 200.
    const resizeInput = tid(T.resizeInput);
    await resizeInput.waitForDisplayed({ timeout: 5000 });
    await resizeInput.clearValue();
    await resizeInput.setValue("200");

    // Click the OK button to apply.
    const okBtn = tid(T.resizeOkBtn);
    await okBtn.waitForDisplayed({ timeout: 5000 });
    await okBtn.click();

    // Wait for the dialog to close.
    await resizeDialog.waitForDisplayed({ timeout: 5000, reverse: true });

    // Assert the column header's rendered width is approximately 200px.
    // Re-query the header after the resize has been applied.
    const updatedColHeader = await $('[data-col-header="0"]');
    await updatedColHeader.waitForDisplayed({ timeout: 5000 });

    // Try CSS property first; fall back to bounding rect.
    let actualWidth;
    try {
      const widthProp = await updatedColHeader.getCSSProperty("width");
      // getCSSProperty returns an object like { value: "200px", parsed: { value: 200 } }
      actualWidth =
        widthProp?.parsed?.value ??
        parseInt(String(widthProp?.value ?? "0"), 10);
    } catch (_) {
      // Fallback: use element bounding box.
      const box = await updatedColHeader.getSize();
      actualWidth = box.width;
    }

    expect(Math.abs(actualWidth - 200)).toBeLessThanOrEqual(WIDTH_TOLERANCE);
  });
});
