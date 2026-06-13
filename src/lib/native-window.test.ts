import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseRgb, syncNativeBackground } from "@/lib/native-window";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

describe("parseRgb", () => {
  it("parses a standard rgb() string", () => {
    expect(parseRgb("rgb(12, 34, 56)")).toEqual({ r: 12, g: 34, b: 56 });
  });

  it("parses an rgba() string and ignores alpha", () => {
    expect(parseRgb("rgba(1, 2, 3, 0.5)")).toEqual({ r: 1, g: 2, b: 3 });
  });

  it("returns null for 'transparent'", () => {
    expect(parseRgb("transparent")).toBe(null);
  });

  it("returns null for empty string", () => {
    expect(parseRgb("")).toBe(null);
  });

  it("parses rgb() without spaces", () => {
    expect(parseRgb("rgb(255,0,128)")).toEqual({ r: 255, g: 0, b: 128 });
  });
});

describe("syncNativeBackground", () => {
  const mockInvoke = vi.mocked(invoke);

  beforeEach(() => {
    mockInvoke.mockClear();
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  it("no-ops outside Tauri (no invoke)", () => {
    syncNativeBackground();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("pushes the root background color to the native window", () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      backgroundColor: "rgb(10, 20, 30)",
    } as CSSStyleDeclaration);

    syncNativeBackground();

    expect(mockInvoke).toHaveBeenCalledWith("set_native_background", {
      r: 10,
      g: 20,
      b: 30,
    });
  });

  it("falls back to body background when root is transparent", () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element) => {
      const color =
        el === document.documentElement ? "rgba(0, 0, 0, 0)" : "rgb(5, 6, 7)";
      return { backgroundColor: color } as CSSStyleDeclaration;
    });

    syncNativeBackground();

    expect(mockInvoke).toHaveBeenCalledWith("set_native_background", {
      r: 5,
      g: 6,
      b: 7,
    });
  });

  it("does not invoke when the background is unparseable", () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      backgroundColor: "transparent",
    } as CSSStyleDeclaration);

    syncNativeBackground();

    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
