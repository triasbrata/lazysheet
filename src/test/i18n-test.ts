import i18next from "i18next";
import en from "@/locales/en.json";

const testI18n = i18next.createInstance();

testI18n.init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      translation: en as Record<string, unknown>,
    },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default testI18n;
