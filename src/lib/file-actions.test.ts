import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("tauri-plugin-clipboard-api", () => ({
  writeFilesURIs: vi.fn(),
}));

vi.mock("@crabnebula/tauri-plugin-drag", () => ({
  startDrag: vi.fn(),
}));

import { writeFilesURIs } from "tauri-plugin-clipboard-api";
import { startDrag } from "@crabnebula/tauri-plugin-drag";

import {
  pathToFileUri,
  copyFilePath,
  copyFileToClipboard,
  dragOutFile,
} from "@/lib/file-actions";

beforeEach(() => {
  vi.clearAllMocks();
  // Stub navigator.clipboard.writeText (not available in node environment)
  Object.defineProperty(globalThis, "navigator", {
    value: {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    },
    writable: true,
    configurable: true,
  });
});

describe("pathToFileUri", () => {
  it('encodes spaces in a unix path: "/a b/c.xlsx" -> "file:///a%20b/c.xlsx"', () => {
    expect(pathToFileUri("/a b/c.xlsx")).toBe("file:///a%20b/c.xlsx");
  });

  it('normalizes Windows backslashes and prefixes drive: "C:\\\\a b\\\\c.xlsx" -> "file:///C:/a%20b/c.xlsx"', () => {
    expect(pathToFileUri("C:\\a b\\c.xlsx")).toBe("file:///C:/a%20b/c.xlsx");
  });

  it('handles a plain unix path: "/tmp/x.xlsx" -> "file:///tmp/x.xlsx"', () => {
    expect(pathToFileUri("/tmp/x.xlsx")).toBe("file:///tmp/x.xlsx");
  });
});

describe("copyFilePath", () => {
  it("calls navigator.clipboard.writeText once with the raw path", async () => {
    await copyFilePath("/tmp/x.xlsx");
    expect(navigator.clipboard.writeText).toHaveBeenCalledOnce();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("/tmp/x.xlsx");
  });
});

describe("copyFileToClipboard", () => {
  it("calls writeFilesURIs once with the file URI", async () => {
    await copyFileToClipboard("/tmp/x.xlsx");
    expect(writeFilesURIs).toHaveBeenCalledOnce();
    expect(writeFilesURIs).toHaveBeenCalledWith(["file:///tmp/x.xlsx"]);
  });
});

describe("dragOutFile", () => {
  it("calls startDrag with item array and an embedded base64 data-URL icon", async () => {
    await dragOutFile("/tmp/x.xlsx");
    expect(startDrag).toHaveBeenCalledOnce();
    expect(startDrag).toHaveBeenCalledWith({
      item: ["/tmp/x.xlsx"],
      icon: expect.stringMatching(/^data:image\/png;base64,/),
    });
  });
});
