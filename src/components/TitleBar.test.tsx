import { describe, it, expect, vi, afterEach } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { TitleBar } from "./TitleBar";

// ---------------------------------------------------------------------------
// Mock @/lib/platform — default to "macos" so all existing tests pass unchanged
// ---------------------------------------------------------------------------
vi.mock("@/lib/platform", () => ({
  getPlatform: vi.fn(() => "macos" as const),
}));

// ---------------------------------------------------------------------------
// Mock @/components/WindowControls — stub to avoid Tauri API calls in effects
// ---------------------------------------------------------------------------
vi.mock("@/components/WindowControls", () => ({
  WindowControls: ({ platform }: { platform: string }) => (
    <div data-testid="window-controls" data-platform={platform} />
  ),
}));

const noop = vi.fn();

describe("TitleBar — fileName display", () => {
  it("shows the fileName when provided", () => {
    renderWithProviders(
      <TitleBar fileName="my-file.xlsx" onOpenCommand={noop} />
    );
    expect(screen.getByText("my-file.xlsx")).toBeInTheDocument();
  });

  it("shows the app name when fileName is null", () => {
    renderWithProviders(
      <TitleBar fileName={null} onOpenCommand={noop} />
    );
    // en locale: "LazySheet"
    expect(screen.getByText("LazySheet")).toBeInTheDocument();
  });
});

describe("TitleBar — filePath triggers drag button and dropdown", () => {
  it("renders the drag (FileSpreadsheet) button when filePath is provided", () => {
    renderWithProviders(
      <TitleBar
        fileName="test.xlsx"
        onOpenCommand={noop}
        filePath="/tmp/test.xlsx"
        onDragOut={vi.fn()}
      />
    );
    // The drag button has title from i18n: "Drag file out"
    expect(screen.getByTitle("Drag file out")).toBeInTheDocument();
  });

  it("does not render drag button when filePath is null", () => {
    renderWithProviders(
      <TitleBar fileName="test.xlsx" onOpenCommand={noop} filePath={null} />
    );
    expect(screen.queryByTitle("Drag file out")).toBeNull();
  });

  it("renders file actions dropdown trigger when filePath is provided", () => {
    renderWithProviders(
      <TitleBar
        fileName="test.xlsx"
        onOpenCommand={noop}
        filePath="/tmp/test.xlsx"
      />
    );
    // The dropdown trigger button has title "File actions"
    expect(screen.getByTitle("File actions")).toBeInTheDocument();
  });

  it("opens dropdown and shows Copy file / Copy file path items on trigger click", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TitleBar
        fileName="test.xlsx"
        onOpenCommand={noop}
        filePath="/tmp/test.xlsx"
        onCopyFile={vi.fn()}
        onCopyFilePath={vi.fn()}
      />
    );
    await user.click(screen.getByTitle("File actions"));
    expect(await screen.findByText("Copy file")).toBeInTheDocument();
    expect(screen.getByText("Copy file path")).toBeInTheDocument();
  });

  it("calls onCopyFile when Copy file menu item is clicked", async () => {
    const onCopyFile = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TitleBar
        fileName="test.xlsx"
        onOpenCommand={noop}
        filePath="/tmp/test.xlsx"
        onCopyFile={onCopyFile}
        onCopyFilePath={vi.fn()}
      />
    );
    await user.click(screen.getByTitle("File actions"));
    await user.click(await screen.findByText("Copy file"));
    expect(onCopyFile).toHaveBeenCalledOnce();
  });

  it("calls onCopyFilePath when Copy file path menu item is clicked", async () => {
    const onCopyFilePath = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TitleBar
        fileName="test.xlsx"
        onOpenCommand={noop}
        filePath="/tmp/test.xlsx"
        onCopyFile={vi.fn()}
        onCopyFilePath={onCopyFilePath}
      />
    );
    await user.click(screen.getByTitle("File actions"));
    await user.click(await screen.findByText("Copy file path"));
    expect(onCopyFilePath).toHaveBeenCalledOnce();
  });
});

