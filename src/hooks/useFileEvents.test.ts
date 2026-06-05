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

  it("drains pending files twice on mount (drain#1 before listeners, drain#2 after)", async () => {
    const onOpen = vi.fn();
    await act(async () => {
      renderHook(() => useFileEvents(onOpen));
    });
    expect(mockTakePendingFiles).toHaveBeenCalledTimes(2);
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

  it("drain resolving after unmount still delivers path (destructive drain must never discard)", async () => {
    // The Rust-side drain is destructive: once consumed the path is gone. If we
    // discarded drained paths after cleanup we would silently lose files. The
    // cancelled-guard was removed intentionally to prevent that data-loss bug.
    let resolveDrain1: (v: string[]) => void;
    mockTakePendingFiles
      .mockReturnValueOnce(
        new Promise<string[]>((res) => {
          resolveDrain1 = res;
        }),
      )
      .mockResolvedValueOnce([]);

    mockIsSupportedFile.mockReturnValue(true);

    const onOpen = vi.fn();
    let unmount: () => void;
    act(() => {
      const result = renderHook(() => useFileEvents(onOpen));
      unmount = result.unmount;
    });

    // Unmount before drain#1 resolves
    act(() => {
      unmount();
    });

    // Resolve drain#1 after unmount — path MUST still be delivered because the
    // drain already consumed it from the Rust side; discarding it would lose it.
    await act(async () => {
      resolveDrain1!(["/tmp/late.xlsx"]);
    });

    expect(onOpen).toHaveBeenCalledWith("/tmp/late.xlsx");
    expect(onOpen).toHaveBeenCalledTimes(1);
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

  it("drained path survives remount (path from first mount's drain#1 delivered after remount)", async () => {
    // Mount, unmount BEFORE drain#1 resolves, remount, then resolve drain#1.
    // The path must still be delivered exactly once because the drain already
    // consumed it from the Rust side on the first mount.
    let resolveDrain1First: (v: string[]) => void;

    // First mount: drain#1 is slow, drain#2 returns []
    mockTakePendingFiles
      .mockReturnValueOnce(
        new Promise<string[]>((res) => {
          resolveDrain1First = res;
        }),
      )
      .mockResolvedValueOnce([]) // first mount drain#2
      .mockResolvedValueOnce([]) // second mount drain#1
      .mockResolvedValueOnce([]); // second mount drain#2

    mockIsSupportedFile.mockImplementation((p: string) => p.endsWith(".xlsx"));

    const onOpen = vi.fn();

    // First mount
    let unmount: () => void;
    act(() => {
      const result = renderHook(() => useFileEvents(onOpen));
      unmount = result.unmount;
    });

    // Unmount before drain#1 resolves
    act(() => {
      unmount();
    });

    // Second mount
    await act(async () => {
      renderHook(() => useFileEvents(onOpen));
    });

    // Resolve drain#1 from first mount — must deliver exactly once
    await act(async () => {
      resolveDrain1First!(["/tmp/b.xlsx"]);
    });

    expect(onOpen).toHaveBeenCalledWith("/tmp/b.xlsx");
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("drain#2 catches path queued during listener-registration gap", async () => {
    // drain#1 returns [], but a file arrives in the gap between drain#1 and
    // listener registration. drain#2 should pick it up.
    mockTakePendingFiles
      .mockResolvedValueOnce([]) // drain#1: empty
      .mockResolvedValueOnce(["/tmp/d.xlsx"]); // drain#2: catches the race

    mockIsSupportedFile.mockImplementation((p: string) => p.endsWith(".xlsx"));

    const onOpen = vi.fn();
    await act(async () => {
      renderHook(() => useFileEvents(onOpen));
    });

    expect(onOpen).toHaveBeenCalledWith("/tmp/d.xlsx");
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("drain#2 dedupes path already delivered by event before drain#2 resolves", async () => {
    // drain#1 returns [], the event fires ["/tmp/e.xlsx"] (listener already
    // registered), then drain#2 also returns ["/tmp/e.xlsx"].
    // The delivered-set must prevent a second call to onOpen.
    let resolveDrain2: (v: string[]) => void;

    mockTakePendingFiles
      .mockResolvedValueOnce([]) // drain#1: empty
      .mockReturnValueOnce(
        new Promise<string[]>((res) => {
          resolveDrain2 = res;
        }),
      ); // drain#2: deferred so event fires first

    mockIsSupportedFile.mockImplementation((p: string) => p.endsWith(".xlsx"));

    const onOpen = vi.fn();

    // Mount and let drain#1 + listener registration complete, but drain#2 is
    // still pending.
    act(() => {
      renderHook(() => useFileEvents(onOpen));
    });
    // Flush microtasks so drain#1 and listener registration resolve
    await act(async () => {});

    // Event fires while drain#2 is still pending
    await act(async () => {
      filesOpenedCb?.(["/tmp/e.xlsx"]);
    });

    expect(onOpen).toHaveBeenCalledTimes(1);

    // drain#2 resolves with the same path — delivered-set should suppress it
    await act(async () => {
      resolveDrain2!(["/tmp/e.xlsx"]);
    });

    expect(onOpen).toHaveBeenCalledTimes(1); // still only once
  });

  it("event re-delivers same path later (warm reopen not blocked by delivered set)", async () => {
    // drain#1 delivers "/tmp/f.xlsx". Later the user opens the same file again
    // via the event. The event path is NOT blocked by the delivered-set (only
    // drain deliveries are deduplicated), so onOpen must be called twice total.
    mockTakePendingFiles
      .mockResolvedValueOnce(["/tmp/f.xlsx"]) // drain#1
      .mockResolvedValueOnce([]); // drain#2

    mockIsSupportedFile.mockImplementation((p: string) => p.endsWith(".xlsx"));

    const onOpen = vi.fn();
    await act(async () => {
      renderHook(() => useFileEvents(onOpen));
    });

    // First delivery via drain#1
    expect(onOpen).toHaveBeenCalledWith("/tmp/f.xlsx");
    expect(onOpen).toHaveBeenCalledTimes(1);

    // User re-opens the same file via the event (warm reopen)
    await act(async () => {
      filesOpenedCb?.(["/tmp/f.xlsx"]);
    });

    // Must be called again — event deliveries bypass the delivered-set
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen).toHaveBeenNthCalledWith(2, "/tmp/f.xlsx");
  });
});
