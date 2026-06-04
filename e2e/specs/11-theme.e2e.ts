import { T, tid, prepareApp, openDropdownItem } from '../helpers/app.js';

describe('theme', () => {
  before(async () => {
    await prepareApp();
  });

  it('switches to Dark mode and reflects class on html element', async () => {
    // Use synthPointerClick-backed openDropdownItem — Radix DropdownMenuTrigger
    // does not open on a normal WDIO .click() under macOS WebKit.
    await openDropdownItem(T.themeToggleBtn, "theme-item-dark");

    const isDark = await browser.execute(
      () => document.documentElement.classList.contains('dark')
    );
    expect(isDark).toBe(true);
  });

  it('switches back to Light mode and removes dark class', async () => {
    await openDropdownItem(T.themeToggleBtn, "theme-item-light");

    const isDark = await browser.execute(
      () => document.documentElement.classList.contains('dark')
    );
    expect(isDark).toBe(false);
  });
});
