import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWorkbook } from "@/hooks/useWorkbook";
import type { WorkbookModel, SheetModel } from "@/lib/types";

vi.mock("@/lib/tauri-api", () => ({
  openWorkbook: vi.fn(),
  loadSheet: vi.fn(),
}));

import { openWorkbook, loadSheet } from "@/lib/tauri-api";

const mockOpenWorkbook = vi.mocked(openWorkbook);
const mockLoadSheet = vi.mocked(loadSheet);

const RECENT_KEY = "lazysheet:recent";
const RECENT_MAX = 8;

function makeSheet(name = "Sheet1"): SheetModel {
  return {
    name,
    rows: [],
    col_widths: [],
    row_heights: [],
    merges: [],
    frozen_rows: 0,
    frozen_cols: 0,
    max_col: 0,
  };
}

function makeWorkbook(
  path = "/tmp/test.xlsx",
  fileName = "test.xlsx",
  sheetName = "Sheet1",
): WorkbookModel {
  const sheet = makeSheet(sheetName);
  return {
    path,
    file_name: fileName,
    sheets: [{ name: sheetName, index: 0 }],
    active_sheet: sheet,
  };
}

describe("useWorkbook", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("starts with null workbook, null activeSheet, no loading, no error", () => {
      const { result } = renderHook(() => useWorkbook());
      expect(result.current.workbook).toBeNull();
      expect(result.current.activeSheet).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("exposes open, switchSheet, close, recents methods", () => {
      const { result } = renderHook(() => useWorkbook());
      expect(typeof result.current.open).toBe("function");
      expect(typeof result.current.switchSheet).toBe("function");
      expect(typeof result.current.close).toBe("function");
      expect(typeof result.current.recents).toBe("function");
    });
  });

  describe("open()", () => {
    it("sets loading to true while opening, then false on success", async () => {
      const wb = makeWorkbook();
      let resolveOpen: (v: WorkbookModel) => void;
      mockOpenWorkbook.mockReturnValue(
        new Promise<WorkbookModel>((res) => {
          resolveOpen = res;
        }),
      );

      const { result } = renderHook(() => useWorkbook());

      let openPromise: Promise<WorkbookModel>;
      act(() => {
        openPromise = result.current.open("/tmp/test.xlsx");
      });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolveOpen!(wb);
        await openPromise!;
      });

      expect(result.current.loading).toBe(false);
    });

    it("sets workbook and activeSheet on success", async () => {
      const wb = makeWorkbook("/tmp/data.xlsx", "data.xlsx", "Sheet1");
      mockOpenWorkbook.mockResolvedValue(wb);

      const { result } = renderHook(() => useWorkbook());

      await act(async () => {
        await result.current.open("/tmp/data.xlsx");
      });

      expect(result.current.workbook).toEqual(wb);
      expect(result.current.activeSheet).toEqual(wb.active_sheet);
    });

    it("returns the workbook on success", async () => {
      const wb = makeWorkbook();
      mockOpenWorkbook.mockResolvedValue(wb);

      const { result } = renderHook(() => useWorkbook());

      let returned: WorkbookModel | undefined;
      await act(async () => {
        returned = await result.current.open("/tmp/test.xlsx");
      });

      expect(returned).toEqual(wb);
    });

    it("clears error before opening", async () => {
      // First open fails to set error
      mockOpenWorkbook.mockRejectedValueOnce(new Error("first fail"));
      const { result } = renderHook(() => useWorkbook());

      await act(async () => {
        try {
          await result.current.open("/tmp/bad.xlsx");
        } catch {
          // expected
        }
      });

      expect(result.current.error).toBe("first fail");

      // Second open succeeds - error should be cleared
      const wb = makeWorkbook();
      mockOpenWorkbook.mockResolvedValue(wb);

      await act(async () => {
        await result.current.open("/tmp/good.xlsx");
      });

      expect(result.current.error).toBeNull();
    });

    it("sets error state when openWorkbook throws Error", async () => {
      mockOpenWorkbook.mockRejectedValue(new Error("file not found"));

      const { result } = renderHook(() => useWorkbook());

      await act(async () => {
        try {
          await result.current.open("/tmp/missing.xlsx");
        } catch {
          // expected re-throw
        }
      });

      expect(result.current.error).toBe("file not found");
      expect(result.current.workbook).toBeNull();
    });

    it("sets error state when openWorkbook rejects with string", async () => {
      mockOpenWorkbook.mockRejectedValue("backend error string");

      const { result } = renderHook(() => useWorkbook());

      await act(async () => {
        try {
          await result.current.open("/tmp/bad.xlsx");
        } catch {
          // expected
        }
      });

      expect(result.current.error).toBe("backend error string");
    });

    it("re-throws on failure", async () => {
      mockOpenWorkbook.mockRejectedValue(new Error("open failed"));

      const { result } = renderHook(() => useWorkbook());

      let caught: Error | null = null;
      await act(async () => {
        try {
          await result.current.open("/tmp/bad.xlsx");
        } catch (e) {
          caught = e as Error;
        }
      });

      expect(caught).toBeInstanceOf(Error);
      expect(caught?.message).toBe("open failed");
    });

    it("sets error when openWorkbook rejects with object without message (String(e) fallback)", async () => {
      const nonErrorObj = { code: 42 }; // no .message
      mockOpenWorkbook.mockRejectedValue(nonErrorObj);

      const { result } = renderHook(() => useWorkbook());

      await act(async () => {
        try {
          await result.current.open("/tmp/bad.xlsx");
        } catch {
          // expected
        }
      });

      // msg = String({code:42}) = "[object Object]"
      expect(result.current.error).toBe("[object Object]");
    });

    it("sets loading to false even when open fails", async () => {
      mockOpenWorkbook.mockRejectedValue(new Error("fail"));

      const { result } = renderHook(() => useWorkbook());

      await act(async () => {
        try {
          await result.current.open("/tmp/fail.xlsx");
        } catch {
          // expected
        }
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe("pushRecent / recents()", () => {
    it("pushes opened file to recents localStorage", async () => {
      const wb = makeWorkbook("/tmp/data.xlsx", "data.xlsx");
      mockOpenWorkbook.mockResolvedValue(wb);

      const { result } = renderHook(() => useWorkbook());

      await act(async () => {
        await result.current.open("/tmp/data.xlsx");
      });

      const recents = result.current.recents();
      expect(recents).toHaveLength(1);
      expect(recents[0].path).toBe("/tmp/data.xlsx");
      expect(recents[0].fileName).toBe("data.xlsx");
      expect(typeof recents[0].openedAt).toBe("number");
    });

    it("deduplicates: re-opening same path moves it to front", async () => {
      const wb1 = makeWorkbook("/tmp/a.xlsx", "a.xlsx");
      const wb2 = makeWorkbook("/tmp/b.xlsx", "b.xlsx");
      const wb1Again = makeWorkbook("/tmp/a.xlsx", "a.xlsx");

      mockOpenWorkbook
        .mockResolvedValueOnce(wb1)
        .mockResolvedValueOnce(wb2)
        .mockResolvedValueOnce(wb1Again);

      const { result } = renderHook(() => useWorkbook());

      await act(async () => {
        await result.current.open("/tmp/a.xlsx");
      });
      await act(async () => {
        await result.current.open("/tmp/b.xlsx");
      });
      await act(async () => {
        await result.current.open("/tmp/a.xlsx");
      });

      const recents = result.current.recents();
      // deduplicated: a.xlsx should appear only once, at front
      const paths = recents.map((r) => r.path);
      expect(paths[0]).toBe("/tmp/a.xlsx");
      expect(paths.filter((p) => p === "/tmp/a.xlsx")).toHaveLength(1);
    });

    it(`caps recents at ${RECENT_MAX} entries (LRU eviction)`, async () => {
      const { result } = renderHook(() => useWorkbook());

      for (let i = 0; i < RECENT_MAX + 2; i++) {
        const path = `/tmp/file${i}.xlsx`;
        mockOpenWorkbook.mockResolvedValueOnce(
          makeWorkbook(path, `file${i}.xlsx`),
        );
        await act(async () => {
          await result.current.open(path);
        });
      }

      const recents = result.current.recents();
      expect(recents).toHaveLength(RECENT_MAX);
    });

    it("recents() returns [] when localStorage is empty", () => {
      const { result } = renderHook(() => useWorkbook());
      expect(result.current.recents()).toEqual([]);
    });

    it("recents() returns [] when localStorage has corrupt JSON", () => {
      localStorage.setItem(RECENT_KEY, "not-valid-json{{{");
      const { result } = renderHook(() => useWorkbook());
      expect(result.current.recents()).toEqual([]);
    });

    it("recents() returns [] when stored value is not an array", () => {
      localStorage.setItem(RECENT_KEY, JSON.stringify({ path: "/tmp/x.xlsx" }));
      const { result } = renderHook(() => useWorkbook());
      expect(result.current.recents()).toEqual([]);
    });

    it("recents() reads previously stored entries from localStorage", () => {
      const existing = [
        { path: "/tmp/old.xlsx", fileName: "old.xlsx", openedAt: 1000 },
      ];
      localStorage.setItem(RECENT_KEY, JSON.stringify(existing));

      const { result } = renderHook(() => useWorkbook());
      const recents = result.current.recents();
      expect(recents).toHaveLength(1);
      expect(recents[0].path).toBe("/tmp/old.xlsx");
    });
  });

  describe("switchSheet()", () => {
    it("does nothing when workbook is null", async () => {
      const { result } = renderHook(() => useWorkbook());

      await act(async () => {
        await result.current.switchSheet("Sheet2");
      });

      expect(mockLoadSheet).not.toHaveBeenCalled();
    });

    it("does nothing when switching to already active sheet", async () => {
      const wb = makeWorkbook("/tmp/test.xlsx", "test.xlsx", "Sheet1");
      mockOpenWorkbook.mockResolvedValue(wb);

      const { result } = renderHook(() => useWorkbook());
      await act(async () => {
        await result.current.open("/tmp/test.xlsx");
      });

      await act(async () => {
        await result.current.switchSheet("Sheet1");
      });

      expect(mockLoadSheet).not.toHaveBeenCalled();
    });

    it("loads a different sheet successfully", async () => {
      const wb = makeWorkbook("/tmp/test.xlsx", "test.xlsx", "Sheet1");
      const sheet2 = makeSheet("Sheet2");
      mockOpenWorkbook.mockResolvedValue(wb);
      mockLoadSheet.mockResolvedValue(sheet2);

      const { result } = renderHook(() => useWorkbook());
      await act(async () => {
        await result.current.open("/tmp/test.xlsx");
      });

      await act(async () => {
        await result.current.switchSheet("Sheet2");
      });

      expect(mockLoadSheet).toHaveBeenCalledWith("Sheet2");
      expect(result.current.activeSheet).toEqual(sheet2);
    });

    it("sets loading true then false during sheet switch", async () => {
      const wb = makeWorkbook("/tmp/test.xlsx", "test.xlsx", "Sheet1");
      let resolveLoad: (s: SheetModel) => void;
      mockOpenWorkbook.mockResolvedValue(wb);
      mockLoadSheet.mockReturnValue(
        new Promise<SheetModel>((res) => {
          resolveLoad = res;
        }),
      );

      const { result } = renderHook(() => useWorkbook());
      await act(async () => {
        await result.current.open("/tmp/test.xlsx");
      });

      let switchPromise: Promise<void>;
      act(() => {
        switchPromise = result.current.switchSheet("Sheet2");
      });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolveLoad!(makeSheet("Sheet2"));
        await switchPromise!;
      });

      expect(result.current.loading).toBe(false);
    });

    it("sets error when loadSheet fails", async () => {
      const wb = makeWorkbook("/tmp/test.xlsx", "test.xlsx", "Sheet1");
      mockOpenWorkbook.mockResolvedValue(wb);
      mockLoadSheet.mockRejectedValue(new Error("sheet load error"));

      const { result } = renderHook(() => useWorkbook());
      await act(async () => {
        await result.current.open("/tmp/test.xlsx");
      });

      await act(async () => {
        await result.current.switchSheet("Sheet2");
      });

      expect(result.current.error).toBe("sheet load error");
    });

    it("sets error with string rejection in switchSheet", async () => {
      const wb = makeWorkbook("/tmp/test.xlsx", "test.xlsx", "Sheet1");
      mockOpenWorkbook.mockResolvedValue(wb);
      mockLoadSheet.mockRejectedValue("load string error");

      const { result } = renderHook(() => useWorkbook());
      await act(async () => {
        await result.current.open("/tmp/test.xlsx");
      });

      await act(async () => {
        await result.current.switchSheet("Sheet2");
      });

      expect(result.current.error).toBe("load string error");
    });

    it("sets error when loadSheet rejects with object without message (String(e) fallback)", async () => {
      const wb = makeWorkbook("/tmp/test.xlsx", "test.xlsx", "Sheet1");
      mockOpenWorkbook.mockResolvedValue(wb);
      mockLoadSheet.mockRejectedValue({ code: 99 }); // no .message

      const { result } = renderHook(() => useWorkbook());
      await act(async () => {
        await result.current.open("/tmp/test.xlsx");
      });

      await act(async () => {
        await result.current.switchSheet("Sheet2");
      });

      expect(result.current.error).toBe("[object Object]");
    });

    it("sets loading to false even when switchSheet fails", async () => {
      const wb = makeWorkbook("/tmp/test.xlsx", "test.xlsx", "Sheet1");
      mockOpenWorkbook.mockResolvedValue(wb);
      mockLoadSheet.mockRejectedValue(new Error("fail"));

      const { result } = renderHook(() => useWorkbook());
      await act(async () => {
        await result.current.open("/tmp/test.xlsx");
      });

      await act(async () => {
        await result.current.switchSheet("Sheet2");
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe("close()", () => {
    it("resets workbook, activeSheet, error to null", async () => {
      const wb = makeWorkbook();
      mockOpenWorkbook.mockResolvedValue(wb);

      const { result } = renderHook(() => useWorkbook());
      await act(async () => {
        await result.current.open("/tmp/test.xlsx");
      });

      act(() => {
        result.current.close();
      });

      expect(result.current.workbook).toBeNull();
      expect(result.current.activeSheet).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("close clears error from previous failed open", async () => {
      mockOpenWorkbook.mockRejectedValue(new Error("fail"));
      const { result } = renderHook(() => useWorkbook());

      await act(async () => {
        try {
          await result.current.open("/tmp/bad.xlsx");
        } catch {
          // expected
        }
      });

      expect(result.current.error).toBeTruthy();

      act(() => {
        result.current.close();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("RecentFile shape", () => {
    it("stored recent has correct shape (path, fileName, openedAt)", async () => {
      const wb = makeWorkbook("/docs/report.xlsx", "report.xlsx");
      mockOpenWorkbook.mockResolvedValue(wb);

      const { result } = renderHook(() => useWorkbook());

      const before = Date.now();
      await act(async () => {
        await result.current.open("/docs/report.xlsx");
      });
      const after = Date.now();

      const recents = result.current.recents();
      expect(recents[0]).toMatchObject({
        path: "/docs/report.xlsx",
        fileName: "report.xlsx",
      });
      expect(recents[0].openedAt).toBeGreaterThanOrEqual(before);
      expect(recents[0].openedAt).toBeLessThanOrEqual(after);
    });
  });
});
