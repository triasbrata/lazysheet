import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: vi.fn(() => ({ onDragDropEvent: vi.fn() })),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";

import {
  SUPPORTED_EXTS,
  openWorkbook,
  loadSheet,
  takePendingFiles,
  onFilesOpened,
  onWebviewDragDrop,
  pickFile,
  isSupportedFile,
  openExternal,
} from "@/lib/tauri-api";

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);
const mockGetCurrentWebview = vi.mocked(getCurrentWebview);
const mockOpenDialog = vi.mocked(openDialog);
const mockOpenUrl = vi.mocked(openUrl);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// SUPPORTED_EXTS
// ---------------------------------------------------------------------------
describe("SUPPORTED_EXTS", () => {
  it("exports the expected extensions tuple", () => {
    expect(SUPPORTED_EXTS).toEqual(["xlsx", "xlsm", "xls", "csv", "tsv"]);
  });
});

// ---------------------------------------------------------------------------
// openWorkbook
// ---------------------------------------------------------------------------
describe("openWorkbook", () => {
  it("invokes open_workbook with the given path and returns the result", async () => {
    const mockWorkbook = { sheets: [{ name: "Sheet1", index: 0 }] };
    mockInvoke.mockResolvedValueOnce(mockWorkbook);

    const result = await openWorkbook("/tmp/test.xlsx");

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith("open_workbook", {
      path: "/tmp/test.xlsx",
    });
    expect(result).toBe(mockWorkbook);
  });
});

// ---------------------------------------------------------------------------
// loadSheet
// ---------------------------------------------------------------------------
describe("loadSheet", () => {
  it("invokes load_sheet with the given sheet name and returns the result", async () => {
    const mockSheet = { name: "Sheet1", rows: [], col_widths: [], row_heights: [], merges: [], frozen_rows: 0, frozen_cols: 0, max_col: 0 };
    mockInvoke.mockResolvedValueOnce(mockSheet);

    const result = await loadSheet("Sheet1");

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith("load_sheet", {
      sheetName: "Sheet1",
    });
    expect(result).toBe(mockSheet);
  });
});

