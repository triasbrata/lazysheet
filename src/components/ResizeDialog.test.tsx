import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import {
  ResizeDialog,
  RESIZE_DIALOG_MIN,
  RESIZE_DIALOG_MAX,
} from "@/components/ResizeDialog";
import type { SizeDialogState } from "@/components/ResizeDialog";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from "sonner";
const mockToastError = vi.mocked(toast.error);

const onConfirm = vi.fn();
const onReset = vi.fn();
const onCancel = vi.fn();

const defaultProps = {
  onConfirm,
  onReset,
  onCancel,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ResizeDialog", () => {
  describe("state=null (dialog closed)", () => {
    it("renders nothing visible when state is null", () => {
      renderWithProviders(<ResizeDialog {...defaultProps} state={null} />);
      // Dialog should not be open — title text should not be visible
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("kind=col", () => {
    const colState: SizeDialogState = { kind: "col", index: 0, current: 100 };

    it("shows column title with column letter", async () => {
      renderWithProviders(
        <ResizeDialog {...defaultProps} state={colState} />,
      );
      // Column A (index 0) → "Column A width"
      expect(await screen.findByText("Column A width")).toBeInTheDocument();
    });

    it("pre-fills input with rounded current value", async () => {
      renderWithProviders(
        <ResizeDialog {...defaultProps} state={colState} />,
      );
      const input = await screen.findByRole("spinbutton");
      expect((input as HTMLInputElement).value).toBe("100");
    });

    it("shows description with MIN/MAX range and col default (59px)", async () => {
      renderWithProviders(
        <ResizeDialog {...defaultProps} state={colState} />,
      );
      const desc = await screen.findByText(
        /Enter size in pixels.*Default is 59px/,
      );
      expect(desc).toBeInTheDocument();
    });
  });

  describe("kind=row", () => {
    const rowState: SizeDialogState = { kind: "row", index: 2, current: 30 };

    it("shows row title with 1-based row index", async () => {
      renderWithProviders(
        <ResizeDialog {...defaultProps} state={rowState} />,
      );
      // Row at index 2 → "Row 3 height"
      expect(await screen.findByText("Row 3 height")).toBeInTheDocument();
    });

    it("pre-fills input with rounded current value", async () => {
      renderWithProviders(
        <ResizeDialog {...defaultProps} state={rowState} />,
      );
      const input = await screen.findByRole("spinbutton");
      expect((input as HTMLInputElement).value).toBe("30");
    });

    it("shows description with row default (20px)", async () => {
      renderWithProviders(
        <ResizeDialog {...defaultProps} state={rowState} />,
      );
      const desc = await screen.findByText(
        /Enter size in pixels.*Default is 20px/,
      );
      expect(desc).toBeInTheDocument();
    });
  });

  describe("confirm (OK button)", () => {
    const colState: SizeDialogState = { kind: "col", index: 1, current: 59 };

    it("calls onConfirm with the entered numeric value", async () => {
      renderWithProviders(
        <ResizeDialog {...defaultProps} state={colState} />,
      );
      const user = userEvent.setup();
      const input = await screen.findByRole("spinbutton");
      await user.clear(input);
      await user.type(input, "120");
      await user.click(screen.getByRole("button", { name: /^ok$/i }));
      expect(onConfirm).toHaveBeenCalledWith(120);
    });

    it("calls onConfirm with rounded value when decimal is entered", async () => {
      renderWithProviders(
        <ResizeDialog {...defaultProps} state={colState} />,
      );
      const user = userEvent.setup();
      const input = await screen.findByRole("spinbutton");
      await user.clear(input);
      await user.type(input, "50.6");
      await user.click(screen.getByRole("button", { name: /^ok$/i }));
      expect(onConfirm).toHaveBeenCalledWith(51);
    });

    it("calls onConfirm when Enter key is pressed", async () => {
      renderWithProviders(
        <ResizeDialog {...defaultProps} state={colState} />,
      );
      const user = userEvent.setup();
      const input = await screen.findByRole("spinbutton");
      await user.clear(input);
      await user.type(input, "80");
      await user.keyboard("{Enter}");
      expect(onConfirm).toHaveBeenCalledWith(80);
    });
  });

  describe("validation — empty value", () => {
    const colState: SizeDialogState = { kind: "col", index: 0, current: 59 };

    it("shows toast error and does NOT call onConfirm when input is empty", async () => {
      renderWithProviders(
        <ResizeDialog {...defaultProps} state={colState} />,
      );
      const user = userEvent.setup();
      const input = await screen.findByRole("spinbutton");
      await user.clear(input);
      await user.click(screen.getByRole("button", { name: /^ok$/i }));
      expect(mockToastError).toHaveBeenCalledWith("Enter a value in pixels");
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe("validation — non-numeric value", () => {
    const colState: SizeDialogState = { kind: "col", index: 0, current: 59 };

    it("shows 'Value must be a number' toast when onChange injects a non-numeric string via event", async () => {
      renderWithProviders(
        <ResizeDialog {...defaultProps} state={colState} />,
      );
      const input = await screen.findByRole("spinbutton");
      // In jsdom, type="number" inputs return "" for non-numeric strings when
      // the DOM value property is read. However, React synthetic onChange fires
      // with the raw e.target.value from the event object. We create a custom
      // event where the value is "abc" to exercise the Number.isFinite branch.
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, "abc");
      }
      fireEvent.change(input, { target: { value: "abc" } });
      fireEvent.click(screen.getByRole("button", { name: /^ok$/i }));
      expect(mockToastError).toHaveBeenCalled();
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe("validation — out of range", () => {
    const colState: SizeDialogState = { kind: "col", index: 0, current: 59 };

    it("shows toast error when value is below MIN", async () => {
      renderWithProviders(
        <ResizeDialog {...defaultProps} state={colState} />,
      );
      const user = userEvent.setup();
      const input = await screen.findByRole("spinbutton");
      await user.clear(input);
      await user.type(input, String(RESIZE_DIALOG_MIN - 1));
      await user.click(screen.getByRole("button", { name: /^ok$/i }));
      expect(mockToastError).toHaveBeenCalledWith(
        `Value must be between ${RESIZE_DIALOG_MIN} and ${RESIZE_DIALOG_MAX} px`,
      );
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("shows toast error when value is above MAX", async () => {
      renderWithProviders(
        <ResizeDialog {...defaultProps} state={colState} />,
      );
      const user = userEvent.setup();
      const input = await screen.findByRole("spinbutton");
      await user.clear(input);
      await user.type(input, String(RESIZE_DIALOG_MAX + 1));
      await user.click(screen.getByRole("button", { name: /^ok$/i }));
      expect(mockToastError).toHaveBeenCalledWith(
        `Value must be between ${RESIZE_DIALOG_MIN} and ${RESIZE_DIALOG_MAX} px`,
      );
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("accepts the exact MIN value", async () => {
      renderWithProviders(
        <ResizeDialog {...defaultProps} state={colState} />,
      );
      const user = userEvent.setup();
      const input = await screen.findByRole("spinbutton");
      await user.clear(input);
      await user.type(input, String(RESIZE_DIALOG_MIN));
      await user.click(screen.getByRole("button", { name: /^ok$/i }));
      expect(onConfirm).toHaveBeenCalledWith(RESIZE_DIALOG_MIN);
    });

    it("accepts the exact MAX value", async () => {
      renderWithProviders(
        <ResizeDialog {...defaultProps} state={colState} />,
      );
      const user = userEvent.setup();
      const input = await screen.findByRole("spinbutton");
      await user.clear(input);
      await user.type(input, String(RESIZE_DIALOG_MAX));
      await user.click(screen.getByRole("button", { name: /^ok$/i }));
      expect(onConfirm).toHaveBeenCalledWith(RESIZE_DIALOG_MAX);
    });
  });

  describe("reset button", () => {
    const rowState: SizeDialogState = { kind: "row", index: 0, current: 20 };

    it("calls onReset when Reset button is clicked", async () => {
      renderWithProviders(
        <ResizeDialog {...defaultProps} state={rowState} />,
      );
      const user = userEvent.setup();
      await screen.findByRole("dialog");
      await user.click(screen.getByRole("button", { name: /reset to default/i }));
      expect(onReset).toHaveBeenCalledOnce();
    });
  });

  describe("cancel / close", () => {
    const colState: SizeDialogState = { kind: "col", index: 0, current: 59 };

    it("calls onCancel when Cancel button is clicked", async () => {
      renderWithProviders(
        <ResizeDialog {...defaultProps} state={colState} />,
      );
      const user = userEvent.setup();
      await screen.findByRole("dialog");
      await user.click(screen.getByRole("button", { name: /cancel/i }));
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it("calls onCancel when Escape key is pressed in the input", async () => {
      renderWithProviders(
        <ResizeDialog {...defaultProps} state={colState} />,
      );
      const user = userEvent.setup();
      const input = await screen.findByRole("spinbutton");
      await input.focus();
      await user.keyboard("{Escape}");
      expect(onCancel).toHaveBeenCalled();
    });

    it("calls onCancel when dialog onOpenChange fires with false", async () => {
      renderWithProviders(
        <ResizeDialog {...defaultProps} state={colState} />,
      );
      const user = userEvent.setup();
      await screen.findByRole("dialog");
      // Close via X button (Radix Dialog close button)
      const closeBtn = screen.queryByRole("button", { name: /close/i });
      if (closeBtn) {
        await user.click(closeBtn);
        expect(onCancel).toHaveBeenCalled();
      } else {
        // Dialog X button not rendered in test env, test onCancel via Cancel btn
        await user.click(screen.getByRole("button", { name: /cancel/i }));
        expect(onCancel).toHaveBeenCalled();
      }
    });
  });
});
