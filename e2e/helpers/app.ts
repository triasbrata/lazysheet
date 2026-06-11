import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Browser-side globals exposed by the app's VITE_E2E hook + our e2e shims. */
declare global {
  interface Window {
    __E2E__: {
      open(path: string): Promise<void>;
      readClipboard(): Promise<string>;
      runUpdateCheck(mock: {
        trigger?: "startup" | "manual";
        update?: { version: string } | null;
        fail?: string;
      }): Promise<void>;
      dismissToasts(): void;
      captureSummaryImage(): Promise<
        | {
            ok: true;
            bytes: number;
            width: number;
            height: number;
            nonBlank: boolean;
          }
        | { ok: false; error: string }
      >;
      /** Returns the current grid zoom level (1 = 100%). */
      getZoom?(): number;
    };
    __coverage__?: unknown;
    __e2eClip?: string;
    __e2eClipInstalled?: boolean;
  }
}

/** Modifiers accepted by {@link gridKey}. */
export interface KeyMods {
  shift?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
}

/**
 * Testid name constants — one source of truth for all data-testid values.
 */
export const T = {
  welcomeOpenBtn: "welcome-open-btn",
  welcomeDropzone: "welcome-dropzone",
  gridScrollContainer: "grid-scroll-container",
  sheetTabs: "sheet-tabs",
  sheetTab: "sheet-tab",
  findMatchCount: "find-match-count",
  filterPanel: "filter-panel",
  filterOperandInput: "filter-operand-input",
  filterOkBtn: "filter-ok-btn",
  filterCancelBtn: "filter-cancel-btn",
  summaryPanel: "summary-panel",
  summaryCopyBtn: "summary-copy-btn",
  summaryTable: "summary-table",
  resizeDialog: "resize-dialog",
  resizeInput: "resize-input",
  resizeOkBtn: "resize-ok-btn",
  commandPalette: "command-palette",
  commandPaletteInput: "command-palette-input",
  commandPaletteItem: "command-palette-item",
  themeToggleBtn: "theme-toggle-btn",
  settingsModal: "settings-modal",
  settingsLanguageSelect: "settings-language-select",
  contextMenu: "context-menu",
  statusbar: "statusbar",
  statusbarCellRef: "statusbar-cell-ref",
  statusbarStats: "statusbar-stats",
  statusbarAnalyze: "statusbar-analyze",
  titlebar: "titlebar",
  titlebarFilename: "titlebar-filename",
  summaryCopyCaret: "summary-copy-caret",
  summaryCopyOptMd: "summary-copy-opt-markdown",
  summaryCopyOptTsv: "summary-copy-opt-tsv",
  summaryCopyOptImg: "summary-copy-opt-image",
  summaryClose: "summary-close",
  summaryViewTree: "summary-view-tree",
  summaryViewFlat: "summary-view-flat",
  summarySubtotals: "summary-subtotals",
  summaryAddCategory: "summary-add-category",
  ctxSummarize: "ctx-summarize",
  ctxCopyQuery: "ctx-copy-query",
  queryModal: "query-modal",
  queryModalTable: "query-modal-table",
  queryModalDialect: "query-modal-dialect",
  queryModalConfirm: "query-modal-confirm",
  queryModalCancel: "query-modal-cancel",
} as const;

/**
 * Absolute paths to fixture files.
 */
export const FIX = {
  csv: path.resolve(__dirname, "../fixtures", "simple.csv"),
  tsv: path.resolve(__dirname, "../fixtures", "data.tsv"),
  xlsx: path.resolve(__dirname, "../fixtures", "multi.xlsx"),
  xls: path.resolve(__dirname, "../fixtures", "legacy.xls"),
  groups: path.resolve(__dirname, "../fixtures", "groups.csv"),
} as const;

/** Returns a WebdriverIO element for a data-testid attribute (use T constants). */
export function tid(name: string) {
  return $(`[data-testid="${name}"]`);
}

/** Returns a WebdriverIO element for a grid cell by zero-based row/col index. */
export function cell(r: number, c: number) {
  return $(`[data-r="${r}"][data-c="${c}"]`);
}

/**
 * Collects window.__coverage__ from the browser and writes it to .nyc_output as a
 * uniquely-named JSON chunk. Safe to call even when coverage is absent (non-instrumented
 * builds) — errors are silently swallowed so tests are never broken by a missing build flag.
 */
