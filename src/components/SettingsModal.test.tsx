import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { SettingsModal } from "@/components/SettingsModal";

const onOpenChange = vi.fn();
const onChangeAskBeforeClose = vi.fn();
const onChangeDisableRunningText = vi.fn();

const defaultSettings = { askBeforeClose: false, disableRunningText: false };

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
        settings={defaultSettings}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
        onChangeDisableRunningText={onChangeDisableRunningText}
      />,
    );
    expect(screen.queryByTestId("settings-modal")).not.toBeInTheDocument();
  });

  it("renders when open=true and shows settings title", async () => {
    renderWithProviders(
      <SettingsModal
        open={true}
        onOpenChange={onOpenChange}
        settings={defaultSettings}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
        onChangeDisableRunningText={onChangeDisableRunningText}
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
        settings={{ askBeforeClose: true, disableRunningText: false }}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
        onChangeDisableRunningText={onChangeDisableRunningText}
      />,
    );
    const checkboxes = await screen.findAllByRole("checkbox");
    const askCheckbox = checkboxes[0];
    expect(askCheckbox).toHaveAttribute("data-state", "checked");
  });

  it("clicking the checkbox when askBeforeClose=false calls onChangeAskBeforeClose(true)", async () => {
    renderWithProviders(
      <SettingsModal
        open={true}
        onOpenChange={onOpenChange}
        settings={defaultSettings}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
        onChangeDisableRunningText={onChangeDisableRunningText}
      />,
    );
    const user = userEvent.setup();
    const checkboxes = await screen.findAllByRole("checkbox");
    await user.click(checkboxes[0]);
    expect(onChangeAskBeforeClose).toHaveBeenCalledWith(true);
  });

  it("clicking Done calls onOpenChange(false)", async () => {
    renderWithProviders(
      <SettingsModal
        open={true}
        onOpenChange={onOpenChange}
        settings={defaultSettings}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
        onChangeDisableRunningText={onChangeDisableRunningText}
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
        settings={defaultSettings}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
        onChangeDisableRunningText={onChangeDisableRunningText}
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
        settings={defaultSettings}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
        onChangeDisableRunningText={onChangeDisableRunningText}
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
        settings={defaultSettings}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
        onChangeDisableRunningText={onChangeDisableRunningText}
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
        settings={defaultSettings}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
        onChangeDisableRunningText={onChangeDisableRunningText}
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

  // --- New tests for Step 6 ---

  it("DialogContent has sm:max-w-lg class", async () => {
    renderWithProviders(
      <SettingsModal
        open={true}
        onOpenChange={onOpenChange}
        settings={defaultSettings}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
        onChangeDisableRunningText={onChangeDisableRunningText}
      />,
    );
    const modal = await screen.findByTestId("settings-modal");
    expect(modal.className).toContain("sm:max-w-lg");
  });

  it("theme group label renders 'Default'", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SettingsModal
        open={true}
        onOpenChange={onOpenChange}
        settings={defaultSettings}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
        onChangeDisableRunningText={onChangeDisableRunningText}
      />,
    );
    const trigger = await screen.findByTestId("settings-theme-select");
    await user.click(trigger);
    expect(await screen.findByText("Default")).toBeInTheDocument();
  });

  it("language select trigger renders", async () => {
    renderWithProviders(
      <SettingsModal
        open={true}
        onOpenChange={onOpenChange}
        settings={defaultSettings}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
        onChangeDisableRunningText={onChangeDisableRunningText}
      />,
    );
    expect(
      await screen.findByTestId("settings-language-select"),
    ).toBeInTheDocument();
  });

  it("language select shows current language native label (English)", async () => {
    renderWithProviders(
      <SettingsModal
        open={true}
        onOpenChange={onOpenChange}
        settings={defaultSettings}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
        onChangeDisableRunningText={onChangeDisableRunningText}
      />,
    );
    const trigger = await screen.findByTestId("settings-language-select");
    expect(trigger).toHaveTextContent("English");
  });

  it("selecting Indonesian calls i18n.changeLanguage with 'id'", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SettingsModal
        open={true}
        onOpenChange={onOpenChange}
        settings={defaultSettings}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
        onChangeDisableRunningText={onChangeDisableRunningText}
      />,
    );

    const trigger = await screen.findByTestId("settings-language-select");
    await user.click(trigger);

    const idOption = await screen.findByTestId("lang-opt-id");
    await user.click(idOption);

    // The trigger should now show "Bahasa Indonesia"
    expect(trigger).toHaveTextContent("Bahasa Indonesia");
  });

  it("running-text checkbox reflects settings.disableRunningText=true", async () => {
    renderWithProviders(
      <SettingsModal
        open={true}
        onOpenChange={onOpenChange}
        settings={{ askBeforeClose: false, disableRunningText: true }}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
        onChangeDisableRunningText={onChangeDisableRunningText}
      />,
    );
    const disableRunningTextCheckbox = await screen.findByRole("checkbox", {
      name: /disable running text/i,
    });
    expect(disableRunningTextCheckbox).toHaveAttribute("data-state", "checked");
  });

  it("running-text checkbox fires onChangeDisableRunningText(true) on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SettingsModal
        open={true}
        onOpenChange={onOpenChange}
        settings={defaultSettings}
        onChangeAskBeforeClose={onChangeAskBeforeClose}
        onChangeDisableRunningText={onChangeDisableRunningText}
      />,
    );
    const disableRunningTextCheckbox = await screen.findByRole("checkbox", {
      name: /disable running text/i,
    });
    await user.click(disableRunningTextCheckbox);
    expect(onChangeDisableRunningText).toHaveBeenCalledWith(true);
  });
});
