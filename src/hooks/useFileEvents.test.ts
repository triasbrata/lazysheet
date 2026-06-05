import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFileEvents } from "@/hooks/useFileEvents";

vi.mock("@/lib/tauri-api", () => ({
  takePendingFiles: vi.fn(),
  onFilesOpened: vi.fn(),
  onWebviewDragDrop: vi.fn(),
  isSupportedFile: vi.fn(),
}));

import {
  takePendingFiles,
  onFilesOpened,
  onWebviewDragDrop,
  isSupportedFile,
} from "@/lib/tauri-api";

const mockTakePendingFiles = vi.mocked(takePendingFiles);
const mockOnFilesOpened = vi.mocked(onFilesOpened);
const mockOnWebviewDragDrop = vi.mocked(onWebviewDragDrop);
const mockIsSupportedFile = vi.mocked(isSupportedFile);

describe("useFileEvents", () => {
  let unlistenFiles: ReturnType<typeof vi.fn>;
  let unlistenDrop: ReturnType<typeof vi.fn>;
  let filesOpenedCb: ((paths: string[]) => void) | null;
  let dragDropCb: ((paths: string[]) => void) | null;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    unlistenFiles = vi.fn();
    unlistenDrop = vi.fn();
    filesOpenedCb = null;
    dragDropCb = null;

    mockTakePendingFiles.mockResolvedValue([]);
    mockOnFilesOpened.mockImplementation(async (cb) => {
      filesOpenedCb = cb;
      return unlistenFiles;
    });
    mockOnWebviewDragDrop.mockImplementation(async (cb) => {
      dragDropCb = cb;
      return unlistenDrop;
    });
    mockIsSupportedFile.mockImplementation((path: string) =>
      path.endsWith(".xlsx") || path.endsWith(".csv"),
    );
  });

  it("calls takePendingFiles on mount", async () => {
    const onOpen = vi.fn();
    await act(async () => {
      renderHook(() => useFileEvents(onOpen));
    });
    expect(mockTakePendingFiles).toHaveBeenCalledTimes(1);
  });

  it("calls onOpen with first supported pending file on mount", async () => {
    mockTakePendingFiles.mockResolvedValue(["/tmp/file.xlsx"]);
    mockIsSupportedFile.mockImplementation((p: string) => p.endsWith(".xlsx"));

    const onOpen = vi.fn();
    await act(async () => {
      renderHook(() => useFileEvents(onOpen));
    });

    expect(onOpen).toHaveBeenCalledWith("/tmp/file.xlsx");
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("does not call onOpen when pending files are empty", async () => {
    mockTakePendingFiles.mockResolvedValue([]);
    const onOpen = vi.fn();
    await act(async () => {
      renderHook(() => useFileEvents(onOpen));
    });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("does not call onOpen when pending files have no supported file", async () => {
    mockTakePendingFiles.mockResolvedValue(["/tmp/file.txt", "/tmp/doc.docx"]);
    mockIsSupportedFile.mockReturnValue(false);
    const onOpen = vi.fn();
    await act(async () => {
      renderHook(() => useFileEvents(onOpen));
    });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("picks first supported file from multiple pending files", async () => {
    mockTakePendingFiles.mockResolvedValue([
      "/tmp/unsupported.txt",
      "/tmp/supported.xlsx",
      "/tmp/another.csv",
    ]);
    mockIsSupportedFile.mockImplementation(
      (p: string) => p.endsWith(".xlsx") || p.endsWith(".csv"),
    );
    const onOpen = vi.fn();
    await act(async () => {
      renderHook(() => useFileEvents(onOpen));
    });
    expect(onOpen).toHaveBeenCalledWith("/tmp/supported.xlsx");
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("registers onFilesOpened subscription on mount", async () => {
    const onOpen = vi.fn();
    await act(async () => {
      renderHook(() => useFileEvents(onOpen));
    });
    expect(mockOnFilesOpened).toHaveBeenCalledTimes(1);
  });

  it("registers onWebviewDragDrop subscription on mount", async () => {
    const onOpen = vi.fn();
    await act(async () => {
      renderHook(() => useFileEvents(onOpen));
    });
    expect(mockOnWebviewDragDrop).toHaveBeenCalledTimes(1);
  });

  it("calls onOpen when files-opened event fires with supported file", async () => {
    const onOpen = vi.fn();
    await act(async () => {
      renderHook(() => useFileEvents(onOpen));
    });

    await act(async () => {
      filesOpenedCb?.(["/home/user/data.csv"]);
    });

    expect(onOpen).toHaveBeenCalledWith("/home/user/data.csv");
  });

  it("does not call onOpen when files-opened fires with unsupported files", async () => {
    mockIsSupportedFile.mockReturnValue(false);
    const onOpen = vi.fn();
    await act(async () => {
      renderHook(() => useFileEvents(onOpen));
    });

    await act(async () => {
      filesOpenedCb?.(["/home/user/file.pdf"]);
    });

    expect(onOpen).not.toHaveBeenCalled();
  });

  it("calls onOpen when drag-drop fires with supported file", async () => {
    const onOpen = vi.fn();
    await act(async () => {
      renderHook(() => useFileEvents(onOpen));
    });

    await act(async () => {
      dragDropCb?.(["/dropped/spreadsheet.xlsx"]);
    });

    expect(onOpen).toHaveBeenCalledWith("/dropped/spreadsheet.xlsx");
  });

  it("picks first supported file from drag-drop paths", async () => {
    mockIsSupportedFile.mockImplementation(
      (p: string) => p.endsWith(".xlsx") || p.endsWith(".csv"),
    );
    const onOpen = vi.fn();
    await act(async () => {
      renderHook(() => useFileEvents(onOpen));
    });

    await act(async () => {
      dragDropCb?.(["/tmp/img.png", "/tmp/report.xlsx", "/tmp/data.csv"]);
    });

    expect(onOpen).toHaveBeenCalledWith("/tmp/report.xlsx");
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("calls unlisten functions on unmount", async () => {
    const onOpen = vi.fn();
    let unmount: () => void;
    await act(async () => {
      const result = renderHook(() => useFileEvents(onOpen));
      unmount = result.unmount;
    });

    act(() => {
      unmount();
    });

    expect(unlistenFiles).toHaveBeenCalledTimes(1);
    expect(unlistenDrop).toHaveBeenCalledTimes(1);
  });

  it("does not call onOpen after unmount (cancelled flag)", async () => {
    // Slow takePendingFiles that resolves after unmount
    let resolvePending: (v: string[]) => void;
    mockTakePendingFiles.mockReturnValue(
      new Promise<string[]>((res) => {
        resolvePending = res;
      }),
    );
    mockIsSupportedFile.mockReturnValue(true);

    const onOpen = vi.fn();
    let unmount: () => void;
    act(() => {
      const result = renderHook(() => useFileEvents(onOpen));
      unmount = result.unmount;
    });

    // Unmount before the pending promise resolves
    act(() => {
      unmount();
    });

    // Now resolve with a supported file — onOpen must NOT be called
    await act(async () => {
      resolvePending!(["/tmp/late.xlsx"]);
    });

    expect(onOpen).not.toHaveBeenCalled();
  });

  it("isSupportedFile filter applied to files-opened paths", async () => {
    const onOpen = vi.fn();
    await act(async () => {
      renderHook(() => useFileEvents(onOpen));
    });

    mockIsSupportedFile.mockImplementation(
      (p: string) => p.endsWith(".xlsx"),
    );

    await act(async () => {
      filesOpenedCb?.(["/tmp/file.txt", "/tmp/file.xlsx"]);
    });

    expect(onOpen).toHaveBeenCalledWith("/tmp/file.xlsx");
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
