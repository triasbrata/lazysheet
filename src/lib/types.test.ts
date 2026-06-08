import { describe, it, expect } from "vitest";
import { cellText, numericValue, editKey, coerceInput, isWritableFormat } from "@/lib/types";
import type { CellModel, CellValue } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cm(v: CellValue, extra?: Partial<Omit<CellModel, "v">>): CellModel {
  return { v, ...extra };
}

// ---------------------------------------------------------------------------
// cellText
// ---------------------------------------------------------------------------

describe("cellText", () => {
  it("Empty → empty string", () => {
    expect(cellText(cm({ t: "Empty" }))).toBe("");
  });

  it("Text → returns the text content", () => {
    expect(cellText(cm({ t: "Text", c: "hello" }))).toBe("hello");
    expect(cellText(cm({ t: "Text", c: "" }))).toBe("");
  });

  it("Date → returns the date string", () => {
    expect(cellText(cm({ t: "Date", c: "2024-01-15" }))).toBe("2024-01-15");
  });

  it("Error → returns the error string", () => {
    expect(cellText(cm({ t: "Error", c: "#VALUE!" }))).toBe("#VALUE!");
    expect(cellText(cm({ t: "Error", c: "#REF!" }))).toBe("#REF!");
  });

  it("Number integer → no decimal", () => {
    expect(cellText(cm({ t: "Number", c: 42 }))).toBe("42");
  });

  it("Number float → up to 6 decimal places via toLocaleString", () => {
    const result = cellText(cm({ t: "Number", c: 3.14159265 }));
    // toLocaleString with maximumFractionDigits:6 — just check it's a number string
    expect(result).toMatch(/3[\.,]14/);
  });

  it("Number exact integer value → no decimal point", () => {
    const result = cellText(cm({ t: "Number", c: 100 }));
    expect(result).toBe("100");
  });

  it("Number negative float", () => {
    const result = cellText(cm({ t: "Number", c: -1.5 }));
    expect(Number(result.replace(",", "."))).toBeCloseTo(-1.5);
  });

  it("Integer → String conversion", () => {
    expect(cellText(cm({ t: "Integer", c: 0 }))).toBe("0");
    expect(cellText(cm({ t: "Integer", c: -99 }))).toBe("-99");
    expect(cellText(cm({ t: "Integer", c: 1000000 }))).toBe("1000000");
  });

  it("Bool true → TRUE", () => {
    expect(cellText(cm({ t: "Bool", c: true }))).toBe("TRUE");
  });

  it("Bool false → FALSE", () => {
    expect(cellText(cm({ t: "Bool", c: false }))).toBe("FALSE");
  });

  it("Text with formula field still uses v for display", () => {
    // formula field (f) is metadata, cellText uses v
    expect(cellText(cm({ t: "Number", c: 25 }, { f: "=SUM(A1:A5)" }))).toBe("25");
  });

  it("Text with hyperlink field (h) still uses v for display", () => {
    expect(cellText(cm({ t: "Text", c: "Click here" }, { h: "https://example.com" }))).toBe("Click here");
  });
});

// ---------------------------------------------------------------------------
// numericValue
// ---------------------------------------------------------------------------

