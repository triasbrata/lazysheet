import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, userEvent, fireEvent } from "@/test/render";
import { AddToWorkspaceDialog } from "./AddToWorkspaceDialog";
import type { AddToWorkspaceState } from "./AddToWorkspaceDialog";
import type { Workspace } from "@/lib/workspace-store";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWorkspace(id: string, name: string): Workspace {
  return {
    id,
    name,
    files: [],
    createdAt: Date.now(),
    collapsed: false,
  };
}

const WS_A = makeWorkspace("ws-a", "Project Alpha");
const WS_B = makeWorkspace("ws-b", "Project Beta");

const OPEN_STATE: AddToWorkspaceState = {
  path: "/some/file.csv",
  fileName: "file.csv",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AddToWorkspaceDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── state=null → not rendered ────────────────────────────────────────────

  it("renders nothing when state is null", () => {
    renderWithProviders(
      <AddToWorkspaceDialog
        state={null}
        workspaces={[WS_A]}
        onConfirm={vi.fn()}
        onCreateAndAdd={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("add-to-workspace-dialog")).toBeNull();
  });

  // ── state set → shows dialog ─────────────────────────────────────────────

  it("shows fileName in description when state is set", () => {
    renderWithProviders(
      <AddToWorkspaceDialog
        state={OPEN_STATE}
        workspaces={[WS_A]}
        onConfirm={vi.fn()}
        onCreateAndAdd={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByText(/file\.csv/)).toBeInTheDocument();
  });

  it("shows Skip and Add buttons when open", () => {
    renderWithProviders(
      <AddToWorkspaceDialog
        state={OPEN_STATE}
        workspaces={[WS_A]}
        onConfirm={vi.fn()}
        onCreateAndAdd={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /skip/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument();
  });

  // ── existing mode: select workspace, click Add ───────────────────────────

  it("calls onConfirm with the first workspace id by default", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    renderWithProviders(
      <AddToWorkspaceDialog
        state={OPEN_STATE}
        workspaces={[WS_A, WS_B]}
        onConfirm={onConfirm}
        onCreateAndAdd={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /add/i }));
    expect(onConfirm).toHaveBeenCalledWith("ws-a");
  });

  it("calls onConfirm with the selected workspace id after changing selection", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    renderWithProviders(
      <AddToWorkspaceDialog
        state={OPEN_STATE}
        workspaces={[WS_A, WS_B]}
        onConfirm={onConfirm}
        onCreateAndAdd={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    const select = screen.getByTestId("workspace-select") as HTMLSelectElement;
    await userEvent.setup().selectOptions(select, "ws-b");

    await user.click(screen.getByRole("button", { name: /add/i }));
    expect(onConfirm).toHaveBeenCalledWith("ws-b");
  });

  // ── create mode via "create new" link ────────────────────────────────────

  it("switches to create mode when 'create new' button is clicked", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AddToWorkspaceDialog
        state={OPEN_STATE}
        workspaces={[WS_A]}
        onConfirm={vi.fn()}
        onCreateAndAdd={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    // In existing mode, the select is visible
    expect(screen.getByTestId("workspace-select")).toBeInTheDocument();

    // Click the "create new" ghost button
    const createNewBtn = screen.getByRole("button", { name: /create new/i });
    await user.click(createNewBtn);

    // Now the input is visible, select is gone
    expect(screen.queryByTestId("workspace-select")).toBeNull();
    expect(screen.getByTestId("new-workspace-name")).toBeInTheDocument();
  });

  it("calls onCreateAndAdd with typed name on Add click in create mode", async () => {
    const user = userEvent.setup();
    const onCreateAndAdd = vi.fn();

    renderWithProviders(
      <AddToWorkspaceDialog
        state={OPEN_STATE}
        workspaces={[WS_A]}
        onConfirm={vi.fn()}
        onCreateAndAdd={onCreateAndAdd}
        onSkip={vi.fn()}
      />,
    );

    // Switch to create mode
    await user.click(screen.getByRole("button", { name: /create new/i }));

    const input = screen.getByTestId("new-workspace-name");
    await user.type(input, "My New Workspace");

    await user.click(screen.getByRole("button", { name: /add/i }));
    expect(onCreateAndAdd).toHaveBeenCalledWith("My New Workspace");
  });

  // ── empty workspaces → starts in create mode ─────────────────────────────

  it("starts in create mode (shows input, no select) when workspaces is empty", () => {
    renderWithProviders(
      <AddToWorkspaceDialog
        state={OPEN_STATE}
        workspaces={[]}
        onConfirm={vi.fn()}
        onCreateAndAdd={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("workspace-select")).toBeNull();
    expect(screen.getByTestId("new-workspace-name")).toBeInTheDocument();
  });

  // ── Skip callback ────────────────────────────────────────────────────────

  it("calls onSkip when Skip button is clicked", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();

    renderWithProviders(
      <AddToWorkspaceDialog
        state={OPEN_STATE}
        workspaces={[WS_A]}
        onConfirm={vi.fn()}
        onCreateAndAdd={vi.fn()}
        onSkip={onSkip}
      />,
    );

    await user.click(screen.getByRole("button", { name: /skip/i }));
    expect(onSkip).toHaveBeenCalled();
  });

  // ── Add disabled when create-mode name is blank ──────────────────────────

  it("Add button is disabled when in create mode with empty name", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AddToWorkspaceDialog
        state={OPEN_STATE}
        workspaces={[WS_A]}
        onConfirm={vi.fn()}
        onCreateAndAdd={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    // Switch to create mode
    await user.click(screen.getByRole("button", { name: /create new/i }));

    // Input is empty → Add should be disabled
    const addBtn = screen.getByRole("button", { name: /add/i });
    expect(addBtn).toBeDisabled();
  });

  it("Add button is disabled when in create mode with whitespace-only name", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AddToWorkspaceDialog
        state={OPEN_STATE}
        workspaces={[WS_A]}
        onConfirm={vi.fn()}
        onCreateAndAdd={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /create new/i }));

    const input = screen.getByTestId("new-workspace-name");
    fireEvent.change(input, { target: { value: "   " } });

    const addBtn = screen.getByRole("button", { name: /add/i });
    expect(addBtn).toBeDisabled();
  });

  it("Add button is enabled after typing a non-blank name in create mode", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AddToWorkspaceDialog
        state={OPEN_STATE}
        workspaces={[]}
        onConfirm={vi.fn()}
        onCreateAndAdd={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    // Starts in create mode with empty workspaces
    const addBtn = screen.getByRole("button", { name: /add/i });
    expect(addBtn).toBeDisabled();

    const input = screen.getByTestId("new-workspace-name");
    await user.type(input, "New Workspace");

    expect(addBtn).not.toBeDisabled();
  });
});
