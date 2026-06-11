import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import type { Workspace } from "@/lib/workspace-store";
import { WorkspacePanel, type WorkspacePanelProps } from "./WorkspacePanel";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: "ws-1",
    name: "My Workspace",
    files: [
      { path: "/a/foo.xlsx", fileName: "foo.xlsx", addedAt: 1 },
      { path: "/b/bar.csv", fileName: "bar.csv", addedAt: 2 },
    ],
    createdAt: 1000,
    collapsed: false,
    ...overrides,
  };
}

function makeProps(overrides: Partial<WorkspacePanelProps> = {}): WorkspacePanelProps {
  return {
    open: true,
    workspaces: [makeWorkspace()],
    currentFile: { path: "/c/current.xlsx", fileName: "current.xlsx" },
    recents: [
      { path: "/d/recent1.xlsx", fileName: "recent1.xlsx" },
      { path: "/e/recent2.csv", fileName: "recent2.csv" },
    ],
    onCreate: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onToggleCollapse: vi.fn(),
    onAddFile: vi.fn(),
    onRemoveFile: vi.fn(),
    onOpenFile: vi.fn(),
    onBrowseAdd: vi.fn(),
    ...overrides,
  };
}

// ─── open=false ───────────────────────────────────────────────────────────────

describe("WorkspacePanel — closed", () => {
  it("renders nothing when open=false", () => {
    const { container } = renderWithProviders(
      <WorkspacePanel {...makeProps({ open: false })} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ─── open=true rendering ──────────────────────────────────────────────────────

describe("WorkspacePanel — open rendering", () => {
  it("renders the panel with workspace.title", () => {
    renderWithProviders(<WorkspacePanel {...makeProps()} />);
    expect(screen.getByTestId("workspace-panel")).toBeInTheDocument();
    expect(screen.getByText("Workspaces")).toBeInTheDocument();
  });

  it("renders each workspace name and file count", () => {
    renderWithProviders(<WorkspacePanel {...makeProps()} />);
    expect(screen.getByText("My Workspace")).toBeInTheDocument();
    expect(screen.getByText("2 files")).toBeInTheDocument();
  });

  it("renders multiple workspaces", () => {
    const props = makeProps({
      workspaces: [
        makeWorkspace({ id: "ws-1", name: "Alpha" }),
        makeWorkspace({ id: "ws-2", name: "Beta", files: [] }),
      ],
    });
    renderWithProviders(<WorkspacePanel {...props} />);
    expect(screen.getByTestId("workspace-ws-1")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-ws-2")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("shows workspace.empty when workspaces array is empty", () => {
    renderWithProviders(<WorkspacePanel {...makeProps({ workspaces: [] })} />);
    expect(screen.getByText("No workspaces yet")).toBeInTheDocument();
  });
});

// ─── Create workspace (inline draft) ───────────────────────────────────────────

describe("WorkspacePanel — create (inline draft)", () => {
  it("shows no draft input initially and reveals it after clicking the add button", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspacePanel {...makeProps()} />);

    expect(screen.queryByTestId("draft-workspace-input")).toBeNull();
    await user.click(screen.getByTestId("add-workspace-button"));
    expect(screen.getByTestId("draft-workspace-input")).toBeInTheDocument();
  });

  it("calls onCreate when the checkmark (confirm) is clicked", async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<WorkspacePanel {...makeProps({ onCreate })} />);

    await user.click(screen.getByTestId("add-workspace-button"));
    await user.type(screen.getByTestId("draft-workspace-input"), "New Space");
    await user.click(screen.getByTestId("draft-confirm-button"));

    expect(onCreate).toHaveBeenCalledWith("New Space");
    // draft row closes after commit
    expect(screen.queryByTestId("draft-workspace-input")).toBeNull();
  });

  it("calls onCreate when Enter is pressed in the draft input", async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<WorkspacePanel {...makeProps({ onCreate })} />);

    await user.click(screen.getByTestId("add-workspace-button"));
    await user.type(screen.getByTestId("draft-workspace-input"), "Enter Space{Enter}");

    expect(onCreate).toHaveBeenCalledWith("Enter Space");
  });

  it("does not call onCreate and closes the draft when name is empty on confirm", async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<WorkspacePanel {...makeProps({ onCreate })} />);

    await user.click(screen.getByTestId("add-workspace-button"));
    await user.click(screen.getByTestId("draft-confirm-button"));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.queryByTestId("draft-workspace-input")).toBeNull();
  });

  it("cancels the draft on Escape without calling onCreate", async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<WorkspacePanel {...makeProps({ onCreate })} />);

    await user.click(screen.getByTestId("add-workspace-button"));
    await user.type(screen.getByTestId("draft-workspace-input"), "Discard{Escape}");

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.queryByTestId("draft-workspace-input")).toBeNull();
  });
});

// ─── Toggle collapse ──────────────────────────────────────────────────────────

describe("WorkspacePanel — toggle collapse", () => {
  it("calls onToggleCollapse when the workspace header is clicked", async () => {
    const onToggleCollapse = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <WorkspacePanel {...makeProps({ onToggleCollapse })} />,
    );

    // Click the workspace name button (it triggers toggle)
    await user.click(screen.getByText("My Workspace"));
    expect(onToggleCollapse).toHaveBeenCalledWith("ws-1");
  });
});

// ─── File list (not collapsed) ────────────────────────────────────────────────

