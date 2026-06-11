/**
 * Spec 14 — i18n (language switching via Settings modal)
 *
 * Flow:
 *   1. prepareApp() forces English. Assert welcome Open File button visible.
 *   2. Open Settings via command palette ("Open settings" → Enter), wait for
 *      settings-modal. Open the language Radix Select with synthPointerDown-only
 *      (pointerdown-only open avoids WebKit commit-on-pointerup flake), wait for
 *      [data-slot="select-content"], scrollIntoView + click lang-opt-id. Close
 *      modal (Escape). Assert localStorage "lazysheet:language" === "id" and
 *      welcome button text changed to Indonesian ("Buka Berkas").
 *   3. Same flow to switch back to "en"; assert English text restored.
 *
 * WebKit/Radix Select flakiness mitigations used:
 *   - synthPointerDown (pointerdown only, no pointerup) to open — a trailing
 *     pointerup at the trigger position would commit the aligned item and close
 *     the listbox immediately.
 *   - Wait on [data-slot="select-content"] (the listbox portal) rather than the
 *     item directly — the container is available as soon as the portal mounts.
 *   - scrollIntoView({block:"center"}) on the target option before clicking —
 *     the listbox may be clipped in an overflow:hidden viewport and the item
 *     would not be "displayed" without scrolling.
 *   - One-time open retry: if select-content is not visible within 3 s,
 *     fire another synthPointerDown and wait again.
 * Note: if flakiness reappears on CI, wrap individual tests with .only during
 * debug rather than describe.skip — skipping masks regressions.
 */

import {
  T,
  tid,
  prepareApp,
  synthPointerDown,
} from "../helpers/app.js";

/**
 * Opens the Settings modal via the command palette:
 *   Ctrl+K → type "settings" → wait for "Open settings" item → Enter → wait for modal.
 */
async function openSettingsViaCommandPalette(): Promise<void> {
  await browser.keys(["Control", "k"]);
  const palette = tid(T.commandPalette);
  await palette.waitForDisplayed({ timeout: 8000 });

  const paletteInput = tid(T.commandPaletteInput);
  await paletteInput.waitForDisplayed({ timeout: 5000 });
  await paletteInput.setValue("settings");

  // Wait for at least one matching item
  await browser.waitUntil(
    () =>
      ($$(`[data-testid="${T.commandPaletteItem}"]`).length as unknown as Promise<number>).then(
        (n) => n >= 1,
      ),
    { timeout: 5000, timeoutMsg: "No command-palette-item for 'settings'" },
  );

  // Press Enter to execute the first match ("Open settings")
  await browser.keys(["Enter"]);

  // Wait for the settings modal to appear
  await tid(T.settingsModal).waitForDisplayed({ timeout: 8000 });
}

/**
 * Selects a language option inside the Settings modal Radix Select.
 * Uses pointerdown-only open to avoid WebKit commit-on-pointerup flake.
 * @param langOptTestid - data-testid of the SelectItem, e.g. "lang-opt-id".
 */
async function selectLanguageOption(langOptTestid: string): Promise<void> {
  const triggerSel = `[data-testid="${T.settingsLanguageSelect}"]`;
  const content = $('[data-slot="select-content"]');

  // Ensure trigger is visible before dispatching events
  await tid(T.settingsLanguageSelect).waitForDisplayed({ timeout: 5000 });

  // Open with pointerdown only (no pointerup — that would commit+close on WebKit)
  await synthPointerDown(triggerSel);

  try {
    await content.waitForDisplayed({ timeout: 3000 });
  } catch {
    // Single retry if the listbox did not mount
    await synthPointerDown(triggerSel);
    await content.waitForDisplayed({ timeout: 3000 });
  }

  // scrollIntoView before asserting visibility — listbox may be clipped in viewport
  await browser.execute((sel: string) => {
    document.querySelector(sel)?.scrollIntoView({ block: "center" });
  }, `[data-testid="${langOptTestid}"]`);

  const item = tid(langOptTestid);
  await item.waitForDisplayed({ timeout: 3000 });
  await item.click();
}

describe("i18n (language switching)", () => {
  before(async () => {
    // prepareApp() forces English locale via localStorage before reload
    await prepareApp();
  });

  it("welcome open button is visible in English on clean start", async () => {
    const openBtn = tid(T.welcomeOpenBtn);
    await openBtn.waitForDisplayed({ timeout: 10000 });
    // English: welcome.openFile = "Open File"
    const text = await openBtn.getText();
    expect(text).toMatch(/open/i);
  });

  it("switching to Bahasa Indonesia changes UI strings and saves to localStorage", async () => {
    // Open Settings modal via command palette
    await openSettingsViaCommandPalette();

    // Select Indonesian inside the Settings modal
    await selectLanguageOption("lang-opt-id");

    // Close modal with Escape so background UI re-renders
    await browser.keys(["Escape"]);
    await tid(T.settingsModal).waitForDisplayed({ timeout: 5000, reverse: true });

    // Assert localStorage updated to "id"
    await browser.waitUntil(
      async () => {
        const lang = await browser.execute(
          () => localStorage.getItem("lazysheet:language"),
        );
        return lang === "id";
      },
      { timeout: 10000, timeoutMsg: 'localStorage language did not update to "id"' },
    );

    const storedLang = await browser.execute(
      () => localStorage.getItem("lazysheet:language"),
    );
    expect(storedLang).toBe("id");

    // Assert welcome Open File button shows Indonesian text ("Buka Berkas")
    const openBtn = tid(T.welcomeOpenBtn);
    await openBtn.waitForDisplayed({ timeout: 10000 });
    await browser.waitUntil(
      async () => {
        const t = await openBtn.getText().catch(() => "");
        return /buka/i.test(t);
      },
      { timeout: 10000, timeoutMsg: "Welcome open button text did not change to Indonesian" },
    );
    const idText = await openBtn.getText();
    // id.json: welcome.openFile = "Buka Berkas"
    expect(idText).toMatch(/buka/i);
  });

  it("switching back to English restores the original UI strings", async () => {
    // Open Settings modal via command palette (language is still "id" from previous test)
    await openSettingsViaCommandPalette();

    // Select English inside the Settings modal
    await selectLanguageOption("lang-opt-en");

    // Close modal
    await browser.keys(["Escape"]);
    await tid(T.settingsModal).waitForDisplayed({ timeout: 5000, reverse: true });

    // Assert localStorage reverted to "en"
    await browser.waitUntil(
      async () => {
        const lang = await browser.execute(
          () => localStorage.getItem("lazysheet:language"),
        );
        return lang === "en";
      },
      { timeout: 10000, timeoutMsg: 'localStorage language did not revert to "en"' },
    );

    const storedLang = await browser.execute(
      () => localStorage.getItem("lazysheet:language"),
    );
    expect(storedLang).toBe("en");

    // Assert welcome Open File button reverted to English
    const openBtn = tid(T.welcomeOpenBtn);
    await openBtn.waitForDisplayed({ timeout: 10000 });
    await browser.waitUntil(
      async () => {
        const t = await openBtn.getText().catch(() => "");
        return /open/i.test(t);
      },
      { timeout: 10000, timeoutMsg: "Welcome open button text did not revert to English" },
    );
    const enText = await openBtn.getText();
    expect(enText).toMatch(/open/i);
  });
});
