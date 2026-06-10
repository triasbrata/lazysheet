import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/app-storage", () => ({
  readJson: vi.fn(),
  writeJson: vi.fn(),
}));

import { readJson, writeJson } from "@/lib/app-storage";
import {
  WORKSPACES_FILE,
  isWorkspaceArray,
  readWorkspaces,
  writeWorkspaces,
  newWorkspace,
  addWorkspace,
  renameWorkspace,
  deleteWorkspace,
  addFileToWorkspace,
  removeFileFromWorkspace,
  toggleCollapsed,
  isFileInAnyWorkspace,
  type Workspace,
} from "@/lib/workspace-store";

beforeEach(() => vi.clearAllMocks());

// ─── isWorkspaceArray ────────────────────────────────────────────────────────

describe("isWorkspaceArray", () => {
  it("returns false for non-array", () => {
    expect(isWorkspaceArray({})).toBe(false);
    expect(isWorkspaceArray(null)).toBe(false);
    expect(isWorkspaceArray("string")).toBe(false);
  });

  it("returns true for empty array", () => {
    expect(isWorkspaceArray([])).toBe(true);
  });

  it("returns false when item is missing required fields", () => {
    expect(isWorkspaceArray([{ bad: 1 }])).toBe(false);
  });

  it("returns false when files items have wrong shape", () => {
    const bad = [
      {
        id: "1",
        name: "n",
        files: [{ path: "p" }], // missing fileName and addedAt
        createdAt: 1,
        collapsed: false,
      },
    ];
    expect(isWorkspaceArray(bad)).toBe(false);
  });

  it("returns true for valid workspace array", () => {
    const valid: Workspace[] = [
      {
        id: "1",
        name: "ws",
        files: [{ path: "/a", fileName: "a.csv", addedAt: 1 }],
        createdAt: 1,
        collapsed: false,
      },
    ];
    expect(isWorkspaceArray(valid)).toBe(true);
  });
});

// ─── newWorkspace ────────────────────────────────────────────────────────────

describe("newWorkspace", () => {
  it("produces collapsed:false, empty files, and trimmed name", () => {
    const ws = newWorkspace("  my ws  ");
    expect(ws.name).toBe("my ws");
    expect(ws.collapsed).toBe(false);
    expect(ws.files).toEqual([]);
    expect(typeof ws.id).toBe("string");
    expect(ws.id.length).toBeGreaterThan(0);
    expect(typeof ws.createdAt).toBe("number");
  });
});

// ─── addWorkspace ────────────────────────────────────────────────────────────

describe("addWorkspace", () => {
  it("appends a new workspace to the list", () => {
    const list: Workspace[] = [];
    const result = addWorkspace(list, "Alpha");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Alpha");
    // original untouched
    expect(list).toHaveLength(0);
  });

  it("does not mutate the original list", () => {
    const list: Workspace[] = [
      { id: "x", name: "X", files: [], createdAt: 1, collapsed: false },
    ];
    const result = addWorkspace(list, "Beta");
    expect(result).toHaveLength(2);
    expect(list).toHaveLength(1);
  });
});

// ─── renameWorkspace ─────────────────────────────────────────────────────────

describe("renameWorkspace", () => {
  it("trims and sets name on matching id", () => {
    const list: Workspace[] = [
      { id: "1", name: "Old", files: [], createdAt: 1, collapsed: false },
      { id: "2", name: "Other", files: [], createdAt: 2, collapsed: false },
    ];
    const result = renameWorkspace(list, "1", "  New Name  ");
    expect(result[0].name).toBe("New Name");
    expect(result[1].name).toBe("Other");
  });

  it("does not mutate the original list", () => {
    const list: Workspace[] = [
      { id: "1", name: "Old", files: [], createdAt: 1, collapsed: false },
    ];
    renameWorkspace(list, "1", "New");
    expect(list[0].name).toBe("Old");
  });
});

// ─── deleteWorkspace ─────────────────────────────────────────────────────────

