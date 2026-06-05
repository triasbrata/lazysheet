/**
 * Spec 25 — Auto-update (OTA) toast UX
 *
 * Drives the updater through the __E2E__ hook, which injects a MOCKED plugin
 * response (no real update server, no genuine relaunch). Covers the four
 * decision branches in src/lib/updater.ts:
 *   - manual + no update  → "up-to-date" success toast
 *   - manual + update      → "Update available" warning toast with an Install action
 *   - manual + failure      → "Update check failed" error toast
 *   - startup + no update   → silent (no toast)
 *
 * The app is prepared ONCE and toasts are dismissed between tests rather than
 * reloading per test — a per-test location.reload() races sonner's mount/paint
 * on WebKit. Assertions re-fire the (idempotent) mocked check while polling so a
 * cold-start paint lag can't flake the run.
 */

import { prepareApp } from "../helpers/app.js";

interface UpdateMock {
  trigger?: "startup" | "manual";
  update?: { version: string } | null;
  fail?: string;
}

const TOAST = "[data-sonner-toast]";

/**
 * Calls window.__E2E__.runUpdateCheck (a Promise) via executeAsync so WebKit can
 * await it browser-side and return a serializable result — same pattern as
 * openFixture / readClipboard.
 */
async function mockUpdateCheck(mock: UpdateMock): Promise<void> {
  const err = await browser.executeAsync(
    (m: UpdateMock, done: (v: string | null) => void) => {
      window
        .__E2E__!.runUpdateCheck(m)
        .then(() => done(null))
        .catch((e: unknown) => done(String(e)));
    },
    mock,
  );
  if (err) throw new Error(`runUpdateCheck failed: ${err}`);
}

/**
 * Re-fires the (idempotent) mocked check while polling for a toast whose text
 * contains `needle`. Re-firing absorbs cold-start paint lag deterministically —
 * the decision is pure, so repeating it only re-renders the same toast.
 */
async function expectToast(mock: UpdateMock, needle: string): Promise<void> {
  let last = "";
  await browser.waitUntil(
    async () => {
      await mockUpdateCheck(mock);
      for (const t of await $$(TOAST)) {
        last = (await t.getText()).toLowerCase();
        if (last.includes(needle)) return true;
      }
      return false;
    },
    {
      timeout: 20000,
      interval: 1000,
      timeoutMsg: `no toast containing "${needle}" — last seen: "${last}"`,
    },
  );
}

describe("auto-update", () => {
  before(async () => {
    await prepareApp();
  });

  // Clear any toast from the previous test and wait until the toast region is
  // empty, so each assertion starts from a known-clean state.
  beforeEach(async () => {
    await browser.execute(() => window.__E2E__!.dismissToasts());
    await browser.waitUntil(async () => (await $$(TOAST).length) === 0, {
      timeout: 10000,
      timeoutMsg: "toasts did not clear between tests",
    });
  });

  it("manual check with no update shows the up-to-date toast", async () => {
    await expectToast({ trigger: "manual", update: null }, "latest version");
  });

  it("offers an install action when an update is available", async () => {
    await expectToast(
      { trigger: "manual", update: { version: "9.9.9" } },
      "update available",
    );
    // Version and an actionable Install button must be present.
    const toast = $(TOAST);
    expect((await toast.getText()).toLowerCase()).toContain("9.9.9");
    await $(`${TOAST} [data-button]`).waitForDisplayed({ timeout: 10000 });
  });

  it("surfaces an error toast when a manual check fails", async () => {
    await expectToast(
      { trigger: "manual", fail: "network unreachable" },
      "update check failed",
    );
  });

  it("stays silent on a startup check with no update", async () => {
    await mockUpdateCheck({ trigger: "startup", update: null });
    // Give any erroneous toast a chance to render before asserting none exist.
    await browser.pause(800);
    const toasts = await $$(TOAST);
    expect(toasts.length).toBe(0);
  });
});
