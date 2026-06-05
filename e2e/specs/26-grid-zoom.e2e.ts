/**
 * Spec 26 — Grid zoom
 *
 * Verifies the full grid-zoom feature:
 *   1. Initial zoom is 1 after opening a fixture.
 *   2. Ctrl+wheel up (negative deltaY) increases zoom; cell width grows proportionally.
 *   3. Ctrl+wheel down (positive deltaY) decreases zoom; clamps at 0.5 floor.
 *   4. StatusBar zoom label shows the rounded percent; clicking label resets to 1.
 *   5. StatusBar zoom-in / zoom-out buttons step ±0.1.
 *   6. Keyboard shortcuts: Ctrl+= zooms in, Ctrl+- out, Ctrl+0 resets.
 *   7. Zoom persists per-file (localStorage, debounce 250ms).
 *   8. Plain wheel (no ctrlKey) does NOT change zoom.
 *
 * Lifecycle: prepareApp once + beforeEach openFixture so each test starts at
 * zoom=1 with a clean file-state (prepareApp clears lazysheet:file-state).
 */

import {
  T,
  FIX,
  tid,
  prepareApp,
  openFixture,
  dispatchCtrlWheel,
  getZoom,
  gridKey,
} from "../helpers/app.js";

/** Pixel tolerance for cell-width comparison. */
const WIDTH_TOLERANCE = 3;

/** Get the bounding rect width of cell(0,0). */
function cell00Width(): Promise<number> {
  return browser.execute(() => {
    const el = document.querySelector('[data-r="0"][data-c="0"]') as HTMLElement | null;
    return el ? el.getBoundingClientRect().width : -1;
  });
}

/**
 * Dispatch a plain (no ctrl) WheelEvent on the grid container.
 */
