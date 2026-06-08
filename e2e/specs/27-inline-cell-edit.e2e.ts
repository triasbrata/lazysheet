/**
 * Spec 27 — Inline cell edit (edit→save round-trip)
 *
 * Verifies the full inline-edit feature end-to-end:
 *   1. F2 on a selected cell opens the cell-editor textarea (autofocused).
 *   2. Typing a value + Enter commits the edit: cell-editor disappears and the
 *      cell DOM reflects the new buffered value.
 *   3. The titlebar-dirty indicator appears after a committed edit.
 *   4. Ctrl/Cmd+S triggers save: the dirty indicator disappears on success.
 *   5. Double-clicking a data cell also opens the cell-editor (alternate entry).
 *   6. Escape cancels an in-progress edit without changing the cell value.
 *   7. Tab commits the edit and moves selection right.
 *
 * Fixture: simple.csv  — a writable format (.csv); isWritableFormat returns true
 * for .csv paths, so editEnabled is true when VITE_FF_INLINE_EDIT=true.
 *
 * simple.csv layout (zero-based row/col):
 *   row 0: ["Name", "Age", "City"]   — headers
 *   row 1: ["Ada", "36", "London"]
 *   row 2: ["Linus", "55", "Helsinki"]
 *   row 3: ["Grace", "85", "NewYork"]
 *
 * Requirements:
 *   - Build must include VITE_FF_INLINE_EDIT=true (wired in e2e:build-app).
 *   - Tauri binary + webdriver must be running (not started in this spec).
 *
 * NOTE: persistence after reopen is NOT asserted here because the save_edits
 * Rust command writes the file — we assert persistence indirectly by confirming
 * the titlebar-dirty indicator clears after Ctrl+S (which proves the Rust command
 * resolved successfully). A reopen round-trip requires writing a real file and
 * re-reading it, which is exercised by the integration tests in src/. Adding it
 * here would require the fixture to be regenerated after each run; we avoid that
 * fragility.
 */

import {
  T,
  FIX,
  tid,
  cell,
  prepareApp,
  openFixture,
  selectCell,
  focusGrid,
  gridKey,
} from "../helpers/app.js";

// ── helpers local to this spec ────────────────────────────────────────────────

/**
 * Dispatches a synthetic dblclick MouseEvent at the center of a cell element.
 * React's onDoubleClick handler (handleBodyDoubleClick in Grid.tsx) fires from
 * the bubbling dblclick event, so a synthetic one is sufficient. We avoid WDIO's
 * native doubleClick() because macOS WebKit under tauri-webdriver does not reliably
 * deliver pointer-based double-clicks to the overlaid canvas/div layer.
 */
async function synthDblClick(r: number, c: number): Promise<void> {
  await browser.execute(
    (row: number, col: number) => {
      const el = document.querySelector<HTMLElement>(
        `[data-r="${row}"][data-c="${col}"]`,
      );
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const o = {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        button: 0,
        detail: 2,
      };
      el.dispatchEvent(new MouseEvent("dblclick", o));
    },
    r,
    c,
  );
}

/**
 * Waits for the cell-editor textarea to appear and be autofocused, then returns
 * the WDIO element handle.
 */
async function waitForEditor(timeout = 8000) {
  const editor = tid("cell-editor");
  await editor.waitForDisplayed({ timeout, timeoutMsg: "cell-editor did not appear" });
  return editor;
}

/**
 * Waits for the cell-editor textarea to disappear (commit or cancel resolved).
 */
async function waitForEditorGone(timeout = 8000): Promise<void> {
  await tid("cell-editor").waitForDisplayed({
    timeout,
    reverse: true,
    timeoutMsg: "cell-editor did not disappear after commit/cancel",
  });
}

// ── spec ─────────────────────────────────────────────────────────────────────

