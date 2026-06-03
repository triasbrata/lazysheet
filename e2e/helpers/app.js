import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  langToggleBtn: "lang-toggle-btn",
  contextMenu: "context-menu",
  statusbar: "statusbar",
  statusbarCellRef: "statusbar-cell-ref",
  titlebar: "titlebar",
  titlebarFilename: "titlebar-filename",
};

/**
 * Absolute paths to fixture files.
 */
export const FIX = {
  csv: path.resolve(__dirname, "../fixtures", "simple.csv"),
  tsv: path.resolve(__dirname, "../fixtures", "data.tsv"),
  xlsx: path.resolve(__dirname, "../fixtures", "multi.xlsx"),
  xls: path.resolve(__dirname, "../fixtures", "legacy.xls"),
};

/**
 * Returns a WebdriverIO element selector for a data-testid attribute.
 * @param {string} name - The testid value (use T constants).
 * @returns {WebdriverIO.Element}
 */
export function tid(name) {
  return $(`[data-testid="${name}"]`);
}

/**
 * Returns a WebdriverIO element selector for a grid cell by row and column index.
 * @param {number} r - Zero-based row index.
 * @param {number} c - Zero-based column index.
 * @returns {WebdriverIO.Element}
 */
export function cell(r, c) {
  return $(`[data-r="${r}"][data-c="${c}"]`);
}

/**
 * Collects window.__coverage__ from the browser and writes it to .nyc_output as a
 * uniquely-named JSON chunk. Safe to call even when coverage is absent (non-instrumented
 * builds) — errors are silently swallowed so tests are never broken by a missing build flag.
 */
export async function dumpCoverage() {
  const cov = await browser.execute(() => window.__coverage__);
  if (cov) {
    const dir = path.resolve(__dirname, "../../.nyc_output");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `e2e-${crypto.randomUUID()}.json`),
      JSON.stringify(cov)
    );
  }
}

/**
 * Resets app state for a clean test: forces English locale, clears recent files,
 * reloads the page, and waits for the __E2E__ hook to be available.
 * Captures any accumulated coverage BEFORE the reload resets window.__coverage__.
 */
export async function prepareApp() {
  await browser.execute(() => {
    localStorage.setItem("lazysheet-language", "en");
    localStorage.removeItem("lazysheet:recent");
  });
  try {
    await dumpCoverage();
  } catch {
    // coverage absent in non-instrumented builds — must not break tests
  }
  await browser.execute(() => location.reload());
  await browser.waitUntil(
    async () => await browser.execute(() => !!window.__E2E__),
    { timeout: 20000, timeoutMsg: "__E2E__ hook missing — was the app built with VITE_E2E=true?" }
  );
}

/**
 * Opens a fixture file via the __E2E__ hook and waits for the grid to render.
 * @param {string} absPath - Absolute path to the fixture file.
 */
export async function openFixture(absPath) {
  await browser.execute((p) => window.__E2E__.open(p), absPath);
  await tid("grid-scroll-container").waitForDisplayed({ timeout: 20000 });
}

/**
 * Reads the clipboard contents via the __E2E__ hook (uses Tauri clipboard plugin).
 * @returns {Promise<string>}
 */
export async function readClipboard() {
  return browser.execute(() => window.__E2E__.readClipboard());
}
