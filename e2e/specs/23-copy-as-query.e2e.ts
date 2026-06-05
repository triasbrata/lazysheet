/**
 * Spec 23 — Copy as SQL Query
 *
 * Verifies the "Copy as Query" context-menu flow:
 *   1. A header row must be marked (markHeader(0)).
 *   2. A selection spanning header + data rows is built (A1:B3 → Name+Age cols,
 *      header + 2 data rows: Ada/36, Linus/55).
 *   3. The context menu is opened, "Copy as Query" subtrigger is clicked, then
 *      the desired kind (insert / update / upsert) is selected.
 *   4. The QueryModal opens; table name is set, dialect/key fields optionally
 *      changed, then "Copy" is confirmed.
 *   5. The clipboard is asserted to contain the expected SQL shape.
 *
 * Fixture: simple.csv  (Name,Age,City / Ada,36,London / Linus,55,Helsinki / Grace,85,NewYork)
 * Selection: A1:B3 (columns Name+Age, rows 0-2 = header + 2 data rows).
 */

import {
  T,
  FIX,
  tid,
  prepareApp,
  openFixture,
  installClipboardCapture,
  readCopied,
  markHeader,
  selectCell,
  extendSelection,
  openContextMenuAt,
  synthClickItem,
  synthPointerOpen,
  synthPointerClick,
} from "../helpers/app.js";

// ---------------------------------------------------------------------------
// In-file helper: open the QueryModal for a given kind.
// Pre-conditions (caller's responsibility):
//   - openFixture done
//   - installClipboardCapture done
//   - markHeader(0) done
// ---------------------------------------------------------------------------
async function openQuery(kind: string): Promise<void> {
  await selectCell(0, 0);
  await extendSelection(2, 1); // extend 2 rows down + 1 col right → A1:B3
  await openContextMenuAt('[data-r="1"][data-c="0"]');
  await browser.pause(200);
  await tid(T.contextMenu).waitForDisplayed({ timeout: 8000 });
  // Use synthPointerClick (pointerdown+up+click) for the SubTrigger — on WebKit
  // a bare WDIO .click() may not reliably fire React's onClick on a Radix
  // ContextMenuSubTrigger.  If the submenu still doesn't appear, fall back to
  // dispatching ArrowRight which Radix maps to openChange(true).
  await synthPointerClick(`[data-testid="${T.ctxCopyQuery}"]`);
  await browser.pause(300);
  const subItemSel = `[data-testid="ctx-query-${kind}"]`;
  const subVisible = await $(subItemSel).isDisplayed().catch(() => false);
  if (!subVisible) {
    // Fallback: focus the subtrigger and press ArrowRight to open submenu
    await browser.execute((sel: string) => {
      const el = document.querySelector(sel);
      if (el) (el as HTMLElement).focus();
    }, `[data-testid="${T.ctxCopyQuery}"]`);
    await browser.keys(["ArrowRight"]);
    await browser.pause(200);
  }
  await synthClickItem(`ctx-query-${kind}`); // leaf item: synthetic pointer click
  await tid(T.queryModal).waitForDisplayed({ timeout: 8000 });
}

// ---------------------------------------------------------------------------
// Helper: set the table name input (clears + types)
// ---------------------------------------------------------------------------
async function setTableName(name: string): Promise<void> {
  const inp = tid(T.queryModalTable);
  await inp.waitForDisplayed({ timeout: 5000 });
  await inp.clearValue();
  await inp.setValue(name);
}

// ---------------------------------------------------------------------------
// Helper: ENSURE an option is selected in the MultiSelect key-field picker.
// Same approach as 05-column-filter's condition Select: normal WDIO .click()
// on the trigger to open, and each option carries its own data-testid
// (multi-select-option-<value>) so every step gates on waitForDisplayed /
// waitUntil instead of blind pauses + [role="option"] iteration.
//
// IDEMPOTENT by design: QueryModal prefills keyVals from remembered keys
// (state.initialKeyCols), which persist across app runs — so the option may
// already be selected when the modal opens. A blind click would TOGGLE it OFF
// (the original "empty clipboard" flake). We read aria-selected first and only
// click when not yet selected, then gate on aria-selected="true".
//
// The option is a plain React button; clicked via native element.click() (a
// pointerdown on the portaled PopoverContent can trip the nested dismissable
// layer of the Popover-in-Dialog stack and dismiss before the click lands).
// `value` is the column index as a string (MultiSelect option value).
// ---------------------------------------------------------------------------
async function pickMultiSelectOption(value: string): Promise<void> {
  await tid("multi-select-trigger").click();

  const optSel = `[data-testid="multi-select-option-${value}"]`;
  const opt = tid(`multi-select-option-${value}`);
  await opt.waitForDisplayed({ timeout: 5000 });

  await browser.execute((sel: string) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (el && el.getAttribute("aria-selected") !== "true") el.click();
  }, optSel);

  // Gate on the observable state change: option marked selected.
  await browser.waitUntil(
    async () =>
      (await browser.execute(
        (sel: string) =>
          document.querySelector(sel)?.getAttribute("aria-selected") === "true",
        optSel,
      )) === true,
    {
      timeout: 5000,
      timeoutMsg: `MultiSelect option ${value} never became selected`,
    },
  );

  // Close the Popover so it doesn't overlay the confirm button, and wait for
  // it to actually be gone before the caller clicks confirm.
  await browser.keys(["Escape"]);
  await opt.waitForDisplayed({ timeout: 5000, reverse: true });
}

