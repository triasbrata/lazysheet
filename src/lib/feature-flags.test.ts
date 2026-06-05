import { describe, it, expect } from "vitest";
import { parseFlag, flags } from "./feature-flags";

// ── parseFlag ────────────────────────────────────────────────────────────────

describe("parseFlag", () => {
  it("undefined → true (absent = default ON)", () => {
    expect(parseFlag(undefined)).toBe(true);
  });

  it('"false" → false', () => {
    expect(parseFlag("false")).toBe(false);
  });

  it('"FALSE" → false (case-insensitive)', () => {
    expect(parseFlag("FALSE")).toBe(false);
  });

  it('" false " → false (trims whitespace)', () => {
    expect(parseFlag(" false ")).toBe(false);
  });

  it('"0" → false', () => {
    expect(parseFlag("0")).toBe(false);
  });

  it('"off" → false', () => {
    expect(parseFlag("off")).toBe(false);
  });

  it('"Off" → false (case-insensitive)', () => {
    expect(parseFlag("Off")).toBe(false);
  });

  it('"true" → true', () => {
    expect(parseFlag("true")).toBe(true);
  });

  it('"1" → true', () => {
    expect(parseFlag("1")).toBe(true);
  });

  it('"on" → true', () => {
    expect(parseFlag("on")).toBe(true);
  });

  it('"" (empty string) → true (default-ON polarity)', () => {
    expect(parseFlag("")).toBe(true);
  });

  it('"yes" → true', () => {
    expect(parseFlag("yes")).toBe(true);
  });

  it("arbitrary garbage string → true", () => {
    expect(parseFlag("definitely-not-a-valid-flag-value")).toBe(true);
  });
});

// ── flags registry ───────────────────────────────────────────────────────────

describe("flags", () => {
  it("is an object (smoke test)", () => {
    expect(typeof flags).toBe("object");
    expect(flags).not.toBeNull();
  });

  it("is empty today (no flags registered yet)", () => {
    expect(Object.keys(flags)).toHaveLength(0);
  });
});