describe("deleteWorkspace", () => {
  it("removes the workspace with matching id", () => {
    const list: Workspace[] = [
      { id: "1", name: "A", files: [], createdAt: 1, collapsed: false },
      { id: "2", name: "B", files: [], createdAt: 2, collapsed: false },
    ];
    const result = deleteWorkspace(list, "1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("does not mutate the original list", () => {
    const list: Workspace[] = [
      { id: "1", name: "A", files: [], createdAt: 1, collapsed: false },
    ];
    deleteWorkspace(list, "1");
    expect(list).toHaveLength(1);
  });
});

// ─── addFileToWorkspace ───────────────────────────────────────────────────────

describe("addFileToWorkspace", () => {
  it("appends a file to the matching workspace", () => {
    const list: Workspace[] = [
      { id: "1", name: "A", files: [], createdAt: 1, collapsed: false },
    ];
    const result = addFileToWorkspace(list, "1", {
      path: "/data/a.csv",
      fileName: "a.csv",
    });
    expect(result[0].files).toHaveLength(1);
    expect(result[0].files[0].path).toBe("/data/a.csv");
    expect(result[0].files[0].fileName).toBe("a.csv");
    expect(typeof result[0].files[0].addedAt).toBe("number");
  });

  it("dedupes on same path", () => {
    const list: Workspace[] = [
      {
        id: "1",
        name: "A",
        files: [{ path: "/data/a.csv", fileName: "a.csv", addedAt: 100 }],
        createdAt: 1,
        collapsed: false,
      },
    ];
    const result = addFileToWorkspace(list, "1", {
      path: "/data/a.csv",
      fileName: "a.csv",
    });
    expect(result[0].files).toHaveLength(1);
  });

  it("does not mutate the original list", () => {
    const list: Workspace[] = [
      { id: "1", name: "A", files: [], createdAt: 1, collapsed: false },
    ];
    addFileToWorkspace(list, "1", { path: "/x", fileName: "x" });
    expect(list[0].files).toHaveLength(0);
  });
});

// ─── removeFileFromWorkspace ─────────────────────────────────────────────────

describe("removeFileFromWorkspace", () => {
  it("removes a file by path from the matching workspace", () => {
    const list: Workspace[] = [
      {
        id: "1",
        name: "A",
        files: [
          { path: "/a.csv", fileName: "a.csv", addedAt: 1 },
          { path: "/b.csv", fileName: "b.csv", addedAt: 2 },
        ],
        createdAt: 1,
        collapsed: false,
      },
    ];
    const result = removeFileFromWorkspace(list, "1", "/a.csv");
    expect(result[0].files).toHaveLength(1);
    expect(result[0].files[0].path).toBe("/b.csv");
  });

  it("does not mutate the original list", () => {
    const list: Workspace[] = [
      {
        id: "1",
        name: "A",
        files: [{ path: "/a.csv", fileName: "a.csv", addedAt: 1 }],
        createdAt: 1,
        collapsed: false,
      },
    ];
    removeFileFromWorkspace(list, "1", "/a.csv");
    expect(list[0].files).toHaveLength(1);
  });
});

// ─── toggleCollapsed ─────────────────────────────────────────────────────────

describe("toggleCollapsed", () => {
  it("flips collapsed from false to true", () => {
    const list: Workspace[] = [
      { id: "1", name: "A", files: [], createdAt: 1, collapsed: false },
    ];
    const result = toggleCollapsed(list, "1");
    expect(result[0].collapsed).toBe(true);
  });

  it("flips collapsed from true to false", () => {
    const list: Workspace[] = [
      { id: "1", name: "A", files: [], createdAt: 1, collapsed: true },
    ];
    const result = toggleCollapsed(list, "1");
    expect(result[0].collapsed).toBe(false);
  });

  it("does not mutate the original list", () => {
    const list: Workspace[] = [
      { id: "1", name: "A", files: [], createdAt: 1, collapsed: false },
    ];
    toggleCollapsed(list, "1");
    expect(list[0].collapsed).toBe(false);
  });
});

// ─── isFileInAnyWorkspace ────────────────────────────────────────────────────

describe("isFileInAnyWorkspace", () => {
  const list: Workspace[] = [
    {
      id: "1",
      name: "A",
      files: [{ path: "/data/a.csv", fileName: "a.csv", addedAt: 1 }],
      createdAt: 1,
      collapsed: false,
    },
    {
      id: "2",
      name: "B",
      files: [{ path: "/data/b.csv", fileName: "b.csv", addedAt: 2 }],
      createdAt: 2,
      collapsed: false,
    },
  ];

  it("returns true when path is present in any workspace", () => {
    expect(isFileInAnyWorkspace(list, "/data/a.csv")).toBe(true);
    expect(isFileInAnyWorkspace(list, "/data/b.csv")).toBe(true);
  });

  it("returns false when path is absent", () => {
    expect(isFileInAnyWorkspace(list, "/data/c.csv")).toBe(false);
  });
});

// ─── readWorkspaces ───────────────────────────────────────────────────────────

describe("readWorkspaces", () => {
  it("returns [] when readJson resolves with invalid shape (object)", async () => {
    vi.mocked(readJson).mockResolvedValue({});
    const result = await readWorkspaces();
    expect(result).toEqual([]);
  });

  it("returns [] when readJson resolves with invalid shape (bad array item)", async () => {
    vi.mocked(readJson).mockResolvedValue([{ bad: 1 }]);
    const result = await readWorkspaces();
    expect(result).toEqual([]);
  });

  it("returns the array when readJson resolves with valid data", async () => {
    const valid: Workspace[] = [
      {
        id: "1",
        name: "ws",
        files: [{ path: "/a", fileName: "a.csv", addedAt: 1 }],
        createdAt: 1,
        collapsed: false,
      },
    ];
    vi.mocked(readJson).mockResolvedValue(valid);
    const result = await readWorkspaces();
    expect(result).toEqual(valid);
  });

  it("returns [] for empty valid array", async () => {
    vi.mocked(readJson).mockResolvedValue([]);
    const result = await readWorkspaces();
    expect(result).toEqual([]);
  });
});

// ─── writeWorkspaces ─────────────────────────────────────────────────────────

describe("writeWorkspaces", () => {
  it("calls writeJson with WORKSPACES_FILE and the list", async () => {
    vi.mocked(writeJson).mockResolvedValue(undefined);
    const list: Workspace[] = [
      { id: "1", name: "ws", files: [], createdAt: 1, collapsed: false },
    ];
    await writeWorkspaces(list);
    expect(writeJson).toHaveBeenCalledWith(WORKSPACES_FILE, list);
    expect(writeJson).toHaveBeenCalledTimes(1);
  });
});