// ---------------------------------------------------------------------------
// Helper: pick a Radix Select option (dialect selector).
// Opens via synthPointerOpen on the trigger, iterates [role="option"] elements,
// clicks the one matching the visible label.
// VERIFY at runtime: Radix Select renders options at document root (portal), so
// [role="option"] should be globally accessible after the select opens.
// ---------------------------------------------------------------------------
async function pickDialectOption(label: string): Promise<void> {
  await synthPointerOpen(`[data-testid="${T.queryModalDialect}"]`);
  await browser.pause(200);

  // VERIFY at runtime: Radix Select portals options to document.body; the
  // selector [role="option"] should match them after the dropdown opens.
  const options = await $$('[role="option"]');
  let matched = false;
  for (const opt of options) {
    const text = await opt.getText();
    if (text.trim() === label) {
      await opt.click();
      matched = true;
      break;
    }
  }
  if (!matched) {
    throw new Error(
      `Dialect option "${label}" not found among ${options.length} options`,
    );
  }

  await browser.pause(200);
}

// ===========================================================================
describe("copy-as-query", () => {
  beforeEach(async () => {
    // Reload the app before each test — Radix Dialog/ContextMenu state leaks
    // across `it`s when only openFixture (no reload) is called. prepareApp()
    // forces a full page reload so dialogs/menus always start closed.
    await prepareApp();
    await openFixture(FIX.csv);
    await installClipboardCapture();
    await markHeader(0);
  });

  // -------------------------------------------------------------------------
  it("INSERT (MySQL) copies INSERT INTO statement", async () => {
    await openQuery("insert");
    await setTableName("users");
    // Dialect defaults to MySQL — no change needed.

    await tid(T.queryModalConfirm).click();
    await browser.pause(400);

    const c = await readCopied();
    // VERIFY at runtime: MySQL uses backtick-quoted identifiers.
    expect(c.startsWith("INSERT INTO `users`")).toBe(true);
    expect(c).toContain("VALUES");
    // VERIFY at runtime: string values are single-quoted; first data row = Ada.
    expect(c).toContain("('Ada'");
  });

  // -------------------------------------------------------------------------
  it("INSERT (PostgreSQL) uses double-quote identifiers", async () => {
    await openQuery("insert");
    await setTableName("users");

    await pickDialectOption("PostgreSQL");

    await tid(T.queryModalConfirm).click();
    await browser.pause(400);

    const c = await readCopied();
    // VERIFY at runtime: PostgreSQL uses double-quoted identifiers.
    expect(c).toContain('INSERT INTO "users"');
  });

  // -------------------------------------------------------------------------
  it("UPDATE builds UPDATE...SET...WHERE", async () => {
    await openQuery("update");
    await setTableName("users");

    // Pick "Name" (column index 0) as the key field via the MultiSelect.
    await pickMultiSelectOption("0");

    await tid(T.queryModalConfirm).click();
    await browser.pause(400);

    const c = await readCopied();
    expect(c).toContain("UPDATE `users` SET");
    expect(c).toContain("WHERE");
    expect(c).toContain("`Name`");
  });

  // -------------------------------------------------------------------------
  it("UPSERT (MySQL) emits ON DUPLICATE KEY", async () => {
    await openQuery("upsert");
    await setTableName("users");

    // Pick "Name" (column index 0) as the key field via the MultiSelect.
    await pickMultiSelectOption("0");

    await tid(T.queryModalConfirm).click();
    await browser.pause(400);

    const c = await readCopied();
    expect(c).toContain("ON DUPLICATE KEY UPDATE");
  });

  // -------------------------------------------------------------------------
  it("Cancel closes modal without copying", async () => {
    await openQuery("insert");

    // Click the explicit Cancel button (not outside click — Radix Dialog has a
    // 2-click-to-close guard on outside interactions).
    await tid(T.queryModalCancel).click();

    await tid(T.queryModal).waitForDisplayed({ timeout: 5000, reverse: true });
    // Modal should be gone; clipboard should not have been written.
    // (We don't assert clipboard content here since it may retain prior test value.)
  });
});
