import { describe, it, expect } from "vitest";
import { shouldCloseSheet } from "./keyboard-shortcuts";

describe("shouldCloseSheet", () => {
  it("returns true for Cmd+W with hasWorkbook=true", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: false, key: "w" } as unknown as KeyboardEvent;
    expect(shouldCloseSheet(e, true)).toBe(true);
  });

  it("returns true for Ctrl+W with hasWorkbook=true", () => {
    const e = { metaKey: false, ctrlKey: true, shiftKey: false, key: "w" } as unknown as KeyboardEvent;
    expect(shouldCloseSheet(e, true)).toBe(true);
  });

  it("returns false for Cmd+W with hasWorkbook=false", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: false, key: "w" } as unknown as KeyboardEvent;
    expect(shouldCloseSheet(e, false)).toBe(false);
  });

  it("returns false for Cmd+Shift+W with hasWorkbook=true", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: true, key: "w" } as unknown as KeyboardEvent;
    expect(shouldCloseSheet(e, true)).toBe(false);
  });

  it("returns false for Cmd+K with hasWorkbook=true", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: false, key: "k" } as unknown as KeyboardEvent;
    expect(shouldCloseSheet(e, true)).toBe(false);
  });

  it("returns false for 'w' with no modifier and hasWorkbook=true", () => {
    const e = { metaKey: false, ctrlKey: false, shiftKey: false, key: "w" } as unknown as KeyboardEvent;
    expect(shouldCloseSheet(e, true)).toBe(false);
  });

  it("returns true for Cmd+W with uppercase key 'W' and hasWorkbook=true", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: false, key: "W" } as unknown as KeyboardEvent;
    expect(shouldCloseSheet(e, true)).toBe(true);
  });
});
