import { T, tid, prepareApp } from '../helpers/app.js';

describe('theme', () => {
  before(async () => {
    await prepareApp();
  });

  it('switches to Dark mode and reflects class on html element', async () => {
    const toggleBtn = tid(T.themeToggleBtn);
    await toggleBtn.waitForDisplayed({ timeout: 10000 });
    await toggleBtn.click();

    // Wait for the dropdown/menu to appear and find the Dark item
    const darkItem = await $('[role="menuitem"]=Dark');
    await darkItem.waitForDisplayed({ timeout: 5000 });
    await darkItem.click();

    const isDark = await browser.execute(
      () => document.documentElement.classList.contains('dark')
    );
    expect(isDark).toBe(true);
  });

  it('switches back to Light mode and removes dark class', async () => {
    const toggleBtn = tid(T.themeToggleBtn);
    await toggleBtn.waitForDisplayed({ timeout: 10000 });
    await toggleBtn.click();

    // Wait for the dropdown/menu to appear and find the Light item
    const lightItem = await $('[role="menuitem"]=Light');
    await lightItem.waitForDisplayed({ timeout: 5000 });
    await lightItem.click();

    const isDark = await browser.execute(
      () => document.documentElement.classList.contains('dark')
    );
    expect(isDark).toBe(false);
  });
});
