import { T, tid, prepareApp, openSettings, openSelectItem } from '../helpers/app.js';

// Theme switching lives in the Settings modal (a Radix Select), not a standalone
// toolbar dropdown. Open Settings once via Cmd/Ctrl+, and pick options from the
// theme select; selecting an option commits immediately (onValueChange).
describe('theme', () => {
  before(async () => {
    await prepareApp();
    // Wait for the welcome screen to settle before firing the Cmd/Ctrl+,
    // shortcut, so the keydown is routed to a ready document.
    await tid(T.welcomeOpenBtn).waitForDisplayed({ timeout: 10000 });
    await openSettings();
  });

  it('switches to Dark mode and reflects class on html element', async () => {
    await openSelectItem(T.settingsThemeSelect, 'theme-opt-dark');

    const isDark = await browser.execute(
      () => document.documentElement.classList.contains('dark')
    );
    expect(isDark).toBe(true);
  });

  it('switches back to Light mode and removes dark class', async () => {
    await openSelectItem(T.settingsThemeSelect, 'theme-opt-light');

    const isDark = await browser.execute(
      () => document.documentElement.classList.contains('dark')
    );
    expect(isDark).toBe(false);
  });

  it('switches to a color palette and sets data-theme plus dark base class', async () => {
    await openSelectItem(T.settingsThemeSelect, 'theme-opt-palenight');

    const dataTheme = await browser.execute(
      () => document.documentElement.getAttribute('data-theme')
    );
    expect(dataTheme).toBe('palenight');

    const isDark = await browser.execute(
      () => document.documentElement.classList.contains('dark')
    );
    expect(isDark).toBe(true);
  });
});
