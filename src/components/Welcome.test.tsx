import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "react";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { Welcome } from "@/components/Welcome";
import type { RecentFile } from "@/hooks/useWorkbook";

// Mock the tauri-api module
vi.mock("@/lib/tauri-api", () => ({
  pickFile: vi.fn(),
}));

import { pickFile } from "@/lib/tauri-api";
const mockPickFile = vi.mocked(pickFile);

const noopOpen = vi.fn();

const makeRecents = (n: number): RecentFile[] =>
  Array.from({ length: n }, (_, i) => ({
    path: `/home/user/file${i}.xlsx`,
    fileName: `file${i}.xlsx`,
    openedAt: Date.now() - i * 1000,
  }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Welcome", () => {
  describe("default render", () => {
    it("renders the title and open button", () => {
      renderWithProviders(
        <Welcome onOpen={noopOpen} recents={[]} dragOver={false} />,
      );
      expect(screen.getByText("Open a spreadsheet")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /open file/i }),
      ).toBeInTheDocument();
    });

    it("shows drop hint and extensions text", () => {
      renderWithProviders(
        <Welcome onOpen={noopOpen} recents={[]} dragOver={false} />,
      );
      expect(
        screen.getByText("Drop a file here, or browse to open"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(".xlsx · .xlsm · .xls · .csv · .tsv"),
      ).toBeInTheDocument();
    });

    it("does not render recent section when recents is empty", () => {
      renderWithProviders(
        <Welcome onOpen={noopOpen} recents={[]} dragOver={false} />,
      );
      expect(screen.queryByText(/recent/i)).not.toBeInTheDocument();
    });
  });

  describe("dragOver styling", () => {
    it("applies primary border class when dragOver=true", () => {
      const { container } = renderWithProviders(
        <Welcome onOpen={noopOpen} recents={[]} dragOver={true} />,
      );
      // The dashed border div changes class based on dragOver
      const dashed = container.querySelector(".border-dashed");
      expect(dashed?.className).toContain("border-primary");
    });

    it("applies border-border class when dragOver=false", () => {
      const { container } = renderWithProviders(
        <Welcome onOpen={noopOpen} recents={[]} dragOver={false} />,
      );
      const dashed = container.querySelector(".border-dashed");
      expect(dashed?.className).toContain("border-border");
    });

    it("icon is text-primary when dragOver=true", () => {
      const { container } = renderWithProviders(
        <Welcome onOpen={noopOpen} recents={[]} dragOver={true} />,
      );
      // SVG className is an SVGAnimatedString — use baseVal or toString
      const icon = container.querySelector("svg");
      const cls = icon?.getAttribute("class") ?? "";
      expect(cls).toContain("text-primary");
    });

    it("icon is text-muted-foreground/60 when dragOver=false", () => {
      const { container } = renderWithProviders(
        <Welcome onOpen={noopOpen} recents={[]} dragOver={false} />,
      );
      const icon = container.querySelector("svg");
      const cls = icon?.getAttribute("class") ?? "";
      expect(cls).toContain("text-muted-foreground/60");
    });
  });

  describe("recents list", () => {
    it("renders recent items when recents is non-empty", () => {
      const recents = makeRecents(3);
      renderWithProviders(
        <Welcome onOpen={noopOpen} recents={recents} dragOver={false} />,
      );
      expect(screen.getByText("file0.xlsx")).toBeInTheDocument();
      expect(screen.getByText("file1.xlsx")).toBeInTheDocument();
      expect(screen.getByText("file2.xlsx")).toBeInTheDocument();
    });

    it("shows the recent section header when recents is non-empty", () => {
      const recents = makeRecents(1);
      renderWithProviders(
        <Welcome onOpen={noopOpen} recents={recents} dragOver={false} />,
      );
      expect(screen.getByText(/recent/i)).toBeInTheDocument();
    });

    it("renders at most 5 recents even when more are provided", () => {
      const recents = makeRecents(8);
      renderWithProviders(
        <Welcome onOpen={noopOpen} recents={recents} dragOver={false} />,
      );
      // Items 0-4 should appear, item 5+ should not
      for (let i = 0; i < 5; i++) {
        expect(screen.getByText(`file${i}.xlsx`)).toBeInTheDocument();
      }
      expect(screen.queryByText("file5.xlsx")).not.toBeInTheDocument();
    });

    it("calls onOpen with the path when a recent item is clicked", async () => {
      const onOpen = vi.fn();
      const recents = makeRecents(3);
      renderWithProviders(
        <Welcome onOpen={onOpen} recents={recents} dragOver={false} />,
      );
      const user = userEvent.setup();
      await user.click(screen.getByText("file1.xlsx"));
      expect(onOpen).toHaveBeenCalledOnce();
      expect(onOpen).toHaveBeenCalledWith("/home/user/file1.xlsx");
    });

    it("calls onOpen with correct path for each recent item", async () => {
      const onOpen = vi.fn();
      const recents = makeRecents(3);
      renderWithProviders(
        <Welcome onOpen={onOpen} recents={recents} dragOver={false} />,
      );
      const user = userEvent.setup();
      await user.click(screen.getByText("file0.xlsx"));
      expect(onOpen).toHaveBeenCalledWith("/home/user/file0.xlsx");
    });
  });

  describe("open/pick button", () => {
    it("calls pickFile when the open button is clicked", async () => {
      mockPickFile.mockResolvedValue(null);
      renderWithProviders(
        <Welcome onOpen={noopOpen} recents={[]} dragOver={false} />,
      );
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /open file/i }));
      expect(mockPickFile).toHaveBeenCalledOnce();
    });

    it("calls onOpen with the path when pickFile resolves a path", async () => {
      const onOpen = vi.fn();
      mockPickFile.mockResolvedValue("/chosen/path/file.xlsx");
      renderWithProviders(
        <Welcome onOpen={onOpen} recents={[]} dragOver={false} />,
      );
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /open file/i }));
      expect(onOpen).toHaveBeenCalledWith("/chosen/path/file.xlsx");
    });

    it("does NOT call onOpen when pickFile resolves null", async () => {
      const onOpen = vi.fn();
      mockPickFile.mockResolvedValue(null);
      renderWithProviders(
        <Welcome onOpen={onOpen} recents={[]} dragOver={false} />,
      );
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /open file/i }));
      expect(onOpen).not.toHaveBeenCalled();
    });

    it("shows 'Opening…' text while pickFile is pending (picking=true)", async () => {
      let resolvePickFile!: (v: string | null) => void;
      mockPickFile.mockReturnValue(
        new Promise<string | null>((res) => {
          resolvePickFile = res;
        }),
      );
      renderWithProviders(
        <Welcome onOpen={noopOpen} recents={[]} dragOver={false} />,
      );
      const user = userEvent.setup();
      // Start click but don't await the entire interaction yet
      const clickPromise = user.click(
        screen.getByRole("button", { name: /open file/i }),
      );
      // The state update to picking=true happens synchronously after click
      // We need to wait for the button text to change
      await screen.findByText("Opening…");
      expect(
        screen.getByRole("button", { name: /opening/i }),
      ).toBeDisabled();
      // Now resolve and let everything settle
      await act(async () => {
        resolvePickFile(null);
        await clickPromise;
      });
    });

    it("button is re-enabled after pickFile resolves", async () => {
      mockPickFile.mockResolvedValue(null);
      renderWithProviders(
        <Welcome onOpen={noopOpen} recents={[]} dragOver={false} />,
      );
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /open file/i }));
      // After resolution, button should be enabled again with original text
      expect(
        screen.getByRole("button", { name: /open file/i }),
      ).not.toBeDisabled();
    });
  });
});
