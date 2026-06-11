import { describe, it, expect } from "vitest";
import { parseRgb } from "@/lib/native-window";

describe("parseRgb", () => {
  it("parses a standard rgb() string", () => {
    expect(parseRgb("rgb(12, 34, 56)")).toEqual({ r: 12, g: 34, b: 56 });
  });

  it("parses an rgba() string and ignores alpha", () => {
    expect(parseRgb("rgba(1, 2, 3, 0.5)")).toEqual({ r: 1, g: 2, b: 3 });
  });

  it("returns null for 'transparent'", () => {
    expect(parseRgb("transparent")).toBe(null);
  });

  it("returns null for empty string", () => {
    expect(parseRgb("")).toBe(null);
  });

  it("parses rgb() without spaces", () => {
    expect(parseRgb("rgb(255,0,128)")).toEqual({ r: 255, g: 0, b: 128 });
  });
});
