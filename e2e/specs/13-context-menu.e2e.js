import { T, FIX, tid, prepareApp, openFixture } from '../helpers/app.js';

describe('context menu', () => {
  before(async () => {
    await prepareApp();
    await openFixture(FIX.csv);
  });

  it('right-clicking a row header cell shows the context menu', async () => {
    // Row header for row 0
    const rowHeader = $('[data-row-header="0"]');
    await rowHeader.waitForDisplayed({ timeout: 10000 });
    await rowHeader.click({ button: 'right' });

    const menu = tid(T.contextMenu);
    await menu.waitForDisplayed({ timeout: 5000 });
    expect(await menu.isDisplayed()).toBe(true);
  });

  it('context menu contains a Copy submenu trigger', async () => {
    // The Copy submenu trigger is a menuitem with text "Copy" inside the context menu
    // It should be present before we click anything else
    const menu = tid(T.contextMenu);
    await menu.waitForDisplayed({ timeout: 5000 });

    // Find menu items and look for one that triggers the Copy submenu
    const copyTrigger = await menu.$('[role="menuitem"]=Copy');
    const hasCopy = await copyTrigger.isExisting();
    expect(hasCopy).toBe(true);
  });

  it('clicking "Mark as header" applies header styling to the row', async () => {
    // The context menu should still be open from the previous test; if not re-open it
    const menu = tid(T.contextMenu);
    const menuVisible = await menu.isDisplayed().catch(() => false);
    if (!menuVisible) {
      const rowHeader = $('[data-row-header="0"]');
      await rowHeader.waitForDisplayed({ timeout: 10000 });
      await rowHeader.click({ button: 'right' });
      await menu.waitForDisplayed({ timeout: 5000 });
    }

    // Click the "Mark as header" menu item
    const markAsHeaderItem = await menu.$('[role="menuitem"]=Mark as header');
    await markAsHeaderItem.waitForDisplayed({ timeout: 3000 });
    await markAsHeaderItem.click();

    // Wait for the menu to close and the row to update
    await menu.waitForDisplayed({ timeout: 3000, reverse: true });

    // Assert the row-header cell (or first cell in row) gained header styling
    // Check for font-bold or amber background classes
    const rowHeader = $('[data-row-header="0"]');
    await rowHeader.waitForDisplayed({ timeout: 5000 });
    const classes = await rowHeader.getAttribute('class');
    const rowCells = await $$('[data-r="0"]');

    // Check if any cell in the row or the row header itself has bold/amber styling
    let hasHeaderStyling = false;
    if (classes && (classes.includes('font-bold') || classes.includes('amber'))) {
      hasHeaderStyling = true;
    } else {
      // Check individual cells in the row
      for (const c of rowCells) {
        const cellClass = await c.getAttribute('class').catch(() => '');
        if (cellClass && (cellClass.includes('font-bold') || cellClass.includes('amber'))) {
          hasHeaderStyling = true;
          break;
        }
      }
    }
    expect(hasHeaderStyling).toBe(true);
  });
});