export async function dumpCoverage(): Promise<void> {
  // Only pull coverage when explicitly collecting (the e2e gate run sets
  // E2E_COVERAGE). Skipped during ad-hoc `bun run test` debugging: serializing the
  // whole window.__coverage__ object makes tauri-webdriver dump it to stdout,
  // flooding the spec output with hash/inputSourceMap noise.
  if (!process.env.E2E_COVERAGE) return;
  const cov = await browser.execute(() => window.__coverage__);
  if (cov) {
    const dir = path.resolve(__dirname, "../../.nyc_output");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `e2e-${crypto.randomUUID()}.json`),
      JSON.stringify(cov),
    );
  }
}

/**
 * Resets app state for a clean test: forces English locale, clears recent files,
 * reloads the page, and waits for the __E2E__ hook to be available.
 * Captures any accumulated coverage BEFORE the reload resets window.__coverage__.
 */
export async function prepareApp(): Promise<void> {
  await browser.execute(() => {
    // Reset persisted state so specs don't leak into each other. file-state
    // carries per-file header marks/filters — leaking it makes 13 (mark-header)
    // and 05 (filter anchors) order-dependent. Language key is "lazysheet:language".
    localStorage.setItem("lazysheet:language", "en");
    localStorage.removeItem("lazysheet:recent");
    localStorage.removeItem("lazysheet:file-state");
    localStorage.removeItem("summary-panel:copy-format");
    localStorage.removeItem("lazysheet:default-copy-format");
    localStorage.removeItem("lazysheet:sql-dialect");
    for (const key of Object.keys(localStorage)) {
      if (
        key.startsWith("lazysheet:sql-table:") ||
        key.startsWith("lazysheet:sql-keys:")
      ) {
        localStorage.removeItem(key);
      }
    }
  });
  try {
    await dumpCoverage();
  } catch {
    // coverage absent in non-instrumented builds — must not break tests
  }
  await browser.execute(() => location.reload());
  await browser.waitUntil(
    async () => await browser.execute(() => !!window.__E2E__),
    {
      timeout: 20000,
      timeoutMsg:
        "__E2E__ hook missing — was the app built with VITE_E2E=true?",
    },
  );
}

/**
 * Opens a fixture file via the __E2E__ hook and waits for the grid to render.
 * @param absPath - Absolute path to the fixture file.
 */
export async function openFixture(absPath: string): Promise<void> {
  // __E2E__.open returns a Promise; execute/sync would try to serialize it and
  // WebKit rejects that ("unsupported type"). Await it via executeAsync instead.
  const err = await browser.executeAsync(
    (p: string, done: (r: string | null) => void) => {
      window.__E2E__
        .open(p)
        .then(() => done(null))
        .catch((e) => done(String(e)));
    },
    absPath,
  );
  if (err) throw new Error(`__E2E__.open failed: ${err}`);
  await tid("grid-scroll-container").waitForDisplayed({ timeout: 20000 });
}

/**
 * Reads the clipboard contents via the __E2E__ hook (uses Tauri clipboard plugin).
 */
export async function readClipboard(): Promise<string> {
  // readClipboard returns a Promise<string>; await it browser-side so a plain
  // string crosses the WebDriver boundary (execute/sync can't serialize a Promise).
  return browser.executeAsync((done: (t: string) => void) => {
    window.__E2E__
      .readClipboard()
      .then((t) => done(t))
      .catch(() => done(""));
  });
}

/**
 * Forces DOM focus onto the grid scroll container so keyboard events are
 * reliably captured by the grid regardless of WebKit pointer-focus quirks.
 */
export async function focusGrid(): Promise<void> {
  await browser.execute(() => {
    const el = document.querySelector('[data-testid="grid-scroll-container"]');
    if (el) (el as HTMLElement).focus();
  });
}

/**
 * Dispatches a synthetic keydown on the grid container with explicit modifiers.
 * Needed because tauri-webdriver/WebKit's browser.keys() delivers modifier+letter
 * chords (Ctrl+F) but NOT modifier+navigation chords (Shift+ArrowRight, Ctrl+Home)
 * — the arrow keydown is dropped. A dispatched KeyboardEvent bubbles to React's
 * root listener, so the grid's onKeyDown (and window-level shortcuts) fire with
 * the modifiers we set.
 * @param key - KeyboardEvent.key value (e.g. "ArrowRight", "Home", "y").
 * @param mods - Modifier flags to set on the event.
 */