async function dispatchPlainWheel(deltaY: number): Promise<void> {
  await browser.execute((dy: number) => {
    const el = document.querySelector('[data-testid="grid-scroll-container"]');
    if (!el) return;
    el.dispatchEvent(
      new WheelEvent("wheel", {
        ctrlKey: false,
        deltaY: dy,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, deltaY);
}

describe("grid-zoom", () => {
  before(async () => {
    await prepareApp();
  });

  // Re-open fixture before each test so we always start at zoom=1 with a clean state.
  beforeEach(async () => {
    await openFixture(FIX.csv);
    // Ensure zoom is reset to 1 in case a previous test left it changed
    await browser.execute(() => {
      localStorage.removeItem("lazysheet:file-state");
    });
    await openFixture(FIX.csv);
  });

  it("initial zoom is 1 after opening fixture", async () => {
    const z = await getZoom();
    expect(z).toBe(1);
  });

  it("ctrl+wheel up increases zoom and cell(0,0) grows proportionally", async () => {
    const initialWidth = await cell00Width();
    expect(initialWidth).toBeGreaterThan(0);

    // Dispatch several zoom-in events (negative deltaY = zoom in)
    for (let i = 0; i < 5; i++) {
      await dispatchCtrlWheel(-100);
    }
    await browser.pause(100);

    const z = await getZoom();
    expect(z).toBeGreaterThan(1);

    // Cell width should have grown proportionally (~initialWidth * zoom)
    const newWidth = await cell00Width();
    const expectedWidth = Math.round(initialWidth * z);
    expect(Math.abs(newWidth - expectedWidth)).toBeLessThanOrEqual(WIDTH_TOLERANCE);
  });

  it("ctrl+wheel down decreases zoom and clamps at 0.5 floor", async () => {
    // First zoom in slightly so we have room to go down
    for (let i = 0; i < 3; i++) {
      await dispatchCtrlWheel(100);
    }
    await browser.pause(50);

    const zAfterDown = await getZoom();
    expect(zAfterDown).toBeLessThan(1);

    // Spam many large downward wheel events to hit the floor
    for (let i = 0; i < 50; i++) {
      await dispatchCtrlWheel(500);
    }
    await browser.pause(100);

    const zClamped = await getZoom();
    // Must not go below 0.5
    expect(zClamped).toBeGreaterThanOrEqual(0.5);
    // Should be at (or very near) the floor
    expect(zClamped).toBeLessThanOrEqual(0.52);
  });

  it("statusbar zoom label shows matching percent and click resets to 1", async () => {
    // Zoom in to a non-1 value
    for (let i = 0; i < 3; i++) {
      await dispatchCtrlWheel(-100);
    }
    await browser.pause(100);

    const z = await getZoom();
    expect(z).toBeGreaterThan(1);

    const expectedLabel = `${Math.round(z * 100)}%`;
    const labelEl = tid("statusbar-zoom-label");
    await labelEl.waitForDisplayed({ timeout: 5000 });

    const labelText = await labelEl.getText();
    expect(labelText).toBe(expectedLabel);

    // Click the label to reset
    await labelEl.click();
    await browser.pause(100);

    const zReset = await getZoom();
    expect(zReset).toBe(1);

    const resetLabel = await labelEl.getText();
    expect(resetLabel).toBe("100%");
  });

  it("statusbar zoom-in and zoom-out buttons step ±0.1", async () => {
    const zoomInBtn = tid("statusbar-zoom-in");
    const zoomOutBtn = tid("statusbar-zoom-out");

    await zoomInBtn.waitForDisplayed({ timeout: 5000 });

    // Click zoom-in once — should go from 1.0 to 1.1
    await zoomInBtn.click();
    await browser.pause(100);

    const zIn = await getZoom();
    expect(Math.abs(zIn - 1.1)).toBeLessThanOrEqual(0.01);

    // Click zoom-out once — should go back from 1.1 to 1.0
    await zoomOutBtn.click();
    await browser.pause(100);

    const zOut = await getZoom();
    expect(Math.abs(zOut - 1.0)).toBeLessThanOrEqual(0.01);
  });

  it("keyboard ctrl+= zooms in, ctrl+- zooms out, ctrl+0 resets", async () => {
    // ctrl+= should zoom in from 1.0 to 1.1
    await gridKey("=", { ctrl: true });
    await browser.pause(100);

    const zIn = await getZoom();
    expect(Math.abs(zIn - 1.1)).toBeLessThanOrEqual(0.01);

    // ctrl+- should zoom out back to 1.0
    await gridKey("-", { ctrl: true });
    await browser.pause(100);

    const zOut = await getZoom();
    expect(Math.abs(zOut - 1.0)).toBeLessThanOrEqual(0.01);

    // Zoom in twice, then reset
    await gridKey("=", { ctrl: true });
    await gridKey("=", { ctrl: true });
    await browser.pause(50);
    const zBefore = await getZoom();
    expect(zBefore).toBeGreaterThan(1);

    await gridKey("0", { ctrl: true });
    await browser.pause(100);

    const zReset = await getZoom();
    expect(zReset).toBe(1);
  });

  it("zoom persists per-file: set zoom, wait for debounce, reopen same file, zoom restored", async () => {
    // Zoom to approximately 1.5 using statusbar button (10 clicks from 1.0)
    const zoomInBtn = tid("statusbar-zoom-in");
    await zoomInBtn.waitForDisplayed({ timeout: 5000 });
    for (let i = 0; i < 5; i++) {
      await zoomInBtn.click();
    }
    await browser.pause(100);

    const zSet = await getZoom();
    expect(zSet).toBeGreaterThan(1.0);

    // Wait more than the 250ms debounce so localStorage is written
    await browser.pause(350);

    // Reopen the same fixture — zoom should be restored from localStorage
    await openFixture(FIX.csv);
    await browser.pause(200);

    const zRestored = await getZoom();
    expect(Math.abs(zRestored - zSet)).toBeLessThanOrEqual(0.01);
  });

  it("plain wheel (no ctrl) does NOT change zoom", async () => {
    const zBefore = await getZoom();
    expect(zBefore).toBe(1);

    // Dispatch several plain (non-ctrl) wheel events
    for (let i = 0; i < 5; i++) {
      await dispatchPlainWheel(-100);
    }
    await browser.pause(100);

    const zAfter = await getZoom();
    expect(zAfter).toBe(1);
  });
});
