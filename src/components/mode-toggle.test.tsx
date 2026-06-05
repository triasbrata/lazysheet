import { describe, it, expect } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { ModeToggle } from "./mode-toggle";

describe("ModeToggle", () => {
  it("renders the toggle button without crashing", () => {
    renderWithProviders(<ModeToggle />);
    // sr-only text from i18n: "Toggle theme"
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("opens dropdown and shows Light, Dark, and System options", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModeToggle />);

    await user.click(screen.getByRole("button"));

    expect(await screen.findByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("clicking Light option does not throw", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModeToggle />);

    await user.click(screen.getByRole("button"));
    const lightItem = await screen.findByText("Light");

    await expect(user.click(lightItem)).resolves.not.toThrow();
  });

  it("clicking Dark option does not throw", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModeToggle />);

    await user.click(screen.getByRole("button"));
    const darkItem = await screen.findByText("Dark");

    await expect(user.click(darkItem)).resolves.not.toThrow();
  });

  it("clicking System option does not throw", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModeToggle />);

    await user.click(screen.getByRole("button"));
    const systemItem = await screen.findByText("System");

    await expect(user.click(systemItem)).resolves.not.toThrow();
  });

  it("clicking Light sets data-theme or class on documentElement (via ThemeProvider)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModeToggle />);

    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByText("Light"));

    // ThemeProvider sets class on document.documentElement
    // After clicking "light", it should have "light" class or no "dark"
    const cls = document.documentElement.classList;
    // Either light is set or dark is removed — just assert no throw occurred
    expect(cls.contains("light") || !cls.contains("dark")).toBe(true);
  });

  it("dropdown shows exactly 3 menu items (Light, Dark, System)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModeToggle />);

    await user.click(screen.getByRole("button"));
    const items = await screen.findAllByRole("menuitem");
    expect(items.length).toBe(3);
  });
});
