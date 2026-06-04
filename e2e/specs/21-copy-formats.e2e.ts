/**
 * Spec 21 — Copy formats
 *
 * Opens a CSV fixture, selects A1:C3, and verifies every copy-format leaf
 * produces correctly shaped clipboard output via the context-menu Copy subtree.
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
} from "../helpers/app.js";

/** Navigate the context-menu Copy subtree and click a leaf item.
 *  @param leaf        - data-testid of the final leaf menu item to click.
 *  @param viaMarkdown - When true, click the "ctx-copy-markdown" subtrigger first.
 */
async function copyLeaf(leaf: string, viaMarkdown = false): Promise<void> {
  await openContextMenuAt('[data-r="0"][data-c="0"]');
  await browser.pause(200);
  await tid(T.contextMenu).waitForDisplayed({ timeout: 8000 });
  await tid("ctx-copy").click();
  await browser.pause(200);
  if (viaMarkdown) {
    await tid("ctx-copy-markdown").click();
    await browser.pause(200);
  }
  await synthClickItem(leaf);
  await browser.pause(300);
}

describe("copy-formats", () => {
  before(async () => {
    await prepareApp();
  });

  // Shared setup for each test: open fixture, install capture, mark header,
  // select A1:C3 (row 0 col 0, extend 2 rows 2 cols).
  beforeEach(async () => {
    await openFixture(FIX.csv);
    await installClipboardCapture();
    await markHeader(0);
    await selectCell(0, 0);
    await extendSelection(2, 2);
  });

  it("CSV (CRLF)", async () => {
    await copyLeaf("ctx-copy-csv");
    const c = await readCopied();
    expect(c.includes("\r\n")).toBe(true);
    expect(c.startsWith("Name,Age,City")).toBe(true);
  });

  it("TSV", async () => {
    await copyLeaf("ctx-copy-tsv");
    const c = await readCopied();
    expect(c.includes("Name\tAge\tCity")).toBe(true);
  });

  it("ASCII table", async () => {
    await copyLeaf("ctx-copy-ascii");
    const c = await readCopied();
    expect(c.includes("+")).toBe(true);
    expect(c.includes("| Name")).toBe(true);
  });

  it("Plain text", async () => {
    await copyLeaf("ctx-copy-plain");
    const c = await readCopied();
    expect(c.includes("Name\tAge\tCity")).toBe(true);
  });

  it("Markdown inline", async () => {
    await copyLeaf("ctx-copy-inline", true);
    const c = await readCopied();
    expect(c.includes("Name: Ada")).toBe(true);
  });

  it("Markdown title", async () => {
    await copyLeaf("ctx-copy-title", true);
    const c = await readCopied();
    expect(c.includes("### Name")).toBe(true);
  });

  it("Markdown table", async () => {
    await copyLeaf("ctx-copy-table", true);
    const c = await readCopied();
    expect(c).toMatch(/\|\s*-+/);
    expect(c.includes("| Name")).toBe(true);
  });
});
