import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@tauri-apps/plugin-os", () => ({ platform: vi.fn() }));

import { platform } from "@tauri-apps/plugin-os";
import { getPlatform } from "@/lib/platform";

const mockPlatform = vi.mocked(platform);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// plugin-os mapped values
// ---------------------------------------------------------------------------
describe("getPlatform — plugin-os returns a mapped value", () => {
  it('returns "macos" when platform() returns "macos"', () => {
    mockPlatform.mockReturnValue("macos" as ReturnType<typeof platform>);
    expect(getPlatform()).toBe("macos");
  });

  it('returns "windows" when platform() returns "windows"', () => {
    mockPlatform.mockReturnValue("windows" as ReturnType<typeof platform>);
    expect(getPlatform()).toBe("windows");
  });

  it('returns "linux" when platform() returns "linux"', () => {
    mockPlatform.mockReturnValue("linux" as ReturnType<typeof platform>);
    expect(getPlatform()).toBe("linux");
  });
});

// ---------------------------------------------------------------------------
// plugin-os unmapped platforms fall through to navigator
// ---------------------------------------------------------------------------
describe("getPlatform — plugin-os returns unmapped platform (e.g. ios/android)", () => {
  it('falls through to navigator and returns "linux" as default when navigator says nothing', () => {
    mockPlatform.mockReturnValue("ios" as ReturnType<typeof platform>);
    vi.stubGlobal("navigator", { platform: "", userAgent: "" });
    expect(getPlatform()).toBe("linux");
  });
});

// ---------------------------------------------------------------------------
// navigator fallback (plugin-os throws)
// ---------------------------------------------------------------------------
describe("getPlatform — navigator fallback when plugin-os throws", () => {
  it('returns "macos" via navigator.platform matching /mac/i', () => {
    mockPlatform.mockImplementation(() => { throw new Error("not in Tauri"); });
    vi.stubGlobal("navigator", { platform: "MacIntel", userAgent: "" });
    expect(getPlatform()).toBe("macos");
  });

  it('returns "windows" via navigator.platform matching /win/i', () => {
    mockPlatform.mockImplementation(() => { throw new Error("not in Tauri"); });
    vi.stubGlobal("navigator", { platform: "Win32", userAgent: "" });
    expect(getPlatform()).toBe("windows");
  });

  it('returns "linux" when navigator.platform does not match mac or win', () => {
    mockPlatform.mockImplementation(() => { throw new Error("not in Tauri"); });
    vi.stubGlobal("navigator", { platform: "Linux x86_64", userAgent: "" });
    expect(getPlatform()).toBe("linux");
  });

  it('returns "macos" via navigator.userAgent when platform is empty', () => {
    mockPlatform.mockImplementation(() => { throw new Error("not in Tauri"); });
    vi.stubGlobal("navigator", { platform: "", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" });
    expect(getPlatform()).toBe("macos");
  });

  it('returns "windows" via navigator.userAgent when platform is empty', () => {
    mockPlatform.mockImplementation(() => { throw new Error("not in Tauri"); });
    vi.stubGlobal("navigator", { platform: "", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" });
    expect(getPlatform()).toBe("windows");
  });

  it('returns "linux" as default fallback when navigator is undefined', () => {
    mockPlatform.mockImplementation(() => { throw new Error("not in Tauri"); });
    vi.stubGlobal("navigator", undefined);
    expect(getPlatform()).toBe("linux");
  });
});