export async function gridKey(key: string, mods: KeyMods = {}): Promise<void> {
  const { shift = false, ctrl = false, meta = false, alt = false } = mods;
  await browser.execute(
    (k: string, s: boolean, c: boolean, m: boolean, a: boolean) => {
      const el =
        document.querySelector('[data-testid="grid-scroll-container"]') ||
        document.activeElement ||
        document.body;
      const init: KeyboardEventInit = {
        key: k,
        shiftKey: s,
        ctrlKey: c,
        metaKey: m,
        altKey: a,
        bubbles: true,
        cancelable: true,
      };
      el.dispatchEvent(new KeyboardEvent("keydown", init));
      el.dispatchEvent(new KeyboardEvent("keyup", init));
    },
    key,
    shift,
    ctrl,
    meta,
    alt,
  );
}

/**
 * Pointer-free, driver-chord-free single-cell selection via synthetic key dispatch:
 * focus the grid, jump to the first cell (Ctrl+Home sets a known anchor), then step
 * to (r, c). See {@link gridKey} for why browser.keys can't do this.
 * @param r - Zero-based row index.
 * @param c - Zero-based column index.
 */
export async function selectCell(r: number, c: number): Promise<void> {
  const el = cell(r, c);
  await el.waitForDisplayed({ timeout: 10000 });
  await focusGrid();
  await gridKey("Home", { ctrl: true });
  for (let i = 0; i < r; i++) await gridKey("ArrowDown");
  for (let i = 0; i < c; i++) await gridKey("ArrowRight");
}

/**
 * Builds a multi-cell rectangular selection from the current anchor by holding
 * Shift and stepping right `cols` times then down `rows` times (synthetic keys).
 */
export async function extendSelection(
  rows: number,
  cols: number,
): Promise<void> {
  for (let i = 0; i < cols; i++) await gridKey("ArrowRight", { shift: true });
  for (let i = 0; i < rows; i++) await gridKey("ArrowDown", { shift: true });
}

/**
 * Dispatches synthetic pointer events (pointerdown + pointerup + click) at the
 * element's center via browser.execute. Required for Radix DropdownMenuTrigger
 * on macOS WebKit where a normal WDIO .click() does not open the menu.
 * @param selector - CSS selector for the target element.
 */
export async function synthPointerClick(selector: string): Promise<void> {
  await browser.execute((s: string) => {
    const el = document.querySelector(s);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const o = {
      bubbles: true,
      cancelable: true,
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
    };
    el.dispatchEvent(new PointerEvent("pointerdown", o));
    el.dispatchEvent(new PointerEvent("pointerup", o));
    el.dispatchEvent(new MouseEvent("click", o));
  }, selector);
}

/**
 * Selects (clicks) a menu item by testid using synthetic pointer events.
 * Radix ContextMenu leaf items do not reliably fire onSelect from a normal
 * WDIO .click() on WebKit; synthetic pointerup does.
 * @param testid - data-testid of the menu item.
 */
export async function synthClickItem(testid: string): Promise<void> {
  await tid(testid).waitForDisplayed({ timeout: 5000 });
  await synthPointerClick(`[data-testid="${testid}"]`);
}

/**
 * Dispatches a synthetic WheelEvent with ctrlKey=true on the grid scroll
 * container. Negative deltaY zooms in; positive deltaY zooms out.
 * @param deltaY - Wheel delta; negative = zoom in, positive = zoom out.
 */
