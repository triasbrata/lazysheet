import {
  type Locale,
  SUPPORTED_LOCALES,
  LOCALE_META,
  resources,
} from "./config";

export const SITE_URL = "https://lazysheet.brata.cloud";

type SeoTranslation = {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
};

export function getSeoMeta(locale: Locale) {
  const seo = (resources[locale].translation as { seo: SeoTranslation }).seo;
  const { ogLocale } = LOCALE_META[locale];

  return [
    { title: seo.title },
    { name: "description", content: seo.description },
    { property: "og:title", content: seo.ogTitle },
    { property: "og:description", content: seo.ogDescription },
    { property: "og:locale", content: ogLocale },
    { name: "twitter:title", content: seo.ogTitle },
    { name: "twitter:description", content: seo.ogDescription },
  ];
}

export function getHreflangLinks(locale: Locale) {
  const links = SUPPORTED_LOCALES.map((l) => ({
    rel: "alternate" as const,
    hrefLang: LOCALE_META[l].htmlLang,
    href: `${SITE_URL}/${l}`,
  }));
  links.push({
    rel: "alternate" as const,
    hrefLang: "x-default",
    href: `${SITE_URL}/en`,
  });
  return links;
}
