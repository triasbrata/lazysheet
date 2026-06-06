import { describe, it, expect, vi, afterEach } from "vitest";
import { parseFlag, flags } from "./feature-flags";

// ── parseFlag ────────────────────────────────────────────────────────────────

describe("parseFlag", () => {
  it("undefined → true (absent, default defaultValue=true)", () => {
    expect(parseFlag(undefined)).toBe(true);
  });

  it("undefined with defaultValue=false → false", () => {
    expect(parseFlag(undefined, false)).toBe(false);
  });

  it("undefined with defaultValue=true → true (explicit)", () => {
    expect(parseFlag(undefined, true)).toBe(true);
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
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is an object (smoke test)", () => {
    expect(typeof flags).toBe("object");
    expect(flags).not.toBeNull();
  });

  it("flags.multiLang is true in test env (VITE_FF_MULTI_LANG=true set by vitest config)", () => {
    // vitest.config.ts sets VITE_FF_MULTI_LANG="true" so flags.multiLang is true
    expect(flags.multiLang).toBe(true);
  });

  it("flags.multiLang is false when VITE_FF_MULTI_LANG is absent (real default-OFF)", async () => {
    // Simulate the real production default: env var absent → parseFlag(undefined, false) → false
    vi.stubEnv("VITE_FF_MULTI_LANG", undefined as unknown as string);
    vi.resetModules();
    const { flags: freshFlags } = await vi.importFresh<typeof import("./feature-flags")>(
      "@/lib/feature-flags",
    );
    expect(freshFlags.multiLang).toBe(false);
  });
});
