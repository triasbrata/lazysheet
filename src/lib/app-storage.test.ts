import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/plugin-fs", () => ({
  BaseDirectory: { AppData: 1 },
  exists: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: vi.fn().mockResolvedValue("/app/data"),
}));

import { readJson, writeJson } from "./app-storage";
import { exists, readTextFile, writeTextFile, mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";

const mockExists = exists as ReturnType<typeof vi.fn>;
const mockReadTextFile = readTextFile as ReturnType<typeof vi.fn>;
const mockWriteTextFile = writeTextFile as ReturnType<typeof vi.fn>;
const mockMkdir = mkdir as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockExists.mockResolvedValue(true); // base dir exists by default
});

describe("readJson", () => {
  it("returns fallback when file does not exist", async () => {
    mockExists.mockResolvedValue(false);
    const result = await readJson("config.json", { default: true });
    expect(result).toEqual({ default: true });
    expect(mockReadTextFile).not.toHaveBeenCalled();
  });

  it("returns parsed object when file exists with valid JSON", async () => {
    mockExists.mockResolvedValue(true);
    mockReadTextFile.mockResolvedValue('{"key":"value"}');
    const result = await readJson("config.json", {});
    expect(result).toEqual({ key: "value" });
  });

  it("returns fallback when file contains invalid JSON", async () => {
    mockExists.mockResolvedValue(true);
    mockReadTextFile.mockResolvedValue("not valid json{{");
    const result = await readJson("config.json", { fallback: true });
    expect(result).toEqual({ fallback: true });
  });

  it("returns fallback when exists throws", async () => {
    mockExists.mockRejectedValue(new Error("permission denied"));
    const result = await readJson("config.json", 42);
    expect(result).toBe(42);
  });
});

describe("writeJson", () => {
  it("calls writeTextFile with correct arguments", async () => {
    mockWriteTextFile.mockResolvedValue(undefined);
    const data = { hello: "world" };
    await writeJson("settings.json", data);
    expect(mockWriteTextFile).toHaveBeenCalledWith(
      "settings.json",
      JSON.stringify(data),
      { baseDir: BaseDirectory.AppData }
    );
  });

  it("does not throw when writeTextFile throws", async () => {
    mockWriteTextFile.mockRejectedValue(new Error("disk full"));
    await expect(writeJson("settings.json", {})).resolves.toBeUndefined();
  });

  it("creates the AppData dir when it does not exist before writing", async () => {
    mockExists.mockResolvedValue(false); // base dir missing
    mockWriteTextFile.mockResolvedValue(undefined);
    await writeJson("workspaces.json", []);
    expect(mockMkdir).toHaveBeenCalledWith("/app/data", { recursive: true });
    expect(mockWriteTextFile).toHaveBeenCalled();
  });

  it("does not create the dir when it already exists", async () => {
    mockExists.mockResolvedValue(true);
    mockWriteTextFile.mockResolvedValue(undefined);
    await writeJson("workspaces.json", []);
    expect(mockMkdir).not.toHaveBeenCalled();
  });
});
