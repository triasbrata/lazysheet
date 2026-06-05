import { describe, it, expect, vi, afterEach } from "vitest";

// Mock LanguageDetector to a no-op plugin so it doesn't attempt to read
// browser APIs (localStorage, navigator.language) during JSDOM init.
vi.mock("i18next-browser-languagedetector", () => ({
  default: {
    type: "languageDetector" as const,
    async: false,
    init: vi.fn(),
    detect: vi.fn(() => "en"),
    cacheUserLanguage: vi.fn(),
  },
}));

import i18n from "@/i18n/index";

describe("i18n instance", () => {
  it("is initialized (isInitialized is true)", () => {
    expect(i18n.isInitialized).toBe(true);
  });

  it("has fallbackLng set to 'en'", () => {
    // i18next normalises fallbackLng to an array internally
    const fallback = i18n.options.fallbackLng;
    const asArray = Array.isArray(fallback) ? fallback : [fallback];
    expect(asArray).toContain("en");
  });

  it("has the 'en' resource namespace registered", () => {
    const bundle = i18n.getResourceBundle("en", "translation");
    expect(bundle).toBeDefined();
    expect(typeof bundle).toBe("object");
    // Spot-check: the en locale is non-empty
    expect(Object.keys(bundle as object).length).toBeGreaterThan(0);
  });

  it("has 'id' resource namespace registered", () => {
    const bundle = i18n.getResourceBundle("id", "translation");
    expect(bundle).toBeDefined();
    expect(Object.keys(bundle as object).length).toBeGreaterThan(0);
  });

  it("has 'zh' resource namespace registered", () => {
    const bundle = i18n.getResourceBundle("zh", "translation");
    expect(bundle).toBeDefined();
    expect(Object.keys(bundle as object).length).toBeGreaterThan(0);
  });

  it("has 'es' resource namespace registered", () => {
    const bundle = i18n.getResourceBundle("es", "translation");
    expect(bundle).toBeDefined();
    expect(Object.keys(bundle as object).length).toBeGreaterThan(0);
  });

  it("has a defined language", () => {
    expect(i18n.language).toBeDefined();
    expect(typeof i18n.language).toBe("string");
  });

  it("has defaultNS set to 'translation'", () => {
    expect(i18n.options.defaultNS).toBe("translation");
  });

  it("has supportedLngs including all four languages", () => {
    const supported = i18n.options.supportedLngs as string[];
    expect(supported).toContain("en");
    expect(supported).toContain("id");
    expect(supported).toContain("zh");
    expect(supported).toContain("es");
  });

  it("has interpolation.escapeValue set to false", () => {
    expect(i18n.options.interpolation?.escapeValue).toBe(false);
  });

  it("has detection options when flag is ON (default)", () => {
    // When VITE_FF_MULTI_LANG is not set (or truthy), detection block is present
    expect(i18n.options.detection).toBeDefined();
  });
});

describe("i18n — VITE_FF_MULTI_LANG=false (flag OFF)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("resolves language to DEFAULT_LANGUAGE ('en') regardless of localStorage", async () => {
    // Pre-set a localStorage value that LanguageDetector would normally pick up
    localStorage.setItem("i18n-lang", "id");

    vi.stubEnv("VITE_FF_MULTI_LANG", "false");
    vi.resetModules();

    // Re-mock LanguageDetector for the fresh module graph
    vi.mock("i18next-browser-languagedetector", () => ({
      default: {
        type: "languageDetector" as const,
        async: false,
        init: vi.fn(),
        detect: vi.fn(() => "id"),
        cacheUserLanguage: vi.fn(),
      },
    }));

    const { default: freshI18n } = await import("@/i18n/index");

    // When flag is OFF, lng is hardcoded to DEFAULT_LANGUAGE ("en"),
    // so the language should be "en" regardless of localStorage/navigator
    expect(freshI18n.language).toBe("en");

    localStorage.removeItem("i18n-lang");
  });

  it("flags.multiLang is false when VITE_FF_MULTI_LANG=false", async () => {
    vi.stubEnv("VITE_FF_MULTI_LANG", "false");
    vi.resetModules();

    // Re-import feature-flags so it re-evaluates parseFlag with the stubbed env
    const { flags: freshFlags } = await import("@/lib/feature-flags");

    // The flag should be OFF, confirming the OFF branch will be taken in i18n init
    expect(freshFlags.multiLang).toBe(false);
  });
});
