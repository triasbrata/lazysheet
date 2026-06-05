import { describe, it, expect } from "vitest";
import {
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_STEP,
  DEFAULT_ZOOM,
  clampZoom,
  zoomFromWheel,
  stepZoom,
  formatZoomPercent,
  zoomScaledPx,
} from "./zoom";

// ── constants ────────────────────────────────────────────────────────────────

describe("zoom constants", () => {
  it("ZOOM_MIN is 0.5", () => expect(ZOOM_MIN).toBe(0.5));
  it("ZOOM_MAX is 2.0", () => expect(ZOOM_MAX).toBe(2.0));
  it("ZOOM_STEP is 0.1", () => expect(ZOOM_STEP).toBe(0.1));
  it("DEFAULT_ZOOM is 1.0", () => expect(DEFAULT_ZOOM).toBe(1.0));
});

// ── clampZoom ────────────────────────────────────────────────────────────────

describe("clampZoom", () => {
  it("clamps values below ZOOM_MIN to 0.5", () => {
    expect(clampZoom(0)).toBe(0.5);
    expect(clampZoom(0.1)).toBe(0.5);
    expect(clampZoom(0.49)).toBe(0.5);
  });

  it("clamps values above ZOOM_MAX to 2.0", () => {
    expect(clampZoom(3)).toBe(2.0);
    expect(clampZoom(2.1)).toBe(2.0);
    expect(clampZoom(100)).toBe(2.0);
  });

  it("passes through values within [ZOOM_MIN, ZOOM_MAX]", () => {
    expect(clampZoom(1.0)).toBe(1.0);
    expect(clampZoom(0.5)).toBe(0.5);
    expect(clampZoom(2.0)).toBe(2.0);
    expect(clampZoom(1.5)).toBe(1.5);
  });

  it("rounds to 2 decimal places", () => {
    // 1.006 → 1.01 (rounds up at 3rd decimal)
    expect(clampZoom(1.006)).toBe(1.01);
    // 1.234 truncates to 1.23
    expect(clampZoom(1.234)).toBe(1.23);
    // 0.999 rounds to 1.0
    expect(clampZoom(0.999)).toBe(1.0);
  });
});

// ── zoomFromWheel ────────────────────────────────────────────────────────────

describe("zoomFromWheel", () => {
  it("negative deltaY (scroll up) increases zoom", () => {
    const zoomed = zoomFromWheel(1.0, -100);
    expect(zoomed).toBeGreaterThan(1.0);
  });

  it("positive deltaY (scroll down) decreases zoom", () => {
    const zoomed = zoomFromWheel(1.0, 100);
    expect(zoomed).toBeLessThan(1.0);
  });

  it("snaps to exactly 1.0 when result is within 0.02 of 1", () => {
    // A very small delta produces a result just below 1 — should snap to 1
    const nearOne = zoomFromWheel(1.0, 5);
    expect(nearOne).toBe(1.0);
  });

  it("snaps to exactly 1.0 when result is just above 1", () => {
    const nearOne = zoomFromWheel(1.0, -5);
    expect(nearOne).toBe(1.0);
  });

  it("does not snap when result is outside the 0.02 snap band", () => {
    const zoomed = zoomFromWheel(1.0, -200);
    expect(zoomed).not.toBe(1.0);
    expect(zoomed).toBeGreaterThan(1.0);
  });

  it("clamps at ZOOM_MAX when zooming in from a large value", () => {
    const zoomed = zoomFromWheel(2.0, -1000);
    expect(zoomed).toBe(ZOOM_MAX);
  });

  it("clamps at ZOOM_MIN when zooming out from a small value", () => {
    const zoomed = zoomFromWheel(0.5, 1000);
    expect(zoomed).toBe(ZOOM_MIN);
  });
});

// ── stepZoom ─────────────────────────────────────────────────────────────────

describe("stepZoom", () => {
  it("steps up from 1 to 1.1 with direction 1", () => {
    expect(stepZoom(1.0, 1)).toBe(1.1);
  });

  it("steps down from 1 to 0.9 with direction -1", () => {
    expect(stepZoom(1.0, -1)).toBe(0.9);
  });

  it("stops at ZOOM_MAX (2.0) when stepping up from 2.0", () => {
    expect(stepZoom(2.0, 1)).toBe(2.0);
  });

  it("stops at ZOOM_MAX (2.0) when stepping up from 1.95", () => {
    expect(stepZoom(1.95, 1)).toBe(2.0);
  });

  it("stops at ZOOM_MIN (0.5) when stepping down from 0.5", () => {
    expect(stepZoom(0.5, -1)).toBe(0.5);
  });

  it("stops at ZOOM_MIN (0.5) when stepping down from 0.55", () => {
    expect(stepZoom(0.55, -1)).toBe(0.5);
  });

  it("steps up through several increments without floating point drift", () => {
    let z = 1.0;
    for (let i = 0; i < 5; i++) z = stepZoom(z, 1);
    expect(z).toBe(1.5);
  });
});

// ── formatZoomPercent ────────────────────────────────────────────────────────

describe("formatZoomPercent", () => {
  it('formats 1.0 as "100%"', () => {
    expect(formatZoomPercent(1.0)).toBe("100%");
  });

  it('formats 0.5 as "50%"', () => {
    expect(formatZoomPercent(0.5)).toBe("50%");
  });

  it('formats 1.25 as "125%"', () => {
    expect(formatZoomPercent(1.25)).toBe("125%");
  });

  it('formats 2.0 as "200%"', () => {
    expect(formatZoomPercent(2.0)).toBe("200%");
  });

  it('formats 0.75 as "75%"', () => {
    expect(formatZoomPercent(0.75)).toBe("75%");
  });
});

// ── zoomScaledPx ─────────────────────────────────────────────────────────────

describe("zoomScaledPx", () => {
  it("wraps a logical px value in a calc() against --grid-zoom", () => {
    expect(zoomScaledPx(12)).toBe("calc(12px * var(--grid-zoom, 1))");
  });

  it("handles small padding values", () => {
    expect(zoomScaledPx(2)).toBe("calc(2px * var(--grid-zoom, 1))");
  });

  it("defaults the zoom var to 1 so unzoomed contexts render at logical size", () => {
    expect(zoomScaledPx(12)).toContain("var(--grid-zoom, 1)");
  });
});
