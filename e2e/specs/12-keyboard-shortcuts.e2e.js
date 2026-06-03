import { T, FIX, tid, cell, prepareApp, openFixture } from '../helpers/app.js';

describe('keyboard shortcuts', () => {
  before(async () => {
    await prepareApp();
    await openFixture(FIX.csv);
  });

  it('ArrowDown moves selection down (statusbar cell-ref changes row)', async () => {
    // Click on cell(0,0) to ensure it is selected first
    const c00 = cell(0, 0);
    await c00.waitForDisplayed({ timeout: 10000 });
    await c00.click();

    const statusRef = tid(T.statusbarCellRef);
    await statusRef.waitForDisplayed({ timeout: 5000 });
    const refBefore = await statusRef.getText();

    await browser.keys(['ArrowDown']);

    // Wait until the cell ref text changes
    await browser.waitUntil(
      async () => {
        const text = await statusRef.getText();
        return text !== refBefore;
      },
      { timeout: 5000, timeoutMsg: 'statusbar-cell-ref did not change after ArrowDown' }
    );

    const refAfter = await statusRef.getText();
    // Row should have incremented (e.g. A1->A2, or row index reflected)
    expect(refAfter).not.toBe(refBefore);
  });

  it('ArrowRight moves selection right (statusbar cell-ref column changes)', async () => {
    const statusRef = tid(T.statusbarCellRef);
    const refBefore = await statusRef.getText();

    await browser.keys(['ArrowRight']);

    await browser.waitUntil(
      async () => {
        const text = await statusRef.getText();
        return text !== refBefore;
      },
      { timeout: 5000, timeoutMsg: 'statusbar-cell-ref did not change after ArrowRight' }
    );

    const refAfter = await statusRef.getText();
    expect(refAfter).not.toBe(refBefore);
  });

  it('Ctrl+A selects all without throwing an error', async () => {
    // Select all — we just assert no exception and the app remains functional
    await browser.keys(['Control', 'a']);

    // App should still be responsive: statusbar-cell-ref still visible
    const statusRef = tid(T.statusbarCellRef);
    await statusRef.waitForDisplayed({ timeout: 5000 });
  });

  it('Ctrl+W closes the sheet and welcome screen reappears', async () => {
    await browser.keys(['Control', 'w']);

    // After closing, either welcome-open-btn reappears (single sheet / no more sheets)
    // OR the sheet count drops. For a single CSV the welcome screen should return.
    const welcomeBtn = tid(T.welcomeOpenBtn);
    await welcomeBtn.waitForDisplayed({ timeout: 10000 });
    expect(await welcomeBtn.isDisplayed()).toBe(true);
  });
});