describe("WorkspacePanel — file list", () => {
  it("renders files when workspace is not collapsed", () => {
    renderWithProviders(<WorkspacePanel {...makeProps()} />);
    expect(screen.getByText("foo.xlsx")).toBeInTheDocument();
    expect(screen.getByText("bar.csv")).toBeInTheDocument();
  });

  it("does not render files when workspace is collapsed", () => {
    const props = makeProps({
      workspaces: [makeWorkspace({ collapsed: true })],
    });
    renderWithProviders(<WorkspacePanel {...props} />);
    expect(screen.queryByText("foo.xlsx")).toBeNull();
    expect(screen.queryByText("bar.csv")).toBeNull();
  });

  it("calls onOpenFile when a file name button is clicked", async () => {
    const onOpenFile = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<WorkspacePanel {...makeProps({ onOpenFile })} />);

    await user.click(screen.getByRole("button", { name: "foo.xlsx" }));
    expect(onOpenFile).toHaveBeenCalledWith("/a/foo.xlsx");
  });

  it("calls onRemoveFile when the remove button for a file is clicked", async () => {
    const onRemoveFile = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<WorkspacePanel {...makeProps({ onRemoveFile })} />);

    const removeButtons = screen.getAllByRole("button", {
      name: "Remove from workspace",
    });
    await user.click(removeButtons[0]);
    expect(onRemoveFile).toHaveBeenCalledWith("ws-1", "/a/foo.xlsx");
  });
});

// ─── Delete workspace ─────────────────────────────────────────────────────────

describe("WorkspacePanel — delete (confirm modal)", () => {
  it("does NOT delete immediately — shows a confirm modal first", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<WorkspacePanel {...makeProps({ onDelete })} />);

    await user.click(screen.getByRole("button", { name: "Delete workspace" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByTestId("delete-workspace-dialog")).toBeInTheDocument();
  });

  it("calls onDelete after confirming in the modal", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<WorkspacePanel {...makeProps({ onDelete })} />);

    await user.click(screen.getByRole("button", { name: "Delete workspace" }));
    await user.click(screen.getByTestId("confirm-delete-workspace"));

    expect(onDelete).toHaveBeenCalledWith("ws-1");
  });

  it("does not call onDelete when the modal is cancelled", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<WorkspacePanel {...makeProps({ onDelete })} />);

    await user.click(screen.getByRole("button", { name: "Delete workspace" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onDelete).not.toHaveBeenCalled();
  });
});

// ─── Add file dropdown ────────────────────────────────────────────────────────

describe("WorkspacePanel — add file dropdown", () => {
  it("shows add-current and recents after opening the add dropdown", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspacePanel {...makeProps()} />);

    await user.click(screen.getByRole("button", { name: "Add file" }));

    expect(screen.getByText("Add current file")).toBeInTheDocument();
    expect(screen.getByText("recent1.xlsx")).toBeInTheDocument();
    expect(screen.getByText("recent2.csv")).toBeInTheDocument();
    expect(screen.getByText("Browse…")).toBeInTheDocument();
  });

  it("calls onAddFile with currentFile when 'Add current file' is clicked", async () => {
    const onAddFile = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<WorkspacePanel {...makeProps({ onAddFile })} />);

    await user.click(screen.getByRole("button", { name: "Add file" }));
    await user.click(screen.getByText("Add current file"));

    expect(onAddFile).toHaveBeenCalledWith("ws-1", {
      path: "/c/current.xlsx",
      fileName: "current.xlsx",
    });
  });

  it("calls onAddFile with a recent file when a recent item is clicked", async () => {
    const onAddFile = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<WorkspacePanel {...makeProps({ onAddFile })} />);

    await user.click(screen.getByRole("button", { name: "Add file" }));
    await user.click(screen.getByText("recent1.xlsx"));

    expect(onAddFile).toHaveBeenCalledWith("ws-1", {
      path: "/d/recent1.xlsx",
      fileName: "recent1.xlsx",
    });
  });

  it("calls onBrowseAdd when the Browse item is clicked", async () => {
    const onBrowseAdd = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<WorkspacePanel {...makeProps({ onBrowseAdd })} />);

    await user.click(screen.getByRole("button", { name: "Add file" }));
    await user.click(screen.getByText("Browse…"));

    expect(onBrowseAdd).toHaveBeenCalledWith("ws-1");
  });

  it("does not show 'Add current file' when currentFile is already in workspace", async () => {
    const user = userEvent.setup();
    const ws = makeWorkspace({
      files: [
        { path: "/c/current.xlsx", fileName: "current.xlsx", addedAt: 1 },
      ],
    });
    renderWithProviders(
      <WorkspacePanel {...makeProps({ workspaces: [ws] })} />,
    );

    await user.click(screen.getByRole("button", { name: "Add file" }));
    expect(screen.queryByText("Add current file")).toBeNull();
  });

  it("does not show already-added recents in the dropdown", async () => {
    const user = userEvent.setup();
    const ws = makeWorkspace({
      files: [
        { path: "/d/recent1.xlsx", fileName: "recent1.xlsx", addedAt: 1 },
      ],
    });
    renderWithProviders(
      <WorkspacePanel {...makeProps({ workspaces: [ws] })} />,
    );

    await user.click(screen.getByRole("button", { name: "Add file" }));

    // recent1.xlsx appears once (as a file-list row button), but NOT as a
    // dropdown menu item — so queryAllByText should return exactly 1 hit that
    // is not inside the dropdown-menu-content.
    const hits = screen.queryAllByText("recent1.xlsx");
    const inMenu = hits.filter(
      (el) => el.closest("[data-slot='dropdown-menu-content']") !== null,
    );
    expect(inMenu).toHaveLength(0);
    expect(screen.getByText("recent2.csv")).toBeInTheDocument();
  });
});

