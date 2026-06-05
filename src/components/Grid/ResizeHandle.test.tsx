import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, act } from "@testing-library/react";
import { renderWithProviders, screen } from "@/test/render";
import { ResizeHandle } from "@/components/Grid/ResizeHandle";
import type { ResizeOrientation } from "@/components/Grid/ResizeHandle";

// clampResize uses MIN_RESIZE_PX=16, MAX_RESIZE_PX=2000

const makeProps = (overrides: Partial<Parameters<typeof ResizeHandle>[0]> = {}) => ({
  orientation: "col" as ResizeOrientation,
  index: 0,
  currentSize: 100,
  onPreview: vi.fn(),
  onCommit: vi.fn(),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  // Reset body cursor
  document.body.style.cursor = "";
});

function getSeparator() {
  return screen.getByRole("separator");
}

describe("ResizeHandle", () => {
  describe("rendering", () => {
    it("renders a separator element for col orientation", () => {
      renderWithProviders(<ResizeHandle {...makeProps()} />);
      const sep = getSeparator();
      expect(sep).toBeInTheDocument();
      expect(sep).toHaveAttribute("aria-orientation", "vertical");
    });

    it("renders a separator element for row orientation", () => {
      renderWithProviders(
        <ResizeHandle {...makeProps({ orientation: "row" })} />,
      );
      const sep = getSeparator();
      expect(sep).toHaveAttribute("aria-orientation", "horizontal");
    });

    it("sets aria-disabled when disabled", () => {
      renderWithProviders(<ResizeHandle {...makeProps({ disabled: true })} />);
      expect(getSeparator()).toHaveAttribute("aria-disabled", "true");
    });

    it("does NOT set aria-disabled when not disabled", () => {
      renderWithProviders(<ResizeHandle {...makeProps()} />);
      expect(getSeparator()).not.toHaveAttribute("aria-disabled");
    });

    it("shows autofit title when onAutofit is provided", () => {
      renderWithProviders(
        <ResizeHandle {...makeProps({ onAutofit: vi.fn() })} />,
      );
      expect(getSeparator()).toHaveAttribute(
        "title",
        "Drag to resize · Double-click to autofit",
      );
    });

    it("has no title when onAutofit is not provided", () => {
      renderWithProviders(<ResizeHandle {...makeProps()} />);
      expect(getSeparator()).not.toHaveAttribute("title");
    });
  });

  describe("pointer-down → move → up: col orientation", () => {
    it("calls onPreview during move and onCommit on pointer-up", () => {
      const onPreview = vi.fn();
      const onCommit = vi.fn();
      renderWithProviders(
        <ResizeHandle
          {...makeProps({ onPreview, onCommit, currentSize: 100 })}
        />,
      );
      const sep = getSeparator();

      // Pointer down at clientX=200
      fireEvent.pointerDown(sep, { button: 0, clientX: 200, clientY: 0, pointerId: 1 });

      // Move right by 50px → newSize = 150
      fireEvent.pointerMove(sep, { clientX: 250, clientY: 0, pointerId: 1 });
      expect(onPreview).toHaveBeenCalledWith("col", 0, 150);

      // Pointer up → commit with last size
      fireEvent.pointerUp(sep, { clientX: 250, clientY: 0, pointerId: 1 });
      expect(onCommit).toHaveBeenCalledWith("col", 0, 150);
    });

    it("sets body cursor to col-resize on pointer-down", () => {
      renderWithProviders(<ResizeHandle {...makeProps()} />);
      const sep = getSeparator();
      fireEvent.pointerDown(sep, { button: 0, clientX: 100, clientY: 0, pointerId: 1 });
      expect(document.body.style.cursor).toBe("col-resize");
    });

    it("clears body cursor on pointer-up", () => {
      renderWithProviders(<ResizeHandle {...makeProps()} />);
      const sep = getSeparator();
      fireEvent.pointerDown(sep, { button: 0, clientX: 100, clientY: 0, pointerId: 1 });
      fireEvent.pointerMove(sep, { clientX: 150, clientY: 0, pointerId: 1 });
      fireEvent.pointerUp(sep, { clientX: 150, clientY: 0, pointerId: 1 });
      expect(document.body.style.cursor).toBe("");
    });
  });

  describe("pointer-down → move → up: row orientation", () => {
    it("calls onPreview during move and onCommit on pointer-up using clientY", () => {
      const onPreview = vi.fn();
      const onCommit = vi.fn();
      renderWithProviders(
        <ResizeHandle
          {...makeProps({ orientation: "row", onPreview, onCommit, currentSize: 50 })}
        />,
      );
      const sep = getSeparator();

      fireEvent.pointerDown(sep, { button: 0, clientX: 0, clientY: 100, pointerId: 1 });
      // Move down by 30px → newSize = 80
      fireEvent.pointerMove(sep, { clientX: 0, clientY: 130, pointerId: 1 });
      expect(onPreview).toHaveBeenCalledWith("row", 0, 80);

      fireEvent.pointerUp(sep, { clientX: 0, clientY: 130, pointerId: 1 });
      expect(onCommit).toHaveBeenCalledWith("row", 0, 80);
    });

    it("sets body cursor to row-resize on pointer-down", () => {
      renderWithProviders(
        <ResizeHandle {...makeProps({ orientation: "row" })} />,
      );
      const sep = getSeparator();
      fireEvent.pointerDown(sep, { button: 0, clientX: 0, clientY: 100, pointerId: 1 });
      expect(document.body.style.cursor).toBe("row-resize");
    });
  });

  describe("clamp behavior", () => {
    it("clamps to MIN_RESIZE_PX (16) when dragging too far left", () => {
      const onPreview = vi.fn();
      const onCommit = vi.fn();
      renderWithProviders(
        <ResizeHandle
          {...makeProps({ onPreview, onCommit, currentSize: 20, orientation: "col" })}
        />,
      );
      const sep = getSeparator();
      fireEvent.pointerDown(sep, { button: 0, clientX: 200, clientY: 0, pointerId: 1 });
      // Move far left: 200 - 500 = -300 → size = 20-300=-280 → clamped to 16
      fireEvent.pointerMove(sep, { clientX: -300, clientY: 0, pointerId: 1 });
      expect(onPreview).toHaveBeenCalledWith("col", 0, 16);
      fireEvent.pointerUp(sep, { clientX: -300, clientY: 0, pointerId: 1 });
      expect(onCommit).toHaveBeenCalledWith("col", 0, 16);
    });

    it("clamps to MAX_RESIZE_PX (2000) when dragging too far right", () => {
      const onPreview = vi.fn();
      const onCommit = vi.fn();
      renderWithProviders(
        <ResizeHandle
          {...makeProps({ onPreview, onCommit, currentSize: 100, orientation: "col" })}
        />,
      );
      const sep = getSeparator();
      fireEvent.pointerDown(sep, { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
      // Move far right: 0 + 5000 → clamped to 2000
      fireEvent.pointerMove(sep, { clientX: 5000, clientY: 0, pointerId: 1 });
      expect(onPreview).toHaveBeenCalledWith("col", 0, 2000);
      fireEvent.pointerUp(sep, { clientX: 5000, clientY: 0, pointerId: 1 });
      expect(onCommit).toHaveBeenCalledWith("col", 0, 2000);
    });
  });

  describe("onPreview dedup — no call when size unchanged", () => {
    it("does not call onPreview again if pointer moves but resulting size is identical", () => {
      const onPreview = vi.fn();
      renderWithProviders(
        <ResizeHandle
          {...makeProps({ onPreview, currentSize: 100, orientation: "col" })}
        />,
      );
      const sep = getSeparator();
      fireEvent.pointerDown(sep, { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
      // Move to exactly 100 from start → delta=100 → size=200, calls onPreview
      fireEvent.pointerMove(sep, { clientX: 100, clientY: 0, pointerId: 1 });
      expect(onPreview).toHaveBeenCalledTimes(1);
      // Same position again → same size → should NOT call again
      fireEvent.pointerMove(sep, { clientX: 100, clientY: 0, pointerId: 1 });
      expect(onPreview).toHaveBeenCalledTimes(1);
    });
  });

  describe("disabled prop", () => {
    it("does NOT start drag when disabled (onCommit not called)", () => {
      const onCommit = vi.fn();
      const onPreview = vi.fn();
      renderWithProviders(
        <ResizeHandle
          {...makeProps({ disabled: true, onCommit, onPreview })}
        />,
      );
      const sep = getSeparator();
      fireEvent.pointerDown(sep, { button: 0, clientX: 100, clientY: 0, pointerId: 1 });
      fireEvent.pointerMove(sep, { clientX: 200, clientY: 0, pointerId: 1 });
      fireEvent.pointerUp(sep, { clientX: 200, clientY: 0, pointerId: 1 });
      expect(onCommit).not.toHaveBeenCalled();
      expect(onPreview).not.toHaveBeenCalled();
    });

    it("does NOT set body cursor when disabled", () => {
      renderWithProviders(<ResizeHandle {...makeProps({ disabled: true })} />);
      const sep = getSeparator();
      fireEvent.pointerDown(sep, { button: 0, clientX: 100, clientY: 0, pointerId: 1 });
      expect(document.body.style.cursor).toBe("");
    });
  });

  describe("non-left button guard", () => {
    it("ignores pointer-down from non-primary buttons (button !== 0)", () => {
      const onCommit = vi.fn();
      const onPreview = vi.fn();
      renderWithProviders(
        <ResizeHandle {...makeProps({ onCommit, onPreview })} />,
      );
      const sep = getSeparator();
      // button=2 is right-click
      fireEvent.pointerDown(sep, { button: 2, clientX: 100, clientY: 0, pointerId: 1 });
      fireEvent.pointerMove(sep, { clientX: 200, clientY: 0, pointerId: 1 });
      fireEvent.pointerUp(sep, { clientX: 200, clientY: 0, pointerId: 1 });
      expect(onCommit).not.toHaveBeenCalled();
      expect(onPreview).not.toHaveBeenCalled();
    });

    it("ignores middle-click (button=1)", () => {
      const onCommit = vi.fn();
      renderWithProviders(
        <ResizeHandle {...makeProps({ onCommit })} />,
      );
      const sep = getSeparator();
      fireEvent.pointerDown(sep, { button: 1, clientX: 100, clientY: 0, pointerId: 1 });
      fireEvent.pointerUp(sep, { clientX: 100, clientY: 0, pointerId: 1 });
      expect(onCommit).not.toHaveBeenCalled();
    });
  });

  describe("double-click → onAutofit", () => {
    it("calls onAutofit when double-clicked and onAutofit is provided", () => {
      const onAutofit = vi.fn();
      renderWithProviders(
        <ResizeHandle {...makeProps({ onAutofit })} />,
      );
      const sep = getSeparator();
      fireEvent.dblClick(sep);
      expect(onAutofit).toHaveBeenCalledWith("col", 0);
    });

    it("calls onAutofit with correct orientation and index", () => {
      const onAutofit = vi.fn();
      renderWithProviders(
        <ResizeHandle
          {...makeProps({ orientation: "row", index: 5, onAutofit })}
        />,
      );
      const sep = getSeparator();
      fireEvent.dblClick(sep);
      expect(onAutofit).toHaveBeenCalledWith("row", 5);
    });

    it("does NOT call onAutofit when disabled", () => {
      const onAutofit = vi.fn();
      renderWithProviders(
        <ResizeHandle {...makeProps({ disabled: true, onAutofit })} />,
      );
      const sep = getSeparator();
      fireEvent.dblClick(sep);
      expect(onAutofit).not.toHaveBeenCalled();
    });

    it("is a no-op when onAutofit is not provided", () => {
      // Should not throw
      renderWithProviders(<ResizeHandle {...makeProps()} />);
      const sep = getSeparator();
      expect(() => fireEvent.dblClick(sep)).not.toThrow();
    });
  });

  describe("pointer-cancel: reverts preview to original size", () => {
    it("calls onPreview with original startSize on pointer-cancel (no commit)", () => {
      const onPreview = vi.fn();
      const onCommit = vi.fn();
      renderWithProviders(
        <ResizeHandle
          {...makeProps({ onPreview, onCommit, currentSize: 100 })}
        />,
      );
      const sep = getSeparator();
      fireEvent.pointerDown(sep, { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
      fireEvent.pointerMove(sep, { clientX: 50, clientY: 0, pointerId: 1 });
      expect(onPreview).toHaveBeenCalledWith("col", 0, 150);
      onPreview.mockClear();

      // Cancel the drag — should revert to startSize and NOT commit
      fireEvent.pointerCancel(sep, { clientX: 50, clientY: 0, pointerId: 1 });
      expect(onPreview).toHaveBeenCalledWith("col", 0, 100); // revert
      expect(onCommit).not.toHaveBeenCalled();
    });

    it("clears body cursor on pointer-cancel", () => {
      renderWithProviders(<ResizeHandle {...makeProps()} />);
      const sep = getSeparator();
      fireEvent.pointerDown(sep, { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
      expect(document.body.style.cursor).toBe("col-resize");
      fireEvent.pointerCancel(sep, { clientX: 0, clientY: 0, pointerId: 1 });
      expect(document.body.style.cursor).toBe("");
    });
  });

  describe("cleanup on unmount", () => {
    it("clears body cursor if drag was active when component unmounts", () => {
      const { unmount } = renderWithProviders(<ResizeHandle {...makeProps()} />);
      const sep = getSeparator();
      // Start a drag without finishing
      fireEvent.pointerDown(sep, { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
      expect(document.body.style.cursor).toBe("col-resize");
      act(() => {
        unmount();
      });
      // The cleanup effect resets cursor if dragRef.current was set
      expect(document.body.style.cursor).toBe("");
    });

    it("does not error if unmounted when no drag is active", () => {
      const { unmount } = renderWithProviders(<ResizeHandle {...makeProps()} />);
      expect(() => act(() => unmount())).not.toThrow();
    });
  });

  describe("pointer-move without prior pointer-down (no-op)", () => {
    it("does not call onPreview when there is no active drag state", () => {
      const onPreview = vi.fn();
      renderWithProviders(<ResizeHandle {...makeProps({ onPreview })} />);
      const sep = getSeparator();
      // Move without down — dragRef.current is null, should be a no-op
      fireEvent.pointerMove(sep, { clientX: 100, clientY: 0, pointerId: 1 });
      expect(onPreview).not.toHaveBeenCalled();
    });
  });

  describe("releasePointerCapture throws — catch branch", () => {
    it("still commits even when releasePointerCapture throws", () => {
      const onCommit = vi.fn();
      // Make releasePointerCapture throw to exercise the catch block
      const originalRelease = HTMLElement.prototype.releasePointerCapture;
      HTMLElement.prototype.releasePointerCapture = () => {
        throw new Error("already released");
      };
      try {
        renderWithProviders(
          <ResizeHandle
            {...makeProps({ onCommit, currentSize: 100, orientation: "col" })}
          />,
        );
        const sep = getSeparator();
        fireEvent.pointerDown(sep, { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
        fireEvent.pointerMove(sep, { clientX: 50, clientY: 0, pointerId: 1 });
        fireEvent.pointerUp(sep, { clientX: 50, clientY: 0, pointerId: 1 });
        // Should still commit despite the throw
        expect(onCommit).toHaveBeenCalledWith("col", 0, 150);
      } finally {
        HTMLElement.prototype.releasePointerCapture = originalRelease;
      }
    });
  });
});
