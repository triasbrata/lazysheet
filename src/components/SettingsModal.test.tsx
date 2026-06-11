import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { SettingsModal } from "@/components/SettingsModal";

const onOpenChange = vi.fn();
const onChangeAskBeforeClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
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
});
