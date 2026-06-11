/**
 * Spec 28 — Undo / redo for inline cell edits
 *
 * Verifies session-scoped undo/redo end-to-end, including the regression where
 * undo did nothing AFTER a save:
 *   1. Ctrl+Z reverts a committed (but unsaved) edit and clears titlebar-dirty.
 *   2. Ctrl+Shift+Z (redo) re-applies the undone edit.
 *   3. Undo still reverts a cell AFTER it was saved to disk. handleSave reloads
 *      the base rows to the saved value and clears the overlay; the fix restores
 *      the captured original value as an overlay so the cell reverts and goes
 *      dirty again (ready to re-save).
 *
 * Fixture: simple.csv (writable .csv). Test 3 writes to disk via the real Rust
 * save_edits command, so beforeEach/afterEach rewrite the fixture to its canonical
 * contents — keeping the committed file pristine and isolating this spec from
 * spec 27 (which also saves into simple.csv).
 *
 * Requirements: inline cell editing and undo/redo are always-on (no feature flags needed).
 */

import { writeFileSync } from "node:fs";
import {
  FIX,
  tid,
  cell,
  prepareApp,
  openFixture,
  selectCell,
  gridKey,
} from "../helpers/app.js";

// Canonical simple.csv contents — restored around each test so saves don't
// pollute the committed fixture.
const CSV_CANONICAL =
  "Name,Age,City\nAda,36,London\nLinus,55,Helsinki\nGrace,85,NewYork\n";

async function waitForEditor(timeout = 8000) {
  const editor = tid("cell-editor");
  await editor.waitForDisplayed({ timeout, timeoutMsg: "cell-editor did not appear" });
  return editor;
}

async function waitForEditorGone(timeout = 8000): Promise<void> {
  await tid("cell-editor").waitForDisplayed({
    timeout,
    reverse: true,
    timeoutMsg: "cell-editor did not disappear after commit/cancel",
  });
}

/** Commit `value` into cell (r,c) via F2 → clear → type → Enter. */
async function commitEdit(r: number, c: number, value: string): Promise<void> {
  await selectCell(r, c);
  await browser.pause(100);
  await gridKey("F2");
  const editor = await waitForEditor();
  await editor.clearValue();
  await editor.setValue(value);
  await browser.keys(["Enter"]);
  await waitForEditorGone();
}

async function cellText(r: number, c: number): Promise<string> {
  return (await cell(r, c).getText().catch(() => "")) as string;
}

async function dirtyShown(): Promise<boolean> {
  return (await tid("titlebar-dirty").isDisplayed().catch(() => false)) as boolean;
}

describe("undo-redo", () => {
  beforeEach(async () => {
    writeFileSync(FIX.csv, CSV_CANONICAL);
    await prepareApp();
    await openFixture(FIX.csv);
  });

  afterEach(() => {
    // Restore the fixture in case a test saved to disk.
    writeFileSync(FIX.csv, CSV_CANONICAL);
  });

  // ── 1. Undo reverts an unsaved edit ──────────────────────────────────────
  it("Ctrl+Z reverts a committed (unsaved) edit and clears the dirty indicator", async () => {
    // (1,1) = "36"
    await commitEdit(1, 1, "999");
    await browser.waitUntil(async () => (await cellText(1, 1)) === "999", {
      timeout: 8000,
      timeoutMsg: "cell (1,1) did not show '999' after commit",
    });
    await tid("titlebar-dirty").waitForDisplayed({
      timeout: 8000,
      timeoutMsg: "dirty indicator should appear after an edit",
    });

    // Undo.
    await gridKey("z", { ctrl: true });

    await browser.waitUntil(async () => (await cellText(1, 1)) === "36", {
      timeout: 8000,
      timeoutMsg: "cell (1,1) did not revert to '36' after undo",
    });
    // Undoing the only edit returns the buffer to clean.
    await tid("titlebar-dirty").waitForDisplayed({
      timeout: 8000,
      reverse: true,
      timeoutMsg: "dirty indicator should clear after undoing the only edit",
    });
    expect(await cellText(1, 1)).toBe("36");
    expect(await dirtyShown()).toBe(false);
  });

  // ── 2. Redo re-applies the undone edit ───────────────────────────────────
  it("Ctrl+Shift+Z re-applies the undone edit", async () => {
    await commitEdit(1, 1, "999");
    await browser.waitUntil(async () => (await cellText(1, 1)) === "999", {
      timeout: 8000,
      timeoutMsg: "cell (1,1) did not show '999' after commit",
    });

    await gridKey("z", { ctrl: true });
    await browser.waitUntil(async () => (await cellText(1, 1)) === "36", {
      timeout: 8000,
      timeoutMsg: "cell (1,1) did not revert after undo",
    });

    await gridKey("z", { ctrl: true, shift: true });
    await browser.waitUntil(async () => (await cellText(1, 1)) === "999", {
      timeout: 8000,
      timeoutMsg: "cell (1,1) did not return to '999' after redo",
    });
    expect(await cellText(1, 1)).toBe("999");
    expect(await dirtyShown()).toBe(true);
  });

  // ── 3. Undo works AFTER save (regression) ────────────────────────────────
  it("undo reverts a cell even after the edit was saved", async () => {
    await commitEdit(1, 1, "999");
    await tid("titlebar-dirty").waitForDisplayed({
      timeout: 8000,
      timeoutMsg: "dirty indicator should appear before save",
    });

    // Save — base rows reload to "999", overlay clears → clean.
    await gridKey("s", { ctrl: true });
    await tid("titlebar-dirty").waitForDisplayed({
      timeout: 15000,
      reverse: true,
      timeoutMsg: "dirty indicator did not clear after save",
    });

    // Undo after save must revert the displayed value back to the original and
    // mark the buffer dirty again (so it can be re-saved).
    await gridKey("z", { ctrl: true });
    await browser.waitUntil(async () => (await cellText(1, 1)) === "36", {
      timeout: 8000,
      timeoutMsg: "cell (1,1) did not revert to '36' after undo-following-save",
    });
    await tid("titlebar-dirty").waitForDisplayed({
      timeout: 8000,
      timeoutMsg: "dirty indicator should return after undoing a saved edit",
    });
    expect(await cellText(1, 1)).toBe("36");
    expect(await dirtyShown()).toBe(true);
  });
});
