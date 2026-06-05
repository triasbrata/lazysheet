import { T, FIX, tid, prepareApp, openFixture, openContextMenuAt, synthClickItem } from '../helpers/app.js';

async function openRowHeaderMenu() {
  const rowHeader = $('[data-row-header="0"]');
  await rowHeader.waitForDisplayed({ timeout: 10000 });
  await rowHeader.click();
  await openContextMenuAt('[data-row-header="0"]');
  await browser.pause(200);
  await tid(T.contextMenu).waitForDisplayed({ timeout: 5000 });
}

describe('context menu', () => {
  before(async () => {
    await prepareApp();
    await openFixture(FIX.csv);
  });

  it('right-clicking a row header cell shows the context menu', async () => {
    await openRowHeaderMenu();
    expect(await tid(T.contextMenu).isDisplayed()).toBe(true);
    await browser.keys(['Escape']);
    await browser.pause(150);
  });

  it('context menu contains a Copy submenu trigger', async () => {
    await openRowHeaderMenu();
    const hasCopy = await tid('ctx-copy').isExisting();
    expect(hasCopy).toBe(true);
    await browser.keys(['Escape']);
    await browser.pause(150);
  });

  it('clicking "Mark as header" applies header styling to the row', async () => {
    await openRowHeaderMenu();

    // Select the "Mark as header" item via synthetic pointer (Radix leaf select).
    await synthClickItem('ctx-mark-header');

    // Menu should close after select.
    await tid(T.contextMenu).waitForDisplayed({ timeout: 3000, reverse: true });

    // Marking a header applies an inline top border (2px) to the header row's
    // cells (Cell.tsx) — not a class. Poll until a row-0 cell gains a top border
    // (the grid re-renders asynchronously after the mark).
    await browser.waitUntil(
      async () => {
        const rowCells = await $$('[data-r="0"]');
        for (const c of rowCells) {
          const bt = await c.getCSSProperty('border-top-width').catch(() => null);
          const w = bt?.parsed?.value ?? parseFloat(String(bt?.value ?? '0'));
          if (w && w >= 1) return true;
        }
        return false;
      },
      { timeout: 5000, timeoutMsg: 'row-0 cells did not gain header top-border after Mark as header' }
    );
  });
});
