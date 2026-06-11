import { describe, it, expect } from "vitest";

import {
  THEME_PRESETS,
  getPreset,
  resolveBase,
} from "@/lib/themes";

// ---------------------------------------------------------------------------
// (a) All preset ids are unique
// ---------------------------------------------------------------------------

describe("THEME_PRESETS — uniqueness", () => {
  it("all preset ids are unique", () => {
    const ids = THEME_PRESETS.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// (b) "light" and "dark" presets exist and have palette === false
// ---------------------------------------------------------------------------

describe("THEME_PRESETS — built-in defaults", () => {
  it("'light' preset exists with palette === false", () => {
    const p = getPreset("light");
    expect(p).toBeDefined();
    expect(p!.palette).toBe(false);
    expect(p!.base).toBe("light");
  });

  it("'dark' preset exists with palette === false", () => {
    const p = getPreset("dark");
    expect(p).toBeDefined();
    expect(p!.palette).toBe(false);
    expect(p!.base).toBe("dark");
  });
});

// ---------------------------------------------------------------------------
// (c) Every palette:true preset has a name, a swatch, and valid base
// ---------------------------------------------------------------------------

describe("THEME_PRESETS — palette preset invariants", () => {
  const palettePresets = THEME_PRESETS.filter((p) => p.palette);

  it("all palette presets have a non-empty name", () => {
    for (const p of palettePresets) {
      expect(p.name, `preset ${p.id} missing name`).toBeTruthy();
    }
  });

  it("all palette presets have a non-empty swatch", () => {
    for (const p of palettePresets) {
      expect(p.swatch, `preset ${p.id} missing swatch`).toBeTruthy();
    }
  });

  it("all palette presets have base in ['light', 'dark']", () => {
    for (const p of palettePresets) {
      expect(["light", "dark"], `preset ${p.id} has invalid base`).toContain(p.base);
    }
  });

  it("there are at least 20 palette presets", () => {
    expect(palettePresets.length).toBeGreaterThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// (d) resolveBase("system", ...) resolves to the correct default
// ---------------------------------------------------------------------------

describe("resolveBase — system selection", () => {
  it("resolveBase('system', true) returns the 'dark' preset", () => {
    const result = resolveBase("system", true);
    expect(result.id).toBe("dark");
  });

  it("resolveBase('system', false) returns the 'light' preset", () => {
    const result = resolveBase("system", false);
    expect(result.id).toBe("light");
  });
});

// ---------------------------------------------------------------------------
// (e) resolveBase with a known palette id returns that preset
// ---------------------------------------------------------------------------

describe("resolveBase — known palette id", () => {
  it("resolveBase('palenight', false) returns the 'palenight' preset", () => {
    const result = resolveBase("palenight", false);
    expect(result.id).toBe("palenight");
  });

  it("resolveBase('palenight', true) returns the 'palenight' preset", () => {
    const result = resolveBase("palenight", true);
    expect(result.id).toBe("palenight");
  });
});

// ---------------------------------------------------------------------------
// (f) resolveBase with an unknown id falls back to light/dark default
// ---------------------------------------------------------------------------

describe("resolveBase — unknown id fallback", () => {
  it("resolveBase('__nonexistent__', true) falls back to 'dark'", () => {
    const result = resolveBase("__nonexistent__", true);
    expect(result.id).toBe("dark");
  });

  it("resolveBase('__nonexistent__', false) falls back to 'light'", () => {
    const result = resolveBase("__nonexistent__", false);
    expect(result.id).toBe("light");
  });
});

