import { describe, it, expect } from "vitest";
import en from "@/locales/en.json";
import id from "@/locales/id.json";
import zh from "@/locales/zh.json";
import es from "@/locales/es.json";

type JsonObject = Record<string, unknown>;

function flattenKeys(obj: JsonObject, prefix = ""): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      keys.push(...flattenKeys(val as JsonObject, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

function allLeafValues(obj: JsonObject): string[] {
  const values: string[] = [];
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      values.push(...allLeafValues(val as JsonObject));
    } else {
      values.push(String(val));
    }
  }
  return values;
}

// Keys zh intentionally omits (only _one plural forms, zh uses _other only)
const ZH_OMITTED_KEYS = new Set([
  "statusbar.selectionSize_one",
  "find.matches_one",
]);

describe("locale completeness", () => {
  const enKeys = flattenKeys(en as unknown as JsonObject);

  it("en has no empty string values", () => {
    const values = allLeafValues(en as unknown as JsonObject);
    for (const v of values) {
      expect(v.trim().length, `en value is empty: "${v}"`).toBeGreaterThan(0);
    }
  });

  it("id has no empty string values", () => {
    const values = allLeafValues(id as unknown as JsonObject);
    for (const v of values) {
      expect(v.trim().length, `id value is empty: "${v}"`).toBeGreaterThan(0);
    }
  });

  it("zh has no empty string values", () => {
    const values = allLeafValues(zh as unknown as JsonObject);
    for (const v of values) {
      expect(v.trim().length, `zh value is empty: "${v}"`).toBeGreaterThan(0);
    }
  });

  it("es has no empty string values", () => {
    const values = allLeafValues(es as unknown as JsonObject);
    for (const v of values) {
      expect(v.trim().length, `es value is empty: "${v}"`).toBeGreaterThan(0);
    }
  });

  it("id has identical key set to en", () => {
    const idKeys = flattenKeys(id as unknown as JsonObject);
    expect(idKeys).toEqual(enKeys);
  });

  it("es has identical key set to en", () => {
    const esKeys = flattenKeys(es as unknown as JsonObject);
    expect(esKeys).toEqual(enKeys);
  });

  it("zh has all en keys except the two _one plural keys", () => {
    const zhKeys = new Set(flattenKeys(zh as unknown as JsonObject));
    const expectedEnKeys = enKeys.filter((k) => !ZH_OMITTED_KEYS.has(k));
    for (const key of expectedEnKeys) {
      expect(zhKeys.has(key), `zh is missing key: ${key}`).toBe(true);
    }
    // zh should not have _one plural keys
    for (const key of ZH_OMITTED_KEYS) {
      expect(zhKeys.has(key), `zh should not have key: ${key}`).toBe(false);
    }
  });
});
