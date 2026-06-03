import { describe, it, expect } from "vitest";
import { selectionRowSpan } from "./grid-utils";

describe("selectionRowSpan", () => {
  const measurements = [
    { index: 0, start: 0, end: 20, size: 20 },
    { index: 1, start: 20, end: 48, size: 28 },
    { index: 2, start: 48, end: 70, size: 22 },
  ];

  it("identity: returns correct bounds when visiblePos maps absolute rows 1:1", () => {
    const visiblePos = new Map([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
    expect(selectionRowSpan(0, 2, visiblePos, measurements)).toEqual({
      top: 0,
      bottom: 70,
    });
  });

  it("filtered: translates absolute rows through visiblePos correctly", () => {
    const visiblePos = new Map([
      [19, 0],
      [56, 1],
      [93, 2],
    ]);
    expect(selectionRowSpan(19, 93, visiblePos, measurements)).toEqual({
      top: 0,
      bottom: 70,
    });
    expect(selectionRowSpan(56, 56, visiblePos, measurements)).toEqual({
      top: 20,
      bottom: 48,
    });
  });

  it("filtered-out bound: returns null when a bound row is not in visiblePos", () => {
    const visiblePos = new Map([
      [19, 0],
      [93, 2],
    ]);
    // row 56 is not in visiblePos
    expect(selectionRowSpan(19, 56, visiblePos, measurements)).toBeNull();
  });

  it("missing measurement: returns null when visiblePos maps to an out-of-range index", () => {
    const visiblePos = new Map([
      [19, 0],
      [56, 5], // index 5 does not exist in measurements
    ]);
    expect(selectionRowSpan(19, 56, visiblePos, measurements)).toBeNull();
  });
});
