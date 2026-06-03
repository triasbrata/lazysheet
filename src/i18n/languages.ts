export type LanguageCode = "en" | "id" | "zh" | "es";
export interface LanguageMeta { code: LanguageCode; nativeLabel: string; }
export const DEFAULT_LANGUAGE: LanguageCode = "en";
export const SUPPORTED_LANGUAGES: readonly LanguageMeta[] = [
  { code: "en", nativeLabel: "English" },
  { code: "id", nativeLabel: "Bahasa Indonesia" },
  { code: "zh", nativeLabel: "中文" },
  { code: "es", nativeLabel: "Español" },
];