describe("numericValue", () => {
  // Number / Integer types
  it("Number finite → returns the number", () => {
    expect(numericValue({ t: "Number", c: 3.14 })).toBe(3.14);
    expect(numericValue({ t: "Number", c: 0 })).toBe(0);
    expect(numericValue({ t: "Number", c: -100 })).toBe(-100);
  });

  it("Number non-finite → null", () => {
    expect(numericValue({ t: "Number", c: Infinity })).toBeNull();
    expect(numericValue({ t: "Number", c: -Infinity })).toBeNull();
    expect(numericValue({ t: "Number", c: NaN })).toBeNull();
  });

  it("Integer finite → returns the number", () => {
    expect(numericValue({ t: "Integer", c: 42 })).toBe(42);
    expect(numericValue({ t: "Integer", c: 0 })).toBe(0);
    expect(numericValue({ t: "Integer", c: -7 })).toBe(-7);
  });

  it("Integer non-finite → null", () => {
    expect(numericValue({ t: "Integer", c: NaN })).toBeNull();
    expect(numericValue({ t: "Integer", c: Infinity })).toBeNull();
  });

  // Empty / Bool / Date / Error → null
  it("Empty → null", () => {
    expect(numericValue({ t: "Empty" })).toBeNull();
  });

  it("Bool → null", () => {
    expect(numericValue({ t: "Bool", c: true })).toBeNull();
    expect(numericValue({ t: "Bool", c: false })).toBeNull();
  });

  it("Date → null", () => {
    expect(numericValue({ t: "Date", c: "2024-01-01" })).toBeNull();
  });

  it("Error → null", () => {
    expect(numericValue({ t: "Error", c: "#VALUE!" })).toBeNull();
  });

  // Text parsing
  it("Text plain integer string → number", () => {
    expect(numericValue({ t: "Text", c: "98550" })).toBe(98550);
  });

  it("Text numeric with comma thousand separator → number (e.g. 98,550)", () => {
    expect(numericValue({ t: "Text", c: "98,550" })).toBe(98550);
  });

  it("Text multi-comma thousand separator → number (e.g. 1,234,567)", () => {
    expect(numericValue({ t: "Text", c: "1,234,567" })).toBe(1234567);
  });

  it("Text dot thousand separator → number (e.g. 1.234.567)", () => {
    expect(numericValue({ t: "Text", c: "1.234.567" })).toBe(1234567);
  });

  it("Text dot decimal separator → number (e.g. 3.14)", () => {
    expect(numericValue({ t: "Text", c: "3.14" })).toBe(3.14);
  });

  it("Text comma decimal separator → number (e.g. 3,14)", () => {
    // single comma, digits after != 3 → decimal
    expect(numericValue({ t: "Text", c: "3,14" })).toBe(3.14);
  });

  it("Text comma+dot mixed: comma is decimal (e.g. 1.234,56)", () => {
    // lastIndexOf(',') > lastIndexOf('.') → comma is decimal
    expect(numericValue({ t: "Text", c: "1.234,56" })).toBeCloseTo(1234.56);
  });

  it("Text dot+comma mixed: dot is decimal (e.g. 1,234.56)", () => {
    // lastIndexOf('.') > lastIndexOf(',') → dot is decimal
    expect(numericValue({ t: "Text", c: "1,234.56" })).toBeCloseTo(1234.56);
  });

  it("Text space thousand separator (e.g. 98 550)", () => {
    expect(numericValue({ t: "Text", c: "98 550" })).toBe(98550);
  });

  it("Text ambiguous single separator with exactly 3 digits after → treated as thousand", () => {
    // "12.345" — single dot, 3 digits after → thousand separator → 12345
    expect(numericValue({ t: "Text", c: "12.345" })).toBe(12345);
    expect(numericValue({ t: "Text", c: "12,345" })).toBe(12345);
  });

  it("Text non-numeric → null", () => {
    expect(numericValue({ t: "Text", c: "abc" })).toBeNull();
    expect(numericValue({ t: "Text", c: "$100" })).toBeNull();
    expect(numericValue({ t: "Text", c: "(100)" })).toBeNull();
    expect(numericValue({ t: "Text", c: "1e5" })).toBeNull();
  });

  it("Text empty string → null", () => {
    expect(numericValue({ t: "Text", c: "" })).toBeNull();
  });

  it("Text whitespace only → null", () => {
    expect(numericValue({ t: "Text", c: "   " })).toBeNull();
  });

  it("Text with sign prefix (e.g. +5, -3.14)", () => {
    expect(numericValue({ t: "Text", c: "+5" })).toBe(5);
    expect(numericValue({ t: "Text", c: "-3.14" })).toBe(-3.14);
  });

  it("Text with multiple consecutive spaces → still parsed", () => {
    // spaces are stripped → "98550"
    expect(numericValue({ t: "Text", c: "9 8 5 5 0" })).toBe(98550);
  });
});

