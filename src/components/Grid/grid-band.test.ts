import { describe, expect, it } from "vitest";
import { headerBandStuck } from "./grid-utils";

describe("headerBandStuck", () => {
  // The reported bug: header is the first row (start=0). At the top the band
  // must NOT render, else it double-renders over the in-flow header row.
  it("row-0 header at top is not stuck", () => {
    expect(headerBandStuck(0, 0)).toBe(false);
  });

  // Sticky feature preserved: once a row-0 header scrolls away, band shows.
  it("row-0 header scrolled down is stuck", () => {
    expect(headerBandStuck(500, 0)).toBe(true);
  });

  // Returning to the top must unlatch (the `>=` bug latched permanently).
  it("row-0 header back at top unlatches", () => {
    expect(headerBandStuck(0, 0)).toBe(false);
  });

  // Mid-sheet header flush at the ruler bottom is fully visible → not stuck.
  it("mid-sheet header flush under ruler is not stuck", () => {
    expect(headerBandStuck(100, 100)).toBe(false);
  });

  it("mid-sheet header scrolled above ruler is stuck", () => {
    expect(headerBandStuck(101, 100)).toBe(true);
  });

  it("mid-sheet header not yet reached is not stuck", () => {
    expect(headerBandStuck(50, 100)).toBe(false);
  });
});