describe("TitleBar — close button", () => {
  it("renders close button when fileName and onClose are both provided", () => {
    renderWithProviders(
      <TitleBar
        fileName="file.xlsx"
        onOpenCommand={noop}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByTitle("Close file")).toBeInTheDocument();
  });

  it("does not render close button when fileName is null", () => {
    renderWithProviders(
      <TitleBar fileName={null} onOpenCommand={noop} onClose={vi.fn()} />
    );
    expect(screen.queryByTitle("Close file")).toBeNull();
  });

  it("does not render close button when onClose is not provided", () => {
    renderWithProviders(
      <TitleBar fileName="file.xlsx" onOpenCommand={noop} />
    );
    expect(screen.queryByTitle("Close file")).toBeNull();
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TitleBar
        fileName="file.xlsx"
        onOpenCommand={noop}
        onClose={onClose}
      />
    );
    await user.click(screen.getByTitle("Close file"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("TitleBar — command search bar", () => {
  it("renders the search command bar", () => {
    renderWithProviders(
      <TitleBar fileName="file.xlsx" onOpenCommand={noop} />
    );
    expect(screen.getByText("Search commands…")).toBeInTheDocument();
  });

  it("calls onOpenCommand when the search bar is clicked", async () => {
    const onOpenCommand = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TitleBar fileName="file.xlsx" onOpenCommand={onOpenCommand} />
    );
    // Click the search bar button
    const searchBar = screen.getByTitle(/Open command center/i);
    await user.click(searchBar);
    expect(onOpenCommand).toHaveBeenCalledOnce();
  });
});

describe("TitleBar — VITE_FF_MULTI_LANG feature flag", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("shows lang-toggle-btn when flag is ON (test env sets VITE_FF_MULTI_LANG=true)", () => {
    // vitest.config.ts sets VITE_FF_MULTI_LANG="true" → flags.multiLang = true
    renderWithProviders(
      <TitleBar fileName="file.xlsx" onOpenCommand={noop} />
    );
    expect(screen.getByTestId("lang-toggle-btn")).toBeInTheDocument();
  });

  it("hides lang-toggle-btn when VITE_FF_MULTI_LANG=false", async () => {
    vi.stubEnv("VITE_FF_MULTI_LANG", "false");
    vi.resetModules();

    // Re-import TitleBar after module reset so it picks up the new flags value
    const { TitleBar: TitleBarOff } = await import("./TitleBar");
    const { renderWithProviders: rwp, screen: s } = await import("@/test/render");

    rwp(<TitleBarOff fileName="file.xlsx" onOpenCommand={vi.fn()} />);
    expect(s.queryByTestId("lang-toggle-btn")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Platform-conditional padding + WindowControls
// ---------------------------------------------------------------------------
describe("TitleBar — platform-conditional layout", () => {
  it("macOS: root titlebar has pl-20 class and no window-controls", async () => {
    const { getPlatform } = await import("@/lib/platform");
    vi.mocked(getPlatform).mockReturnValue("macos");

    renderWithProviders(<TitleBar fileName="file.xlsx" onOpenCommand={noop} />);

    const titlebar = screen.getByTestId("titlebar");
    expect(titlebar.className).toContain("pl-20");
    expect(titlebar.className).not.toContain("pl-3");
    expect(screen.queryByTestId("window-controls")).toBeNull();
  });

  it("windows: root titlebar has pl-3 (not pl-20) and window-controls is present", async () => {
    const { getPlatform } = await import("@/lib/platform");
    vi.mocked(getPlatform).mockReturnValue("windows");

    renderWithProviders(<TitleBar fileName="file.xlsx" onOpenCommand={noop} />);

    const titlebar = screen.getByTestId("titlebar");
    expect(titlebar.className).toContain("pl-3");
    expect(titlebar.className).not.toContain("pl-20");
    expect(screen.getByTestId("window-controls")).toBeInTheDocument();
  });

  it("linux: root titlebar has pl-3 (not pl-20) and window-controls is present", async () => {
    const { getPlatform } = await import("@/lib/platform");
    vi.mocked(getPlatform).mockReturnValue("linux");

    renderWithProviders(<TitleBar fileName="file.xlsx" onOpenCommand={noop} />);

    const titlebar = screen.getByTestId("titlebar");
    expect(titlebar.className).toContain("pl-3");
    expect(titlebar.className).not.toContain("pl-20");
    expect(screen.getByTestId("window-controls")).toBeInTheDocument();
  });
});