describe("inline-cell-edit", () => {
  // Each test gets a clean app + freshly opened fixture so edits from a prior
  // test do not leak (editBuffer is cleared on open; prepareApp reloads the page).
  beforeEach(async () => {
    await prepareApp();
    await openFixture(FIX.csv);
  });

  // ── 1. F2 opens the editor ──────────────────────────────────────────────────
  it("F2 on a selected cell opens the cell-editor textarea", async () => {
    // Navigate to a data cell (row 1, col 0 = "Ada")
    await selectCell(1, 0);
    await browser.pause(100);

    // F2 dispatched via gridKey so the grid's onKeyDown receives it with no
    // modifier confusion (same pattern as other grid keyboard specs).
    await gridKey("F2");

    const editor = await waitForEditor();
    // The textarea should be autofocused — check it's the active element.
    const isFocused = await browser.execute(() => {
      const el = document.querySelector('[data-testid="cell-editor"]');
      return el !== null && document.activeElement === el;
    });
    expect(isFocused).toBe(true);

    // Cleanup: press Escape so the editor is gone before the next test's
    // beforeEach reloads anyway — belt-and-suspenders for test isolation.
    const editorEl = await waitForEditor();
    await editorEl.setValue("");
    await browser.keys(["Escape"]);
  });

  // ── 2. Type + Enter commits the edit ──────────────────────────────────────
  it("typing a value and pressing Enter commits the edit and updates the cell", async () => {
    // Row 1, col 1 = "36" (Ada's age)
    await selectCell(1, 1);
    await browser.pause(100);
    await gridKey("F2");

    const editor = await waitForEditor();
    // Clear the pre-filled value and type our new value.
    await editor.clearValue();
    await editor.setValue("999");
    await browser.keys(["Enter"]);

    await waitForEditorGone();

    // The cell DOM should reflect the buffered value "999" immediately.
    const dataCell = cell(1, 1);
    await browser.waitUntil(
      async () => {
        const text = await dataCell.getText().catch(() => "");
        return text === "999";
      },
      {
        timeout: 8000,
        timeoutMsg: "cell (1,1) did not show '999' after commit",
      },
    );

    expect(await dataCell.getText()).toBe("999");
  });

  // ── 3. titlebar-dirty appears after an edit ─────────────────────────────
  it("titlebar-dirty indicator appears after a committed edit", async () => {
    await selectCell(1, 0);
    await browser.pause(100);
    await gridKey("F2");

    const editor = await waitForEditor();
    await editor.clearValue();
    await editor.setValue("TestDirty");
    await browser.keys(["Enter"]);

    await waitForEditorGone();

    // Dirty indicator must appear.
    const dirtyEl = tid("titlebar-dirty");
    await dirtyEl.waitForDisplayed({
      timeout: 8000,
      timeoutMsg: "titlebar-dirty did not appear after committing an edit",
    });
    expect(await dirtyEl.isDisplayed()).toBe(true);
  });

  // ── 4. Ctrl/Cmd+S saves and clears the dirty indicator ─────────────────
  it("Ctrl+S saves the buffer and the titlebar-dirty indicator disappears", async () => {
    await selectCell(2, 0);
    await browser.pause(100);
    await gridKey("F2");

    const editor = await waitForEditor();
    await editor.clearValue();
    await editor.setValue("SavedValue");
    await browser.keys(["Enter"]);

    await waitForEditorGone();

    // Confirm dirty before save.
    await tid("titlebar-dirty").waitForDisplayed({
      timeout: 8000,
      timeoutMsg: "titlebar-dirty should be present before save",
    });

    // Ctrl+S (metaKey=true on macOS, ctrlKey on others — gridKey dispatches
    // ctrlKey; App.tsx checks `e.metaKey || e.ctrlKey`, so ctrl is universal).
    await gridKey("s", { ctrl: true });

    // After a successful save the buffer clears and dirty indicator disappears.
    await tid("titlebar-dirty").waitForDisplayed({
      timeout: 15000,
      reverse: true,
      timeoutMsg: "titlebar-dirty did not clear after Ctrl+S — save may have failed",
    });

    expect(await tid("titlebar-dirty").isDisplayed().catch(() => false)).toBe(false);
  });

  // ── 5. Double-click opens the editor (alternate entry path) ────────────
  it("double-clicking a data cell opens the cell-editor", async () => {
    // Ensure the cell is in the viewport (selectCell navigates there via keyboard).
    await selectCell(3, 2);
    await browser.pause(150);

    // Dispatch synthetic dblclick at the cell center.
    await synthDblClick(3, 2);

    await waitForEditor();

    const editorExists = await tid("cell-editor").isDisplayed();
    expect(editorExists).toBe(true);

    // Cancel so the editor is gone.
    await browser.keys(["Escape"]);
    await waitForEditorGone();
  });

  // ── 6. Escape cancels without changing the cell ────────────────────────
  it("pressing Escape cancels the edit and leaves the cell value unchanged", async () => {
    // Row 1, col 2 = "London"
    const dataCell = cell(1, 2);
    await dataCell.waitForDisplayed({ timeout: 10000 });
    const originalText = await dataCell.getText();

    await selectCell(1, 2);
    await browser.pause(100);
    await gridKey("F2");

    const editor = await waitForEditor();
    await editor.clearValue();
    await editor.setValue("SHOULD_NOT_APPEAR");

    // Escape cancels the edit — the editor sends onCancel → editingCell cleared.
    await browser.keys(["Escape"]);
    await waitForEditorGone();

    // Cell must still show the original value.
    await browser.waitUntil(
      async () => {
        const text = await dataCell.getText().catch(() => "");
        return text === originalText;
      },
      {
        timeout: 5000,
        timeoutMsg: `cell (1,2) should still show '${originalText}' after Escape`,
      },
    );

    expect(await dataCell.getText()).toBe(originalText);
    // No dirty indicator should have appeared.
    expect(
      await tid("titlebar-dirty").isDisplayed().catch(() => false),
    ).toBe(false);
  });

  // ── 7. Tab commits and moves selection right ──────────────────────────
  it("pressing Tab commits the edit and moves selection to the next column", async () => {
    // Row 1, col 0 = "Ada"
    await selectCell(1, 0);
    await browser.pause(100);
    await gridKey("F2");

    const editor = await waitForEditor();
    await editor.clearValue();
    await editor.setValue("TabTest");
    // Tab commits and moves selection right — same key delivery that works in
    // keyboard-shortcuts spec for regular navigation.
    await browser.keys(["Tab"]);

    await waitForEditorGone();

    // Committed cell should show the new value.
    await browser.waitUntil(
      async () => {
        const text = await cell(1, 0).getText().catch(() => "");
        return text === "TabTest";
      },
      {
        timeout: 8000,
        timeoutMsg: "cell (1,0) did not show 'TabTest' after Tab commit",
      },
    );

    expect(await cell(1, 0).getText()).toBe("TabTest");

    // Selection should have moved to col 1 (statusbar-cell-ref should show B2).
    const statusRef = tid(T.statusbarCellRef);
    await browser.waitUntil(
      async () => {
        const ref = await statusRef.getText().catch(() => "");
        return ref === "B2";
      },
      {
        timeout: 5000,
        timeoutMsg: "statusbar-cell-ref did not show B2 after Tab commit from A2",
      },
    );

    expect(await statusRef.getText()).toBe("B2");
  });
});
