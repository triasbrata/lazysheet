import { describe, it, expect, vi } from "vitest";

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
});
