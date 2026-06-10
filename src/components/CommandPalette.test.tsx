import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, userEvent, fireEvent } from "@/test/render";
import { CommandPalette } from "./CommandPalette";
import type { PaletteMode } from "./CommandPalette";
import type { RecentFile } from "@/hooks/useWorkbook";

const RECENTS: RecentFile[] = [
  { path: "/docs/report.xlsx", fileName: "report.xlsx", openedAt: 1000 },
  { path: "/docs/data.csv", fileName: "data.csv", openedAt: 900 },
];

function makeProps(overrides: Partial<Parameters<typeof CommandPalette>[0]> = {}) {
  return {
    open: true,
    mode: "root" as PaletteMode,
    onOpenChange: vi.fn(),
    onModeChange: vi.fn(),
    onGoto: vi.fn(() => null as string | null),
    hasFile: true,
    recents: RECENTS,
    onOpenRecent: vi.fn(),
    ...overrides,
  } satisfies Parameters<typeof CommandPalette>[0];
}

describe("CommandPalette", () => {
  describe("visibility", () => {
    it("renders nothing when open=false", () => {
      renderWithProviders(<CommandPalette {...makeProps({ open: false })} />);
      expect(screen.queryByText("Command Palette")).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/command/i)).not.toBeInTheDocument();
    });

    it("renders the palette when open=true", () => {
      renderWithProviders(<CommandPalette {...makeProps()} />);
      // sr-only DialogTitle should be in the DOM
      expect(screen.getByText("Command Palette")).toBeInTheDocument();
    });
  });

  describe("mode=root with hasFile=true", () => {
    it("shows Commands section header", () => {
      renderWithProviders(<CommandPalette {...makeProps()} />);
      expect(screen.getByText("Commands")).toBeInTheDocument();
    });

    it("shows Recent Files section header", () => {
      renderWithProviders(<CommandPalette {...makeProps()} />);
      expect(screen.getByText("Recent Files")).toBeInTheDocument();
    });

    it("shows Goto command", () => {
      renderWithProviders(<CommandPalette {...makeProps()} />);
      expect(screen.getByText("Goto")).toBeInTheDocument();
    });

    it("shows recent files (excluding currentPath)", () => {
      renderWithProviders(
        <CommandPalette
          {...makeProps({ currentPath: "/docs/report.xlsx" })}
        />
      );
      // report.xlsx is currentPath so filtered out; data.csv visible
      expect(screen.queryByText("report.xlsx")).not.toBeInTheDocument();
      expect(screen.getByText("data.csv")).toBeInTheDocument();
    });

    it("shows all recents when currentPath is null", () => {
      renderWithProviders(<CommandPalette {...makeProps({ currentPath: null })} />);
      expect(screen.getByText("report.xlsx")).toBeInTheDocument();
      expect(screen.getByText("data.csv")).toBeInTheDocument();
    });

    it("shows Summarize command when onOpenSummary provided", () => {
      renderWithProviders(
        <CommandPalette {...makeProps({ onOpenSummary: vi.fn() })} />
      );
      expect(screen.getByText("Summarize selection")).toBeInTheDocument();
    });

    it("hides Summarize command when onOpenSummary is absent", () => {
      renderWithProviders(<CommandPalette {...makeProps()} />);
      expect(screen.queryByText("Summarize selection")).not.toBeInTheDocument();
    });

    it("shows Copy file command when onCopyFile provided", () => {
      renderWithProviders(
        <CommandPalette {...makeProps({ onCopyFile: vi.fn() })} />
      );
      expect(screen.getByText("Copy file")).toBeInTheDocument();
    });

    it("hides Copy file command when onCopyFile is absent", () => {
      renderWithProviders(<CommandPalette {...makeProps()} />);
      expect(screen.queryByText("Copy file")).not.toBeInTheDocument();
    });

    it("shows Copy file path command when onCopyFilePath provided", () => {
      renderWithProviders(
        <CommandPalette {...makeProps({ onCopyFilePath: vi.fn() })} />
      );
      expect(screen.getByText("Copy file path")).toBeInTheDocument();
    });

    it("hides Copy file path when onCopyFilePath is absent", () => {
      renderWithProviders(<CommandPalette {...makeProps()} />);
      expect(screen.queryByText("Copy file path")).not.toBeInTheDocument();
    });

    it("shows Check for Updates when onCheckUpdates provided", () => {
      renderWithProviders(
        <CommandPalette {...makeProps({ onCheckUpdates: vi.fn() })} />
      );
      expect(screen.getByText("Check for Updates")).toBeInTheDocument();
    });

    it("hides Check for Updates when onCheckUpdates is absent", () => {
      renderWithProviders(<CommandPalette {...makeProps()} />);
      expect(screen.queryByText("Check for Updates")).not.toBeInTheDocument();
    });

    it("shows Open file command when onPickFile provided", () => {
      renderWithProviders(
        <CommandPalette {...makeProps({ onPickFile: vi.fn() })} />
      );
      expect(screen.getByText("Open file…")).toBeInTheDocument();
    });

    it("shows Open workspaces panel command when onOpenWorkspace provided", () => {
      renderWithProviders(
        <CommandPalette {...makeProps({ onOpenWorkspace: vi.fn() })} />
      );
      expect(screen.getByText("Open workspaces panel")).toBeInTheDocument();
    });

    it("hides Open workspaces panel command when onOpenWorkspace is absent", () => {
      renderWithProviders(<CommandPalette {...makeProps()} />);
      expect(screen.queryByText("Open workspaces panel")).not.toBeInTheDocument();
    });

    it("shows Open settings command when onOpenSettings provided", () => {
      renderWithProviders(
        <CommandPalette {...makeProps({ onOpenSettings: vi.fn() })} />
      );
      expect(screen.getByText("Open settings")).toBeInTheDocument();
    });

    it("hides Open settings command when onOpenSettings is absent", () => {
      renderWithProviders(<CommandPalette {...makeProps()} />);
      expect(screen.queryByText("Open settings")).not.toBeInTheDocument();
    });
  });

  describe("mode=root with hasFile=false", () => {
    it("shows only Recent Files section when hasFile=false", () => {
      renderWithProviders(
        <CommandPalette {...makeProps({ hasFile: false })} />
      );
      // Only Recent Files section, no Commands section
      expect(screen.queryByText("Commands")).not.toBeInTheDocument();
      expect(screen.getByText("Recent Files")).toBeInTheDocument();
    });

    it("shows no-recent message when recents are empty and hasFile=false", () => {
      renderWithProviders(
        <CommandPalette {...makeProps({ hasFile: false, recents: [] })} />
      );
      expect(screen.getByText("No recent files.")).toBeInTheDocument();
    });

    it("uses searchRecent placeholder when hasFile=false", () => {
      renderWithProviders(
        <CommandPalette {...makeProps({ hasFile: false })} />
      );
      expect(
        screen.getByPlaceholderText("Search recent files…")
      ).toBeInTheDocument();
    });

    it("shows Open settings command when hasFile=false (Welcome screen)", () => {
      renderWithProviders(
        <CommandPalette {...makeProps({ hasFile: false, onOpenSettings: vi.fn() })} />
      );
      expect(screen.getByText("Commands")).toBeInTheDocument();
      expect(screen.getByText("Open settings")).toBeInTheDocument();
    });

    it("runs onOpenSettings from Welcome screen and closes palette", async () => {
      const onOpenSettings = vi.fn();
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(
        <CommandPalette {...makeProps({ hasFile: false, onOpenSettings, onOpenChange })} />
      );
      await user.click(screen.getByText("Open settings"));
      expect(onOpenSettings).toHaveBeenCalledOnce();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("shows Open workspaces panel command when hasFile=false", () => {
      renderWithProviders(
        <CommandPalette {...makeProps({ hasFile: false, onOpenWorkspace: vi.fn() })} />
      );
      expect(screen.getByText("Open workspaces panel")).toBeInTheDocument();
    });
  });

  describe("callback invocation", () => {
    it("clicking Goto fires onModeChange('goto')", async () => {
      const user = userEvent.setup();
      const onModeChange = vi.fn();
      renderWithProviders(
        <CommandPalette {...makeProps({ onModeChange })} />
      );
      await user.click(screen.getByText("Goto"));
      expect(onModeChange).toHaveBeenCalledWith("goto");
    });

    it("clicking onPickFile item calls onPickFile and closes palette", async () => {
      const user = userEvent.setup();
      const onPickFile = vi.fn();
      const onOpenChange = vi.fn();
      renderWithProviders(
        <CommandPalette
          {...makeProps({ onPickFile, onOpenChange })}
        />
      );
      await user.click(screen.getByText("Open file…"));
      expect(onPickFile).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("clicking onOpenSummary item calls onOpenSummary and closes palette", async () => {
      const user = userEvent.setup();
      const onOpenSummary = vi.fn();
      const onOpenChange = vi.fn();
      renderWithProviders(
        <CommandPalette {...makeProps({ onOpenSummary, onOpenChange })} />
      );
      await user.click(screen.getByText("Summarize selection"));
      expect(onOpenSummary).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("clicking onCopyFile item calls onCopyFile and closes palette", async () => {
      const user = userEvent.setup();
      const onCopyFile = vi.fn();
      const onOpenChange = vi.fn();
      renderWithProviders(
        <CommandPalette {...makeProps({ onCopyFile, onOpenChange })} />
      );
      await user.click(screen.getByText("Copy file"));
      expect(onCopyFile).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("clicking onCopyFilePath item calls onCopyFilePath and closes palette", async () => {
      const user = userEvent.setup();
      const onCopyFilePath = vi.fn();
      const onOpenChange = vi.fn();
      renderWithProviders(
        <CommandPalette {...makeProps({ onCopyFilePath, onOpenChange })} />
      );
      await user.click(screen.getByText("Copy file path"));
      expect(onCopyFilePath).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("clicking onCheckUpdates item calls onCheckUpdates and closes palette", async () => {
      const user = userEvent.setup();
      const onCheckUpdates = vi.fn();
      const onOpenChange = vi.fn();
      renderWithProviders(
        <CommandPalette {...makeProps({ onCheckUpdates, onOpenChange })} />
      );
      await user.click(screen.getByText("Check for Updates"));
      expect(onCheckUpdates).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("clicking onOpenWorkspace item calls onOpenWorkspace and closes palette", async () => {
      const user = userEvent.setup();
      const onOpenWorkspace = vi.fn();
      const onOpenChange = vi.fn();
      renderWithProviders(
        <CommandPalette {...makeProps({ onOpenWorkspace, onOpenChange })} />
      );
      await user.click(screen.getByText("Open workspaces panel"));
      expect(onOpenWorkspace).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("clicking onOpenSettings item calls onOpenSettings and closes palette", async () => {
      const user = userEvent.setup();
      const onOpenSettings = vi.fn();
      const onOpenChange = vi.fn();
      renderWithProviders(
        <CommandPalette {...makeProps({ onOpenSettings, onOpenChange })} />
      );
      await user.click(screen.getByText("Open settings"));
      expect(onOpenSettings).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("clicking a recent file calls onOpenRecent with its path and closes palette", async () => {
      const user = userEvent.setup();
      const onOpenRecent = vi.fn();
      const onOpenChange = vi.fn();
      renderWithProviders(
        <CommandPalette
          {...makeProps({ onOpenRecent, onOpenChange, currentPath: null })}
        />
      );
      await user.click(screen.getByText("report.xlsx"));
      expect(onOpenRecent).toHaveBeenCalledWith("/docs/report.xlsx");
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("query filtering", () => {
    it("filters to items matching query text", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <CommandPalette {...makeProps({ onOpenSummary: vi.fn() })} />
      );
      const input = screen.getByPlaceholderText("Type a command…");
      await user.type(input, "summarize");
      expect(screen.getByText("Summarize selection")).toBeInTheDocument();
      expect(screen.queryByText("Goto")).not.toBeInTheDocument();
    });

    it("shows noMatch message when query has no results", async () => {
      const user = userEvent.setup();
      renderWithProviders(<CommandPalette {...makeProps()} />);
      const input = screen.getByPlaceholderText("Type a command…");
      await user.type(input, "xyzzy123nomatchwhatsoever");
      expect(screen.getByText("No commands match.")).toBeInTheDocument();
    });

    it("filters recent files by fileName", async () => {
      const user = userEvent.setup();
      renderWithProviders(<CommandPalette {...makeProps({ currentPath: null })} />);
      const input = screen.getByPlaceholderText("Type a command…");
      await user.type(input, "data");
      expect(screen.getByText("data.csv")).toBeInTheDocument();
      expect(screen.queryByText("report.xlsx")).not.toBeInTheDocument();
    });

    it("filters by subtitle (path) match", async () => {
      const user = userEvent.setup();
      renderWithProviders(<CommandPalette {...makeProps({ currentPath: null })} />);
      const input = screen.getByPlaceholderText("Type a command…");
      await user.type(input, "/docs/report");
      expect(screen.getByText("report.xlsx")).toBeInTheDocument();
    });

    it("clears filter when query is cleared", async () => {
      const user = userEvent.setup();
      renderWithProviders(<CommandPalette {...makeProps()} />);
      const input = screen.getByPlaceholderText("Type a command…");
      await user.type(input, "goto");
      expect(screen.getByText("Goto")).toBeInTheDocument();
      await user.clear(input);
      // Back to showing all items
      expect(screen.getByText("Goto")).toBeInTheDocument();
      expect(screen.getByText("Recent Files")).toBeInTheDocument();
    });
  });

  describe("mode=goto", () => {
    it("shows cellRefPlaceholder in goto mode", () => {
      renderWithProviders(
        <CommandPalette {...makeProps({ mode: "goto" })} />
      );
      expect(
        screen.getByPlaceholderText("Cell reference (e.g. A1, B12, AB45)")
      ).toBeInTheDocument();
    });

    it("shows the goto mode badge button", () => {
      renderWithProviders(
        <CommandPalette {...makeProps({ mode: "goto" })} />
      );
      // The mode badge button shows mode text ("goto")
      expect(screen.getByRole("button", { name: /goto/i })).toBeInTheDocument();
    });

    it("shows gotoHelp text in goto mode", () => {
      renderWithProviders(
        <CommandPalette {...makeProps({ mode: "goto" })} />
      );
      expect(screen.getByText("Press Enter to jump. Esc to back.")).toBeInTheDocument();
    });

    it("does not show commands list in goto mode", () => {
      renderWithProviders(
        <CommandPalette {...makeProps({ mode: "goto" })} />
      );
      expect(screen.queryByText("Commands")).not.toBeInTheDocument();
      expect(screen.queryByText("Recent Files")).not.toBeInTheDocument();
    });

    it("Enter in goto mode calls onGoto with typed ref and closes on success", async () => {
      const user = userEvent.setup();
      const onGoto = vi.fn(() => null as string | null);
      const onOpenChange = vi.fn();
      renderWithProviders(
        <CommandPalette
          {...makeProps({ mode: "goto", onGoto, onOpenChange })}
        />
      );
      const input = screen.getByPlaceholderText("Cell reference (e.g. A1, B12, AB45)");
      await user.type(input, "B12");
      fireEvent.keyDown(input, { key: "Enter" });
      expect(onGoto).toHaveBeenCalledWith("B12");
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("Enter in goto mode shows error when onGoto returns a string", async () => {
      const user = userEvent.setup();
      const onGoto = vi.fn(() => "Invalid cell reference" as string | null);
      renderWithProviders(
        <CommandPalette {...makeProps({ mode: "goto", onGoto })} />
      );
      const input = screen.getByPlaceholderText("Cell reference (e.g. A1, B12, AB45)");
      await user.type(input, "BADINPUT");
      fireEvent.keyDown(input, { key: "Enter" });
      expect(await screen.findByText("Invalid cell reference")).toBeInTheDocument();
    });

    it("error clears when user types again after error", async () => {
      const user = userEvent.setup();
      const onGoto = vi.fn().mockReturnValueOnce("Invalid cell reference").mockReturnValue(null);
      renderWithProviders(
        <CommandPalette {...makeProps({ mode: "goto", onGoto })} />
      );
      const input = screen.getByPlaceholderText("Cell reference (e.g. A1, B12, AB45)");
      await user.type(input, "X");
      fireEvent.keyDown(input, { key: "Enter" });
      expect(await screen.findByText("Invalid cell reference")).toBeInTheDocument();
      await user.type(input, "1");
      expect(screen.queryByText("Invalid cell reference")).not.toBeInTheDocument();
    });

    it("clicking the mode badge calls onModeChange('root')", async () => {
      const user = userEvent.setup();
      const onModeChange = vi.fn();
      renderWithProviders(
        <CommandPalette {...makeProps({ mode: "goto", onModeChange })} />
      );
      const badge = screen.getByRole("button", { name: /goto/i });
      await user.click(badge);
      expect(onModeChange).toHaveBeenCalledWith("root");
    });

    it("Escape in goto mode calls onModeChange('root')", () => {
      const onModeChange = vi.fn();
      renderWithProviders(
        <CommandPalette {...makeProps({ mode: "goto", onModeChange })} />
      );
      const input = screen.getByPlaceholderText("Cell reference (e.g. A1, B12, AB45)");
      fireEvent.keyDown(input, { key: "Escape" });
      expect(onModeChange).toHaveBeenCalledWith("root");
    });
  });

  describe("keyboard navigation in root mode", () => {
    it("Escape in root mode calls onOpenChange(false)", () => {
      const onOpenChange = vi.fn();
      renderWithProviders(
        <CommandPalette {...makeProps({ onOpenChange })} />
      );
      const input = screen.getByPlaceholderText("Type a command…");
      fireEvent.keyDown(input, { key: "Escape" });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("ArrowDown moves activeIdx down and ArrowUp moves it up", async () => {
      const onModeChange = vi.fn();
      renderWithProviders(
        <CommandPalette {...makeProps({ onModeChange })} />
      );
      const input = screen.getByPlaceholderText("Type a command…");
      // Press down to move to index 1, then Enter should run that item
      fireEvent.keyDown(input, { key: "ArrowDown" });
      // Press up to go back to index 0
      fireEvent.keyDown(input, { key: "ArrowUp" });
      // Now Enter on the Goto item at index 0 should call onModeChange
      fireEvent.keyDown(input, { key: "Enter" });
      expect(onModeChange).toHaveBeenCalledWith("goto");
    });

    it("Enter in root mode runs the active command (Goto at index 0)", () => {
      const onModeChange = vi.fn();
      renderWithProviders(
        <CommandPalette {...makeProps({ onModeChange })} />
      );
      const input = screen.getByPlaceholderText("Type a command…");
      fireEvent.keyDown(input, { key: "Enter" });
      expect(onModeChange).toHaveBeenCalledWith("goto");
    });

    it("ArrowDown clamps at the last item", async () => {
      const onOpenRecent = vi.fn();
      renderWithProviders(
        <CommandPalette {...makeProps({ onOpenRecent, currentPath: null })} />
      );
      const input = screen.getByPlaceholderText("Type a command…");
      // Press down many times beyond item count
      for (let i = 0; i < 20; i++) {
        fireEvent.keyDown(input, { key: "ArrowDown" });
      }
      fireEvent.keyDown(input, { key: "Enter" });
      // Should have fired onOpenRecent for the last item (data.csv)
      expect(onOpenRecent).toHaveBeenCalledWith("/docs/data.csv");
    });

    it("Enter on empty list does nothing", async () => {
      const user = userEvent.setup();
      const onModeChange = vi.fn();
      renderWithProviders(
        <CommandPalette {...makeProps({ onModeChange })} />
      );
      const input = screen.getByPlaceholderText("Type a command…");
      await user.type(input, "xyzzy123nomatchwhatsoever");
      fireEvent.keyDown(input, { key: "Enter" });
      expect(onModeChange).not.toHaveBeenCalled();
    });
  });

  describe("typeCommand placeholder (hasFile=true)", () => {
    it("shows 'Type a command…' placeholder in root+hasFile mode", () => {
      renderWithProviders(<CommandPalette {...makeProps()} />);
      expect(screen.getByPlaceholderText("Type a command…")).toBeInTheDocument();
    });
  });
});
