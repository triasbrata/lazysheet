import { describe, it, expect, beforeEach } from "vitest";

import {
  LANGUAGE_KEY,
  isLanguageCode,
  readStoredLanguage,
} from "@/lib/language-pref";

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("LANGUAGE_KEY is the expected string", () => {
    expect(LANGUAGE_KEY).toBe("lazysheet:language");
  });
});

// ---------------------------------------------------------------------------
// isLanguageCode
// ---------------------------------------------------------------------------

describe("isLanguageCode", () => {
  it("returns true for 'en'", () => {
    expect(isLanguageCode("en")).toBe(true);
  });

  it("returns true for 'id'", () => {
    expect(isLanguageCode("id")).toBe(true);
  });

  it("returns true for 'zh'", () => {
    expect(isLanguageCode("zh")).toBe(true);
  });

  it("returns true for 'es'", () => {
    expect(isLanguageCode("es")).toBe(true);
  });

  it("returns false for an unknown language code string", () => {
    expect(isLanguageCode("fr")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isLanguageCode("")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isLanguageCode(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isLanguageCode(undefined)).toBe(false);
  });

  it("returns false for a number", () => {
    expect(isLanguageCode(42)).toBe(false);
  });

  it("returns false for an object", () => {
    expect(isLanguageCode({})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// readStoredLanguage
// ---------------------------------------------------------------------------

describe("readStoredLanguage", () => {
  it("returns DEFAULT_LANGUAGE ('en') when localStorage is empty", () => {
    expect(readStoredLanguage()).toBe("en");
  });

  it("returns stored value 'en' when set", () => {
    localStorage.setItem(LANGUAGE_KEY, "en");
    expect(readStoredLanguage()).toBe("en");
  });

  it("returns stored value 'id' when set", () => {
    localStorage.setItem(LANGUAGE_KEY, "id");
    expect(readStoredLanguage()).toBe("id");
  });

  it("returns stored value 'zh' when set", () => {
    localStorage.setItem(LANGUAGE_KEY, "zh");
    expect(readStoredLanguage()).toBe("zh");
  });

  it("returns stored value 'es' when set", () => {
    localStorage.setItem(LANGUAGE_KEY, "es");
    expect(readStoredLanguage()).toBe("es");
  });

  it("returns DEFAULT_LANGUAGE when stored value is invalid", () => {
    localStorage.setItem(LANGUAGE_KEY, "de");
    expect(readStoredLanguage()).toBe("en");
  });

  it("returns DEFAULT_LANGUAGE when stored value is empty string", () => {
    localStorage.setItem(LANGUAGE_KEY, "");
    expect(readStoredLanguage()).toBe("en");
  });
});