export async function dispatchCtrlWheel(deltaY: number): Promise<void> {
  await browser.execute((dy: number) => {
    const el = document.querySelector('[data-testid="grid-scroll-container"]');
    if (!el) return;
    el.dispatchEvent(
      new WheelEvent("wheel", {
        ctrlKey: true,
        deltaY: dy,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, deltaY);
}

/**
 * Returns the current grid zoom level via window.__E2E__.getZoom().
 */
export async function getZoom(): Promise<number> {
  return browser.execute(() => window.__E2E__.getZoom?.() ?? 1);
}

/**
 * Opens a Radix DropdownMenu by dispatching ONLY pointerdown+pointerup on the
 * trigger (NO click — a trailing click can toggle the just-opened menu shut,
 * which made opens flaky). Radix opens on pointerdown.
 */
export async function synthPointerOpen(selector: string): Promise<void> {
  await browser.execute((s: string) => {
    const el = document.querySelector(s);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const o = {
      bubbles: true,
      cancelable: true,
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
    };
    el.dispatchEvent(new PointerEvent("pointerdown", o));
    el.dispatchEvent(new PointerEvent("pointerup", o));
  }, selector);
}

/**
 * Opens a dropdown by its toggle (synthetic pointer), waits for an item by testid,
 * then clicks it with a normal WDIO click (items accept normal clicks once open).
 * @param toggleTestid - data-testid of the trigger button.
 * @param itemTestid   - data-testid of the menu item to click.
 */
export async function openDropdownItem(
  toggleTestid: string,
  itemTestid: string,
): Promise<void> {
  const item = tid(itemTestid);
  await synthPointerOpen(`[data-testid="${toggleTestid}"]`);
  try {
    await item.waitForDisplayed({ timeout: 3000 });
  } catch {
    // Retry the open once if the menu didn't appear.
    await synthPointerOpen(`[data-testid="${toggleTestid}"]`);
    await item.waitForDisplayed({ timeout: 3000 });
  }
  await item.click();
}

/**
 * Opens a Radix Select by dispatching ONLY pointerdown on its trigger, then
 * clicks an option by testid.
 *
 * Unlike DropdownMenu, Radix Select treats pointerdown→pointerup at the same
 * point as open-then-commit-and-close: the trailing pointerup lands on the
 * trigger position (item-aligned anchors the selected item there), commits that
 * item and closes the listbox — also tearing down the parent Popover on WebKit.
 * So we omit pointerup on open and let the Select stay open.
 *
 * Two robustness steps follow the open:
 *  1. Wait on the listbox container ([data-slot="select-content"]) — not the
 *     target item — to confirm the Select actually opened. This gives the retry
 *     a correct signal and disambiguates an open-flake from a clipped item.
 *  2. item-aligned listboxes clip to ~5 items in an overflow:hidden viewport, so
 *     an option past the fold (e.g. isExactly, index 7 of 14) is in the DOM but
 *     not "displayed". scrollIntoView pulls it into the viewport before we assert
 *     visibility and click.
 * @param toggleTestid - data-testid of the SelectTrigger.
 * @param itemTestid   - data-testid of the SelectItem to choose.
 */
export async function openSelectItem(
  toggleTestid: string,
  itemTestid: string,
): Promise<void> {
  const trigger = `[data-testid="${toggleTestid}"]`;
  const item = tid(itemTestid);
  const content = $('[data-slot="select-content"]');

  const probe = (label: string) =>
    browser.execute(
      (trigSel: string, lab: string) => {
        const trig = document.querySelector(trigSel);
        const c = document.querySelector('[data-slot="select-content"]');
        const panel = document.querySelector('[data-testid="filter-panel"]');
        return (
          lab +
          " trig=" + !!trig +
          " trigState=" + (trig?.getAttribute("data-state") ?? "?") +
          " panel=" + !!panel +
          " content=" + !!c
        );
      },
      trigger,
      label,
    );
  const before = await probe("BEFORE");
  await tid(toggleTestid).click();
  await browser.pause(500);
  const after = await probe("AFTER");
  throw new Error("DIAG | " + before + " || " + after);
  try {
    await content.waitForDisplayed({ timeout: 3000 });
  } catch {
    await synthPointerDown(trigger);
    await content.waitForDisplayed({ timeout: 3000 });
  }

  // The item exists in the DOM once the listbox mounts (Radix renders all
  // options); pull it into the clipped viewport before asserting visibility.
  await item.waitForExist({ timeout: 3000 });
  await browser.execute((sel: string) => {
    document.querySelector(sel)?.scrollIntoView({ block: "center" });
  }, `[data-testid="${itemTestid}"]`);

  await item.waitForDisplayed({ timeout: 3000 });
  await item.click();
}

/**
 * Dispatches ONLY a synthetic pointerdown at the element's center. Radix Select
 * opens on pointerdown; a trailing pointerup would commit+close it (see
 * openSelectItem).
 */
export async function synthPointerDown(selector: string): Promise<void> {
  await browser.execute((s: string) => {
    const el = document.querySelector(s);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const o = {
      bubbles: true,
      cancelable: true,
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
    };
    el.dispatchEvent(new PointerEvent("pointerdown", o));
  }, selector);
}

/**
 * Installs a clipboard-write interceptor. The app copies via
 * navigator.clipboard.writeText, but the e2e Tauri readText() reads a different
 * clipboard under the WebKit driver, so reads come back empty. This records the
 * last written text on window.__e2eClip; pair with readCopied(). Persists until
 * the page reloads, so call after each openFixture (or once after prepareApp).
 */
export async function installClipboardCapture(): Promise<void> {
  await browser.execute(() => {
    if (window.__e2eClipInstalled) return;
    window.__e2eClip = "";
    const orig =
      navigator.clipboard && navigator.clipboard.writeText
        ? navigator.clipboard.writeText.bind(navigator.clipboard)
        : null;
    navigator.clipboard.writeText = (t: string) => {
      window.__e2eClip = String(t);
      return orig ? orig(t).catch(() => {}) : Promise.resolve();
    };
    window.__e2eClipInstalled = true;
  });
}

/** Returns the last text the app copied via navigator.clipboard.writeText. */
export async function readCopied(): Promise<string> {
  return browser.execute(() => window.__e2eClip || "");
}

/**
 * Dispatches a synthetic keydown on a specific element (not the grid). Used to
 * deliver Escape to the focus-sensitive SummaryPanel onKeyDown handler.
 */
export async function dispatchKeyOn(
  selector: string,
  key: string,
): Promise<void> {
  await browser.execute(
    (s: string, k: string) => {
      const el = document.querySelector(s);
      if (el)
        el.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: k,
            bubbles: true,
            cancelable: true,
          }),
        );
    },
    selector,
    key,
  );
}

/**
 * Dispatches a synthetic contextmenu MouseEvent at the element's center via
 * browser.execute. Required for Radix ContextMenu on macOS WebKit where a
 * native right-click does not fire the contextmenu event that Radix listens for.
 * @param selector - CSS selector for the target element.
 */
export async function openContextMenuAt(selector: string): Promise<void> {
  await browser.execute((s: string) => {
    const el = document.querySelector(s);
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
      }),
    );
  }, selector);
}

