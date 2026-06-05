import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { WindowControls } from "./WindowControls";

// ---------------------------------------------------------------------------
// Mock @tauri-apps/api/window
// ---------------------------------------------------------------------------
const mockMinimize = vi.fn().mockResolvedValue(undefined);
const mockToggleMaximize = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockIsMaximized = vi.fn().mockResolvedValue(false);
const mockUnlisten = vi.fn();
const mockOnResized = vi.fn().mockResolvedValue(mockUnlisten);

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    minimize: mockMinimize,
    toggleMaximize: mockToggleMaximize,
    close: mockClose,
    isMaximized: mockIsMaximized,
    onResized: mockOnResized,
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockIsMaximized.mockResolvedValue(false);
  mockOnResized.mockResolvedValue(mockUnlisten);
});

// ---------------------------------------------------------------------------
// macOS — renders null
// ---------------------------------------------------------------------------
describe("WindowControls — macOS", () => {
  it("renders nothing (null) on macOS", () => {
    const { container } = renderWithProviders(
      <WindowControls platform="macos" />
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("window-controls")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Windows variant
// ---------------------------------------------------------------------------
describe("WindowControls — Windows", () => {
  it("renders all 3 buttons on Windows", () => {
    renderWithProviders(<WindowControls platform="windows" />);
    expect(screen.getByTestId("window-controls")).toBeInTheDocument();
    expect(screen.getByTestId("window-minimize")).toBeInTheDocument();
    expect(screen.getByTestId("window-maximize")).toBeInTheDocument();
    expect(screen.getByTestId("window-close")).toBeInTheDocument();
  });

  it("calls minimize when minimize button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WindowControls platform="windows" />);
    await user.click(screen.getByTestId("window-minimize"));
    expect(mockMinimize).toHaveBeenCalledOnce();
  });

  it("calls toggleMaximize when maximize button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WindowControls platform="windows" />);
    await user.click(screen.getByTestId("window-maximize"));
    expect(mockToggleMaximize).toHaveBeenCalledOnce();
  });

  it("calls close when close button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WindowControls platform="windows" />);
    await user.click(screen.getByTestId("window-close"));
    expect(mockClose).toHaveBeenCalledOnce();
  });

  it("does not have rounded-full class on buttons (flat style)", () => {
    renderWithProviders(<WindowControls platform="windows" />);
    const minimizeBtn = screen.getByTestId("window-minimize");
    expect(minimizeBtn.className).not.toContain("rounded-full");
  });
});

// ---------------------------------------------------------------------------
// Linux variant
// ---------------------------------------------------------------------------
describe("WindowControls — Linux", () => {
  it("renders all 3 buttons on Linux", () => {
    renderWithProviders(<WindowControls platform="linux" />);
    expect(screen.getByTestId("window-controls")).toBeInTheDocument();
    expect(screen.getByTestId("window-minimize")).toBeInTheDocument();
    expect(screen.getByTestId("window-maximize")).toBeInTheDocument();
    expect(screen.getByTestId("window-close")).toBeInTheDocument();
  });

  it("renders circular buttons (rounded-full) on Linux", () => {
    renderWithProviders(<WindowControls platform="linux" />);
    const minimizeBtn = screen.getByTestId("window-minimize");
    expect(minimizeBtn.className).toContain("rounded-full");
  });

  it("calls minimize when minimize button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WindowControls platform="linux" />);
    await user.click(screen.getByTestId("window-minimize"));
    expect(mockMinimize).toHaveBeenCalledOnce();
  });

  it("calls toggleMaximize when maximize button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WindowControls platform="linux" />);
    await user.click(screen.getByTestId("window-maximize"));
    expect(mockToggleMaximize).toHaveBeenCalledOnce();
  });

  it("calls close when close button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WindowControls platform="linux" />);
    await user.click(screen.getByTestId("window-close"));
    expect(mockClose).toHaveBeenCalledOnce();
  });
});