// ---------------------------------------------------------------------------
// editKey
// ---------------------------------------------------------------------------

describe("editKey", () => {
  it("returns row,col as a comma-separated string", () => {
    expect(editKey(3, 4)).toBe("3,4");
    expect(editKey(0, 0)).toBe("0,0");
    expect(editKey(100, 200)).toBe("100,200");
  });
});

// ---------------------------------------------------------------------------
// coerceInput
// ---------------------------------------------------------------------------

describe("coerceInput", () => {
  it('"" → Empty', () => {
    expect(coerceInput("")).toEqual({ t: "Empty" });
  });

  it('"0" → Integer 0', () => {
    expect(coerceInput("0")).toEqual({ t: "Integer", c: 0 });
  });

  it('"-5" → Integer -5', () => {
    expect(coerceInput("-5")).toEqual({ t: "Integer", c: -5 });
  });

  it('"42" → Integer 42', () => {
    expect(coerceInput("42")).toEqual({ t: "Integer", c: 42 });
  });

  it('"3.14" → Number', () => {
    expect(coerceInput("3.14")).toEqual({ t: "Number", c: 3.14 });
  });

  it('"1e3" → Number', () => {
    expect(coerceInput("1e3")).toEqual({ t: "Number", c: 1000 });
  });

  it('"-0.5" → Number', () => {
    expect(coerceInput("-0.5")).toEqual({ t: "Number", c: -0.5 });
  });

  it('"TRUE" → Bool true', () => {
    expect(coerceInput("TRUE")).toEqual({ t: "Bool", c: true });
  });

  it('"true" → Bool true (case-insensitive)', () => {
    expect(coerceInput("true")).toEqual({ t: "Bool", c: true });
  });

  it('"FALSE" → Bool false', () => {
    expect(coerceInput("FALSE")).toEqual({ t: "Bool", c: false });
  });

  it('"False" → Bool false (case-insensitive)', () => {
    expect(coerceInput("False")).toEqual({ t: "Bool", c: false });
  });

  it('"abc" → Text', () => {
    expect(coerceInput("abc")).toEqual({ t: "Text", c: "abc" });
  });

  it('"=A1" → Text (formulas not parsed in v1)', () => {
    expect(coerceInput("=A1")).toEqual({ t: "Text", c: "=A1" });
  });

  it('"5a" → Text', () => {
    expect(coerceInput("5a")).toEqual({ t: "Text", c: "5a" });
  });
});

// ---------------------------------------------------------------------------
// isWritableFormat
// ---------------------------------------------------------------------------

describe("isWritableFormat", () => {
  it("undefined → false", () => {
    expect(isWritableFormat(undefined)).toBe(false);
  });

  it("null → false", () => {
    expect(isWritableFormat(null)).toBe(false);
  });

  it('"" → false', () => {
    expect(isWritableFormat("")).toBe(false);
  });

  it("xlsx → true", () => {
    expect(isWritableFormat("/a/b.xlsx")).toBe(true);
  });

  it("XLSM (uppercase ext) → true", () => {
    expect(isWritableFormat(".XLSM")).toBe(true);
  });

  it("csv → true", () => {
    expect(isWritableFormat("file.csv")).toBe(true);
  });

  it("tsv → true", () => {
    expect(isWritableFormat("file.tsv")).toBe(true);
  });

  it("txt → true", () => {
    expect(isWritableFormat("file.txt")).toBe(true);
  });

  it("xls → false (read-only format)", () => {
    expect(isWritableFormat("file.xls")).toBe(false);
  });

  it("ods → false", () => {
    expect(isWritableFormat("file.ods")).toBe(false);
  });

  it("no extension → false", () => {
    expect(isWritableFormat("noext")).toBe(false);
  });
});