/**
 * Marks the given row as a header row via the row-header context menu. Idempotent:
 * returns early if a filter-column button is already displayed (header already set).
 * @param row - Zero-based row index to mark as header (defaults to 0).
 */
export async function markHeader(row = 0): Promise<void> {
  const filterBtns = await $$('[aria-label="Filter column"]');
  for (const btn of filterBtns) {
    if (await btn.isDisplayed()) return;
  }
  const rh = $(`[data-row-header="${row}"]`);
  await rh.waitForDisplayed({ timeout: 10000 });
  await openContextMenuAt(`[data-row-header="${row}"]`);
  await tid(T.contextMenu).waitForDisplayed({ timeout: 5000 });
  await synthClickItem("ctx-mark-header");
  await tid(T.contextMenu).waitForDisplayed({ timeout: 3000, reverse: true });
}

/**
 * Opens the summary panel over a rectangular range starting at (r, c) and
 * extending by the given number of additional rows and columns.
 * @param r    - Zero-based starting row index.
 * @param c    - Zero-based starting column index.
 * @param rows - Number of additional rows to include in the selection.
 * @param cols - Number of additional columns to include in the selection.
 */
export async function openSummary(
  r: number,
  c: number,
  rows: number,
  cols: number,
): Promise<void> {
  await selectCell(r, c);
  await extendSelection(rows, cols);
  // Ctrl+Shift+Y TOGGLES the panel. Specs reuse one loaded file across multiple
  // `it`s (openFixture does not reload), so a panel left open by a prior test
  // would be closed by a blind toggle. Only fire the shortcut when it's closed.
  const alreadyOpen = await tid(T.summaryPanel)
    .isDisplayed()
    .catch(() => false);
  if (!alreadyOpen) {
    await gridKey("y", { ctrl: true, shift: true });
  }
  await tid(T.summaryPanel).waitForDisplayed({ timeout: 10000 });
}
