import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { Workspace } from "@/lib/workspace-store";
import { useWorkspaces } from "./useWorkspaces";

vi.mock("@/lib/workspace-store", async (orig) => ({
  ...(await orig<typeof import("@/lib/workspace-store")>()),
  readWorkspaces: vi.fn().mockResolvedValue([]),
  writeWorkspaces: vi.fn(),
}));

// Import the mocked versions so we can control/assert them
import { readWorkspaces, writeWorkspaces } from "@/lib/workspace-store";

const mockReadWorkspaces = readWorkspaces as ReturnType<typeof vi.fn>;
const mockWriteWorkspaces = writeWorkspaces as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockReadWorkspaces.mockResolvedValue([]);
});

describe("useWorkspaces", () => {
  it("hydrates workspaces on mount", async () => {
    const seed: Workspace[] = [
      {
        id: "ws-1",
        name: "Alpha",
        files: [],
        createdAt: 1000,
        collapsed: false,
      },
      {
        id: "ws-2",
        name: "Beta",
        files: [],
        createdAt: 2000,
        collapsed: false,
      },
    ];
    mockReadWorkspaces.mockResolvedValue(seed);

    const { result } = renderHook(() => useWorkspaces());

    await waitFor(() => expect(result.current.workspaces).toHaveLength(2));
    expect(result.current.workspaces[0].name).toBe("Alpha");
    expect(result.current.workspaces[1].name).toBe("Beta");
  });

  it("create adds a workspace and returns the new id", async () => {
    const { result } = renderHook(() => useWorkspaces());
    await waitFor(() => expect(result.current.workspaces).toHaveLength(0));

    let id!: string;
    act(() => {
      id = result.current.create("WS A");
    });

    expect(result.current.workspaces).toHaveLength(1);
    expect(result.current.workspaces[0].id).toBe(id);
    expect(result.current.workspaces[0].name).toBe("WS A");
    expect(mockWriteWorkspaces).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id, name: "WS A" })]),
    );
  });

  it("addFile then isInAnyWorkspace returns true; removeFile returns false", async () => {
    const { result } = renderHook(() => useWorkspaces());
    await waitFor(() => expect(result.current.workspaces).toHaveLength(0));

    let id!: string;
    act(() => {
      id = result.current.create("WS B");
    });

    act(() => {
      result.current.addFile(id, {
        path: "/foo/bar.xlsx",
        fileName: "bar.xlsx",
      });
    });

    expect(result.current.isInAnyWorkspace("/foo/bar.xlsx")).toBe(true);

    act(() => {
      result.current.removeFile(id, "/foo/bar.xlsx");
    });

    expect(result.current.isInAnyWorkspace("/foo/bar.xlsx")).toBe(false);
  });

  it("toggleCollapse flips the collapsed field", async () => {
    const seed: Workspace[] = [
      {
        id: "ws-toggle",
        name: "Toggle Me",
        files: [],
        createdAt: 3000,
        collapsed: false,
      },
    ];
    mockReadWorkspaces.mockResolvedValue(seed);

    const { result } = renderHook(() => useWorkspaces());
    await waitFor(() => expect(result.current.workspaces).toHaveLength(1));

    expect(result.current.workspaces[0].collapsed).toBe(false);

    act(() => {
      result.current.toggleCollapse("ws-toggle");
    });

    expect(result.current.workspaces[0].collapsed).toBe(true);

    act(() => {
      result.current.toggleCollapse("ws-toggle");
    });

    expect(result.current.workspaces[0].collapsed).toBe(false);
  });

  it("rename updates the workspace name", async () => {
    const seed: Workspace[] = [
      {
        id: "ws-rename",
        name: "Old Name",
        files: [],
        createdAt: 4000,
        collapsed: false,
      },
    ];
    mockReadWorkspaces.mockResolvedValue(seed);

    const { result } = renderHook(() => useWorkspaces());
    await waitFor(() => expect(result.current.workspaces).toHaveLength(1));

    act(() => {
      result.current.rename("ws-rename", "New Name");
    });

    expect(result.current.workspaces[0].name).toBe("New Name");
    expect(mockWriteWorkspaces).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "ws-rename", name: "New Name" }),
      ]),
    );
  });

  it("remove deletes the workspace", async () => {
    const seed: Workspace[] = [
      {
        id: "ws-del",
        name: "To Delete",
        files: [],
        createdAt: 5000,
        collapsed: false,
      },
      {
        id: "ws-keep",
        name: "Keep Me",
        files: [],
        createdAt: 6000,
        collapsed: false,
      },
    ];
    mockReadWorkspaces.mockResolvedValue(seed);

    const { result } = renderHook(() => useWorkspaces());
    await waitFor(() => expect(result.current.workspaces).toHaveLength(2));

    act(() => {
      result.current.remove("ws-del");
    });

    expect(result.current.workspaces).toHaveLength(1);
    expect(result.current.workspaces[0].id).toBe("ws-keep");
  });
});
