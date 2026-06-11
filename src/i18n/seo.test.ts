import { describe, it, expect } from "vitest";
import { getSeoMeta, getHreflangLinks, SITE_URL } from "./seo";
import { SUPPORTED_LOCALES, LOCALE_META } from "./config";

describe("SITE_URL", () => {
  it("is defined and starts with https", () => {
    expect(SITE_URL).toBeDefined();
    expect(SITE_URL.startsWith("https://")).toBe(true);
  });
});

describe("getSeoMeta", () => {
  it.each(SUPPORTED_LOCALES as unknown as string[])(
    'returns an array of 7 entries for locale "%s"',
    (locale) => {
      const result = getSeoMeta(locale as (typeof SUPPORTED_LOCALES)[number]);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(7);
    },
  );

  it('contains a title entry for "en"', () => {
    const result = getSeoMeta("en");
    const titleEntry = result.find((m) => "title" in m);
    expect(titleEntry).toBeDefined();
    expect((titleEntry as { title: string }).title).toBe(
      "LazySheet | Fast, Native Excel & CSV Viewer",
    );
  });

  it('contains a description meta for "en"', () => {
    const result = getSeoMeta("en");
    const desc = result.find(
      (m) => "name" in m && (m as { name: string }).name === "description",
    );
    expect(desc).toBeDefined();
    expect(
      (desc as { name: string; content: string }).content.length,
    ).toBeGreaterThan(0);
  });

  it("contains an og:locale entry matching LOCALE_META[locale].ogLocale for each locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const result = getSeoMeta(locale);
      const ogLocaleEntry = result.find(
        (m) =>
          "property" in m &&
          (m as { property: string }).property === "og:locale",
      );
      expect(ogLocaleEntry).toBeDefined();
      expect(
        (ogLocaleEntry as { property: string; content: string }).content,
      ).toBe(LOCALE_META[locale].ogLocale);
    }
  });

  it('returns localized title for "id"', () => {
    const result = getSeoMeta("id");
    const titleEntry = result.find((m) => "title" in m);
    expect((titleEntry as { title: string }).title).toBe(
      "LazySheet | Penampil Excel & CSV Cepat dan Native",
    );
  });

  it('returns localized title for "zh"', () => {
    const result = getSeoMeta("zh");
    const titleEntry = result.find((m) => "title" in m);
    expect((titleEntry as { title: string }).title).toBe(
      "LazySheet | 快速的原生 Excel 和 CSV 查看器",
    );
  });

  it('returns localized title for "es"', () => {
    const result = getSeoMeta("es");
    const titleEntry = result.find((m) => "title" in m);
    expect((titleEntry as { title: string }).title).toBe(
      "LazySheet | Visor Nativo Rápido de Excel y CSV",
    );
  });

  it("contains og:title property entry", () => {
    const result = getSeoMeta("en");
    const ogTitle = result.find(
      (m) =>
        "property" in m && (m as { property: string }).property === "og:title",
    );
    expect(ogTitle).toBeDefined();
    expect(
      (ogTitle as { property: string; content: string }).content.length,
    ).toBeGreaterThan(0);
  });

  it("contains og:description property entry", () => {
    const result = getSeoMeta("en");
    const ogDesc = result.find(
      (m) =>
        "property" in m &&
        (m as { property: string }).property === "og:description",
    );
    expect(ogDesc).toBeDefined();
    expect(
      (ogDesc as { property: string; content: string }).content.length,
    ).toBeGreaterThan(0);
  });

  it("contains twitter:title meta entry", () => {
    const result = getSeoMeta("en");
    const twTitle = result.find(
      (m) => "name" in m && (m as { name: string }).name === "twitter:title",
    );
    expect(twTitle).toBeDefined();
    expect(
      (twTitle as { name: string; content: string }).content.length,
    ).toBeGreaterThan(0);
  });

  it("contains twitter:description meta entry", () => {
    const result = getSeoMeta("en");
    const twDesc = result.find(
      (m) =>
        "name" in m && (m as { name: string }).name === "twitter:description",
    );
    expect(twDesc).toBeDefined();
    expect(
      (twDesc as { name: string; content: string }).content.length,
    ).toBeGreaterThan(0);
  });
});

describe("getHreflangLinks", () => {
  it("returns SUPPORTED_LOCALES.length + 1 entries (including x-default)", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const result = getHreflangLinks(locale);
      expect(result).toHaveLength(SUPPORTED_LOCALES.length + 1);
    }
  });

  it("includes an x-default entry", () => {
    const result = getHreflangLinks("en");
    const xDefault = result.find((l) => l.hrefLang === "x-default");
    expect(xDefault).toBeDefined();
    expect(xDefault!.href).toBe(`${SITE_URL}/en`);
  });

  it('each link has rel="alternate"', () => {
    const result = getHreflangLinks("id");
    for (const link of result) {
      expect(link.rel).toBe("alternate");
    }
  });

  it("hrefs are built from SITE_URL + locale path", () => {
    const result = getHreflangLinks("en");
    for (const locale of SUPPORTED_LOCALES) {
      const link = result.find(
        (l) => l.hrefLang === LOCALE_META[locale].htmlLang,
      );
      expect(link).toBeDefined();
      expect(link!.href).toBe(`${SITE_URL}/${locale}`);
    }
  });

  it("uses htmlLang from LOCALE_META as hrefLang (zh uses zh-CN)", () => {
    const result = getHreflangLinks("zh");
    const zhLink = result.find((l) => l.hrefLang === "zh-CN");
    expect(zhLink).toBeDefined();
    expect(zhLink!.href).toBe(`${SITE_URL}/zh`);
  });

  it("returns same links regardless of the input locale", () => {
    const fromEn = getHreflangLinks("en");
    const fromId = getHreflangLinks("id");
    expect(fromEn).toEqual(fromId);
  });
});
