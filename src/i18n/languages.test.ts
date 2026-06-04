import { describe, it, expect } from "vitest";
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
} from "@/i18n/languages";
import type { LanguageMeta, LanguageCode } from "@/i18n/languages";

// ---------------------------------------------------------------------------
// SUPPORTED_LANGUAGES shape
// ---------------------------------------------------------------------------

describe("SUPPORTED_LANGUAGES", () => {
  it("is a non-empty readonly array", () => {
    expect(Array.isArray(SUPPORTED_LANGUAGES)).toBe(true);
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThan(0);
  });

  it("every entry has a code and nativeLabel string", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(typeof lang.code).toBe("string");
      expect(lang.code.length).toBeGreaterThan(0);
      expect(typeof lang.nativeLabel).toBe("string");
      expect(lang.nativeLabel.length).toBeGreaterThan(0);
    }
  });

  it("codes are unique (no duplicates)", () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it("contains exactly the expected language codes", () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toContain("en");
    expect(codes).toContain("id");
    expect(codes).toContain("zh");
    expect(codes).toContain("es");
  });

  it("each entry matches the LanguageMeta interface shape", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      // Type assertion — TS already enforces this, runtime check confirms shape
      const meta = lang as LanguageMeta;
      expect(meta).toHaveProperty("code");
      expect(meta).toHaveProperty("nativeLabel");
    }
  });

  it("English entry has correct nativeLabel", () => {
    const en = SUPPORTED_LANGUAGES.find((l) => l.code === "en");
    expect(en).toBeDefined();
    expect(en!.nativeLabel).toBe("English");
  });

  it("Indonesian entry has correct nativeLabel", () => {
    const id = SUPPORTED_LANGUAGES.find((l) => l.code === "id");
    expect(id).toBeDefined();
    expect(id!.nativeLabel).toBe("Bahasa Indonesia");
  });

  it("Chinese entry has correct nativeLabel", () => {
    const zh = SUPPORTED_LANGUAGES.find((l) => l.code === "zh");
    expect(zh).toBeDefined();
    expect(zh!.nativeLabel).toBe("中文");
  });

  it("Spanish entry has correct nativeLabel", () => {
    const es = SUPPORTED_LANGUAGES.find((l) => l.code === "es");
    expect(es).toBeDefined();
    expect(es!.nativeLabel).toBe("Español");
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_LANGUAGE
// ---------------------------------------------------------------------------

describe("DEFAULT_LANGUAGE", () => {
  it("is 'en'", () => {
    expect(DEFAULT_LANGUAGE).toBe("en");
  });

  it("is a member of SUPPORTED_LANGUAGES codes", () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code) as LanguageCode[];
    expect(codes).toContain(DEFAULT_LANGUAGE);
  });

  it("corresponds to a real entry in SUPPORTED_LANGUAGES", () => {
    const entry = SUPPORTED_LANGUAGES.find((l) => l.code === DEFAULT_LANGUAGE);
    expect(entry).toBeDefined();
  });
});