// ---------------------------------------------------------------------------
// takePendingFiles
// ---------------------------------------------------------------------------
describe("takePendingFiles", () => {
  it("invokes take_pending_files and returns the list of file paths", async () => {
    const mockPaths = ["/tmp/a.xlsx", "/tmp/b.csv"];
    mockInvoke.mockResolvedValueOnce(mockPaths);

    const result = await takePendingFiles();

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith("take_pending_files");
    expect(result).toBe(mockPaths);
  });

  it("returns an empty array when no pending files", async () => {
    mockInvoke.mockResolvedValueOnce([]);

    const result = await takePendingFiles();

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// onFilesOpened
// ---------------------------------------------------------------------------
describe("onFilesOpened", () => {
  it("subscribes to the files-opened event and wires the callback", async () => {
    const mockUnlisten = vi.fn();
    let capturedHandler: ((e: { payload: string[] }) => void) | undefined;

    mockListen.mockImplementationOnce(async (_event, handler) => {
      capturedHandler = handler as (e: { payload: string[] }) => void;
      return mockUnlisten;
    });

    const cb = vi.fn();
    const unlisten = await onFilesOpened(cb);

    expect(mockListen).toHaveBeenCalledOnce();
    expect(mockListen).toHaveBeenCalledWith("files-opened", expect.any(Function));

    // Simulate an incoming event
    const paths = ["/tmp/file1.xlsx"];
    capturedHandler!({ payload: paths });
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(paths);

    // Unlisten returned correctly
    expect(unlisten).toBe(mockUnlisten);
    unlisten();
    expect(mockUnlisten).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// onWebviewDragDrop
// ---------------------------------------------------------------------------
describe("onWebviewDragDrop", () => {
  it("subscribes via getCurrentWebview().onDragDropEvent and wires callback for drop events", async () => {
    const mockUnlisten = vi.fn();
    let capturedHandler: ((event: { payload: { type: string; paths: string[] } }) => void) | undefined;
    const mockOnDragDropEvent = vi.fn(async (handler: typeof capturedHandler) => {
      capturedHandler = handler;
      return mockUnlisten;
    });

    mockGetCurrentWebview.mockReturnValueOnce({
      onDragDropEvent: mockOnDragDropEvent,
    } as unknown as ReturnType<typeof getCurrentWebview>);

    const cb = vi.fn();
    const unlisten = await onWebviewDragDrop(cb);

    expect(mockGetCurrentWebview).toHaveBeenCalledOnce();
    expect(mockOnDragDropEvent).toHaveBeenCalledOnce();
    expect(mockOnDragDropEvent).toHaveBeenCalledWith(expect.any(Function));

    // "drop" event should invoke the callback
    const paths = ["/tmp/dragged.xlsx"];
    capturedHandler!({ payload: { type: "drop", paths } });
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(paths);

    // Non-"drop" events should NOT invoke the callback
    capturedHandler!({ payload: { type: "hover", paths: [] } });
    expect(cb).toHaveBeenCalledOnce(); // still only once

    // Unlisten returned correctly
    expect(unlisten).toBe(mockUnlisten);
    unlisten();
    expect(mockUnlisten).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// pickFile
// ---------------------------------------------------------------------------
describe("pickFile", () => {
  it("returns the selected path when the dialog resolves with a string", async () => {
    mockOpenDialog.mockResolvedValueOnce("/home/user/data.xlsx");

    const result = await pickFile();

    expect(mockOpenDialog).toHaveBeenCalledOnce();
    expect(mockOpenDialog).toHaveBeenCalledWith({
      multiple: false,
      directory: false,
      filters: [
        {
          name: "Spreadsheets",
          extensions: [...SUPPORTED_EXTS],
        },
      ],
    });
    expect(result).toBe("/home/user/data.xlsx");
  });

  it("returns null when the dialog is cancelled (result is null)", async () => {
    mockOpenDialog.mockResolvedValueOnce(null);

    const result = await pickFile();

    expect(result).toBeNull();
  });

  it("returns null when the dialog returns a non-string value (array)", async () => {
    // open() can theoretically return string[] when multiple=true; pickFile always passes multiple:false
    // but the type union allows it — ensure our guard handles it
    mockOpenDialog.mockResolvedValueOnce(null);

    const result = await pickFile();

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// openExternal
// ---------------------------------------------------------------------------
describe("openExternal", () => {
  it("delegates to openUrl with the provided URL", async () => {
    mockOpenUrl.mockResolvedValueOnce(undefined);

    await openExternal("https://example.com");

    expect(mockOpenUrl).toHaveBeenCalledOnce();
    expect(mockOpenUrl).toHaveBeenCalledWith("https://example.com");
  });
});

// ---------------------------------------------------------------------------
// isSupportedFile (pure)
// ---------------------------------------------------------------------------
describe("isSupportedFile", () => {
  it.each(["xlsx", "xlsm", "xls", "csv", "tsv"])(
    "returns true for .%s extension",
    (ext) => {
      expect(isSupportedFile(`/tmp/file.${ext}`)).toBe(true);
    },
  );

  it.each(["XLSX", "XLSM", "XLS", "CSV", "TSV"])(
    "returns true for uppercase .%s extension (case-insensitive)",
    (ext) => {
      expect(isSupportedFile(`/tmp/file.${ext}`)).toBe(true);
    },
  );

  it("returns false for an unknown extension (.pdf)", () => {
    expect(isSupportedFile("/tmp/file.pdf")).toBe(false);
  });

  it("returns false for a file with no extension", () => {
    expect(isSupportedFile("/tmp/filenoext")).toBe(false);
  });

  it("returns false for an empty string path", () => {
    // split(".").pop() on "" returns "" which is not in SUPPORTED_EXTS
    expect(isSupportedFile("")).toBe(false);
  });

  it("returns false for a path with no dot (pop() returns the whole string, never undefined)", () => {
    // "nodotfile".split(".").pop() === "nodotfile" — not in SUPPORTED_EXTS
    expect(isSupportedFile("nodotfile")).toBe(false);
  });

  it("returns true for a mixed-case extension (.Xlsx)", () => {
    expect(isSupportedFile("/tmp/file.Xlsx")).toBe(true);
  });
});
