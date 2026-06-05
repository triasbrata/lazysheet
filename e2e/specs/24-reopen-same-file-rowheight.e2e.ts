import {
  T,
  FIX,
  tid,
  prepareApp,
  openFixture,
  openContextMenuAt,
  synthClickItem,
} from "../helpers/app.js";

// Regression witness for the `reopen-same-file-rowheight` grid bug.
//
// Bug: re-opening the SAME already-open file produces a fresh sheet object →
// Grid's sheet-change effect calls rowVirtualizer.measure() which WIPES TanStack's
// itemSizeCache. The marked funnel-header row's true (~28px) height lived only in
// that cache (never persisted). Because reopen reuses DOM nodes (stable row-index
// keys), measureElement/ResizeObserver don't reliably re-fire to reseed → the
// header row stays at the collapsed estimate (~20-24px) and funnel icons overlap
// the header text. Fix (Grid.tsx): after the cache wipe, seed pendingMeasureRowsRef
// with the rendered rows so the existing useLayoutEffect force-reads real DOM
// height pre-paint. This spec asserts the header height survives a reopen.

/** Height (px) of the marked header row's first cell, or -1 if absent. */
function headerRowHeight(): Promise<number> {
  return browser.execute(() => {
    const el = document.querySelector('[data-r="0"][data-c="0"]') as HTMLElement | null;
    return el ? el.getBoundingClientRect().height : -1;
  });
}

/** Wait until at least one filter funnel is visible (marked-header confirmed). */
async function waitFunnelVisible(timeout = 10000): Promise<void> {
  await browser.waitUntil(
    async () => {
      for (const b of await $$('[aria-label="Filter column"]')) {
        if (await b.isDisplayed().catch(() => false)) return true;
      }
      return false;
    },
    { timeout, timeoutMsg: "filter funnel never became visible" },
  );
}

// Right-click row 0 header → "Mark as header". Adds the funnel row and grows it
// to fit the funnel icon (~28px). NOT idempotent — the testid ctx-mark-header
// toggles mark/unmark, so call exactly once on an unmarked sheet.
async function markHeaderRow(): Promise<void> {
  const rh = $('[data-row-header="0"]');
  await rh.waitForDisplayed({ timeout: 10000 });
  await rh.click();

  // The synthetic contextmenu event is occasionally dropped right after a fixture
  // load (grid/handler not fully settled). Retry the open until the menu appears.
  await browser.waitUntil(
    async () => {
      await openContextMenuAt('[data-row-header="0"]');
      return tid(T.contextMenu)
        .waitForDisplayed({ timeout: 1000 })
        .then(() => true)
        .catch(() => false);
    },
    { timeout: 10000, timeoutMsg: "row-header context menu never opened" },
  );
  await synthClickItem("ctx-mark-header");
  await tid(T.contextMenu).waitForDisplayed({ timeout: 3000, reverse: true });
}

describe("reopen-same-file-rowheight", () => {
  before(async () => {
    await prepareApp();
  });

  it("keeps the funnel header row tall after re-opening the same file", async () => {
    await openFixture(FIX.csv);
    // Wait for the grid to actually render before driving the row header.
    await $('[data-r="0"][data-c="0"]').waitForDisplayed({ timeout: 10000 });
    await markHeaderRow();
    await waitFunnelVisible();

    // Baseline: the funnel header row at its correct (grown) height.
    const tall = await headerRowHeight();

    // Re-open the SAME file — this is the bug trigger (fresh sheet → cache wipe →
    // reused DOM nodes → header would collapse without the Grid.tsx remeasure fix).
    await openFixture(FIX.csv);
    await waitFunnelVisible();

    // After reopen the header must NOT collapse. Allow 2px jitter vs the baseline;
    // the bug drops it ~4-8px (28 → 20-24).
    await browser.waitUntil(
      async () => (await headerRowHeight()) >= tall - 2,
      {
        timeout: 10000,
        timeoutMsg: `Funnel header row collapsed after reopen (was ${tall}px, now too short) — reopen-same-file remeasure regression`,
      },
    );
  });
});
