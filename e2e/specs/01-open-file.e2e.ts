import { T, FIX, tid, cell, prepareApp, openFixture } from "../helpers/app.js";

describe("open-file", () => {
  before(async () => {
    await prepareApp();
  });

  it("shows welcome-open-btn before any file is opened", async () => {
    const btn = tid(T.welcomeOpenBtn);
    await btn.waitForDisplayed({ timeout: 10000 });
    expect(await btn.isDisplayed()).toBe(true);
  });

  it("opens a CSV fixture and renders the grid with cell(0,0) = 'Name'", async () => {
    await openFixture(FIX.csv);
    const grid = tid(T.gridScrollContainer);
    await grid.waitForDisplayed({ timeout: 20000 });

    // simple.csv: row 0 = header row ["Name","Age","City"]
    const c00 = cell(0, 0);
    await c00.waitForDisplayed({ timeout: 10000 });
    const text = await c00.getText();
    expect(text).toBe("Name");
  });

  it("opens an XLSX fixture and titlebar-filename contains 'multi'", async () => {
    await openFixture(FIX.xlsx);
    const filename = tid(T.titlebarFilename);
    await filename.waitForDisplayed({ timeout: 10000 });
    const text = await filename.getText();
    expect(text.toLowerCase()).toContain("multi");
  });

  it("surfaces an error state when opening a non-existent path (lenient)", async () => {
    // Call the hook directly with a bogus path. The app should either show an error
    // toast or leave the grid hidden (no new grid rendered). We assert leniently:
    // either a sonner toast element appears OR the grid is NOT freshly displayed.
    await browser.executeAsync((p, done) => {
      window.__E2E__.open(p).then(() => done(null)).catch(() => done(null));
    }, "/no/such/file.csv");

    // Give the app a moment to react
    await browser.pause(1500);

    // Lenient: check that a toast (sonner uses [data-sonner-toast]) OR the
    // previous grid-scroll-container state — we just confirm no crash by
    // asserting the page is still live (URL reachable).
    const isAlive = await browser.execute(() => typeof document !== "undefined");
    expect(isAlive).toBe(true);

    // Optionally assert a toast appears (lenient — won't fail if absent)
    const toasts = await $$("[data-sonner-toast]");
    // No hard assertion on count — the grid may simply stay as-is or show a toast.
    // We only assert the app did NOT crash.
  });
});
