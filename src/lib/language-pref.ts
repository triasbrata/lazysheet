import type { LanguageCode } from "@/i18n/languages";
import { DEFAULT_LANGUAGE } from "@/i18n/languages";

// App-global preference: which language to use. Persisted across restarts in
// localStorage. Mirrors the pattern in copy-format-pref.ts.
export const LANGUAGE_KEY = "lazysheet:language";

export function isLanguageCode(v: unknown): v is LanguageCode {
  return v === "en" || v === "id" || v === "zh" || v === "es";
}

export function readStoredLanguage(): LanguageCode {
  try {
    const v = localStorage.getItem(LANGUAGE_KEY);
    if (isLanguageCode(v)) return v;
  } catch {
    // Storage disabled or quota — fall back to default.
  }
  return DEFAULT_LANGUAGE;
}
