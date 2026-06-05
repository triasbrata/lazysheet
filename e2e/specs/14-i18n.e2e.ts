import { T, tid, prepareApp, openDropdownItem } from '../helpers/app.js';

describe('i18n (language switching)', () => {
  before(async () => {
    // prepareApp() forces English locale
    await prepareApp();
  });

  it('welcome open button is visible in English on clean start', async () => {
    const openBtn = tid(T.welcomeOpenBtn);
    await openBtn.waitForDisplayed({ timeout: 10000 });
    // In English the button text should contain "Open File" (or "Open")
    const text = await openBtn.getText();
    expect(text).toMatch(/open/i);
  });

  it('switching to Bahasa Indonesia changes UI strings and saves to localStorage', async () => {
    const openBtn = tid(T.welcomeOpenBtn);
    await openBtn.waitForDisplayed({ timeout: 5000 });
    const englishText = await openBtn.getText();

    // Use synthPointerClick-backed openDropdownItem — Radix DropdownMenuTrigger
    // does not open on a normal WDIO .click() under macOS WebKit.
    await openDropdownItem(T.langToggleBtn, "lang-item-id");

    // Wait for the UI to re-render with the new locale
    await browser.waitUntil(
      async () => {
        const lang = await browser.execute(
          () => localStorage.getItem('lazysheet:language')
        );
        return lang === 'id';
      },
      { timeout: 10000, timeoutMsg: 'localStorage language did not update to "id"' }
    );

    // Verify localStorage stores 'id'
    const storedLang = await browser.execute(
      () => localStorage.getItem('lazysheet:language')
    );
    expect(storedLang).toBe('id');

    // Verify the welcome open button text changed from the English version
    await browser.waitUntil(
      async () => {
        const newText = await openBtn.getText().catch(() => '');
        return newText !== englishText && newText.length > 0;
      },
      { timeout: 10000, timeoutMsg: 'Welcome open button text did not change after language switch' }
    );

    const indonesianText = await openBtn.getText();
    expect(indonesianText).not.toBe(englishText);
    // Should NOT say "Open File" in English anymore
    expect(indonesianText).not.toMatch(/^Open File$/i);
  });

  it('switching back to English restores the original UI strings', async () => {
    const openBtn = tid(T.welcomeOpenBtn);
    await openBtn.waitForDisplayed({ timeout: 5000 });
    const idText = await openBtn.getText();

    // Use synthPointerClick-backed openDropdownItem to switch back to English.
    await openDropdownItem(T.langToggleBtn, "lang-item-en");

    // Wait for localStorage to update
    await browser.waitUntil(
      async () => {
        const lang = await browser.execute(
          () => localStorage.getItem('lazysheet:language')
        );
        return lang === 'en';
      },
      { timeout: 10000, timeoutMsg: 'localStorage language did not revert to "en"' }
    );

    // Verify text changed back from Indonesian
    await browser.waitUntil(
      async () => {
        const newText = await openBtn.getText().catch(() => '');
        return newText !== idText && newText.length > 0;
      },
      { timeout: 10000, timeoutMsg: 'Welcome open button text did not revert to English' }
    );

    const englishText = await openBtn.getText();
    expect(englishText).toMatch(/open/i);
  });
});
