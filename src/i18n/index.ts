import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { DEFAULT_LANGUAGE } from "./languages";
import { LANGUAGE_KEY } from "@/lib/language-pref";
import { flags } from "@/lib/feature-flags";
import en from "@/locales/en.json";
import id from "@/locales/id.json";
import zh from "@/locales/zh.json";
import es from "@/locales/es.json";

const base = flags.multiLang
  ? i18n.use(LanguageDetector).use(initReactI18next)
  : i18n.use(initReactI18next);

base.init({
  resources: {
    en: { translation: en },
    id: { translation: id },
    zh: { translation: zh },
    es: { translation: es },
  },
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: ["en", "id", "zh", "es"],
  defaultNS: "translation",
  interpolation: { escapeValue: false },
  ...(flags.multiLang
    ? {
        detection: {
          order: ["localStorage", "navigator"],
          lookupLocalStorage: LANGUAGE_KEY,
          caches: ["localStorage"],
        },
      }
    : { lng: DEFAULT_LANGUAGE }),
  react: { useSuspense: false },
});

export default i18n;
