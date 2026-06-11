import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { SettingsModal } from "@/components/SettingsModal";

const onOpenChange = vi.fn();
const onChangeAskBeforeClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.removeAttribute("data-theme");
});

describe("SettingsModal", () => {
  it("is not rendered when open=false", () => {
    renderWithProviders(
      <SettingsModal
        open={false}
        onOpenChange={onOpenChange}
        settings={{ askBeforeClose: false }}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
      />,
    );
    expect(screen.queryByTestId("settings-modal")).not.toBeInTheDocument();
  });

  it("renders when open=true and shows settings title", async () => {
    renderWithProviders(
      <SettingsModal
        open={true}
        onOpenChange={onOpenChange}
        settings={{ askBeforeClose: false }}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
      />,
    );
    expect(await screen.findByTestId("settings-modal")).toBeInTheDocument();
    expect(await screen.findByText("Settings")).toBeInTheDocument();
  });

  it("checkbox is checked when settings.askBeforeClose=true", async () => {
    renderWithProviders(
      <SettingsModal
        open={true}
        onOpenChange={onOpenChange}
        settings={{ askBeforeClose: true }}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
      />,
    );
    const checkbox = await screen.findByRole("checkbox");
    expect(checkbox).toHaveAttribute("data-state", "checked");
  });

  it("clicking the checkbox when askBeforeClose=false calls onChangeAskBeforeClose(true)", async () => {
    renderWithProviders(
      <SettingsModal
        open={true}
        onOpenChange={onOpenChange}
        settings={{ askBeforeClose: false }}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
      />,
    );
    const user = userEvent.setup();
    const checkbox = await screen.findByRole("checkbox");
    await user.click(checkbox);
    expect(onChangeAskBeforeClose).toHaveBeenCalledWith(true);
  });

  it("clicking Done calls onOpenChange(false)", async () => {
    renderWithProviders(
      <SettingsModal
        open={true}
        onOpenChange={onOpenChange}
        settings={{ askBeforeClose: false }}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
      />,
    );
    const user = userEvent.setup();
    await screen.findByTestId("settings-modal");
    await user.click(screen.getByRole("button", { name: /done/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders the theme select trigger when open", async () => {
    renderWithProviders(
      <SettingsModal
        open={true}
        onOpenChange={onOpenChange}
        settings={{ askBeforeClose: false }}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
      />,
    );
    expect(
      await screen.findByTestId("settings-theme-select"),
    ).toBeInTheDocument();
  });

  it("selecting a palette theme applies it to document", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SettingsModal
        open={true}
        onOpenChange={onOpenChange}
        settings={{ askBeforeClose: false }}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
      />,
    );

    const trigger = await screen.findByTestId("settings-theme-select");

    // Open the select
    await user.click(trigger);

    // Wait for the palenight option to appear and click it
    const palenight = await screen.findByTestId("theme-opt-palenight");
    await user.click(palenight);

    // ThemeProvider's applyTheme should have set data-theme="palenight"
    expect(document.documentElement.getAttribute("data-theme")).toBe(
      "palenight",
    );
  });

  it("renders setting titles when open", async () => {
    renderWithProviders(
      <SettingsModal
        open={true}
        onOpenChange={onOpenChange}
        settings={{ askBeforeClose: false }}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
      />,
    );
    expect(
      await screen.findByText("Ask before closing a sheet"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Theme")).toBeInTheDocument();
  });

  it("select options are present after opening", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SettingsModal
        open={true}
        onOpenChange={onOpenChange}
        settings={{ askBeforeClose: false }}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
      />,
    );

    const trigger = await screen.findByTestId("settings-theme-select");
    await user.click(trigger);

    // Default options
    expect(await screen.findByTestId("theme-opt-light")).toBeInTheDocument();
    expect(screen.getByTestId("theme-opt-dark")).toBeInTheDocument();
    expect(screen.getByTestId("theme-opt-system")).toBeInTheDocument();
    // At least one palette option
    expect(screen.getByTestId("theme-opt-palenight")).toBeInTheDocument();
  });
});
