import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/app-storage", () => ({
  readJson: vi.fn(),
  writeJson: vi.fn(),
}));

import { readJson, writeJson } from "@/lib/app-storage";
import {
  readStoredSettings,
  writeStoredSettings,
  isAppSettings,
  DEFAULT_SETTINGS,
  SETTINGS_FILE,
} from "@/lib/settings-pref";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isAppSettings", () => {
  it("returns true for {askBeforeClose: true}", () => {
    expect(isAppSettings({ askBeforeClose: true })).toBe(true);
  });

  it("returns true for {askBeforeClose: false}", () => {
    expect(isAppSettings({ askBeforeClose: false })).toBe(true);
  });

  it("returns false for null", () => {
    expect(isAppSettings(null)).toBe(false);
  });

  it("returns false for a number (42)", () => {
    expect(isAppSettings(42)).toBe(false);
  });

  it("returns false for {askBeforeClose: 'x'}", () => {
    expect(isAppSettings({ askBeforeClose: "x" })).toBe(false);
  });

  it("returns false for empty object {}", () => {
    expect(isAppSettings({})).toBe(false);
  });
});

describe("readStoredSettings", () => {
  it("returns DEFAULT_SETTINGS when readJson resolves null", async () => {
    vi.mocked(readJson).mockResolvedValue(null);
    const result = await readStoredSettings();
    expect(result).toEqual(DEFAULT_SETTINGS);
    expect(result.askBeforeClose).toBe(false);
  });

  it("returns {askBeforeClose: true, disableRunningText: false} when readJson resolves old-shape {askBeforeClose: true}", async () => {
    vi.mocked(readJson).mockResolvedValue({ askBeforeClose: true });
    const result = await readStoredSettings();
    expect(result).toEqual({ askBeforeClose: true, disableRunningText: false });
  });

  it("returns DEFAULT_SETTINGS when readJson resolves malformed object {askBeforeClose: 'yes'}", async () => {
    vi.mocked(readJson).mockResolvedValue({ askBeforeClose: "yes" });
    const result = await readStoredSettings();
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it("returns DEFAULT_SETTINGS when readJson resolves a primitive (42)", async () => {
    vi.mocked(readJson).mockResolvedValue(42);
    const result = await readStoredSettings();
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it("returns DEFAULT_SETTINGS when readJson resolves empty object {}", async () => {
    vi.mocked(readJson).mockResolvedValue({});
    const result = await readStoredSettings();
    expect(result).toEqual(DEFAULT_SETTINGS);
  });
});

describe("writeStoredSettings", () => {
  it("calls writeJson with SETTINGS_FILE and the provided settings", async () => {
    vi.mocked(writeJson).mockResolvedValue(undefined);
    await writeStoredSettings({ askBeforeClose: true, disableRunningText: false });
    expect(vi.mocked(writeJson)).toHaveBeenCalledWith(SETTINGS_FILE, {
      askBeforeClose: true,
      disableRunningText: false,
    });
  });
});

describe("DEFAULT_SETTINGS", () => {
  it("has disableRunningText === false", () => {
    expect(DEFAULT_SETTINGS.disableRunningText).toBe(false);
  });
});

describe("isAppSettings backward-compat", () => {
  it("accepts old-shape object lacking disableRunningText", () => {
    expect(isAppSettings({ askBeforeClose: true })).toBe(true);
  });

  it("accepts old-shape object lacking disableRunningText (false variant)", () => {
    expect(isAppSettings({ askBeforeClose: false })).toBe(true);
  });
});
