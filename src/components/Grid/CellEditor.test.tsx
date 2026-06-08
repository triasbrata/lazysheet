import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor, fireEvent } from "@/test/render";
import { CellEditor } from "./CellEditor";

function makeProps(overrides: Partial<Parameters<typeof CellEditor>[0]> = {}) {
  return {
    initialText: "hello",
    left: 10,
    top: 20,
    width: 100,
    height: 24,
    onCommit: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

describe("CellEditor — render", () => {
  it("renders a textarea with the initialText as its value", () => {
    const props = makeProps({ initialText: "test value" });
    renderWithProviders(<CellEditor {...props} />);
    const el = screen.getByTestId("cell-editor") as HTMLTextAreaElement;
    expect(el).toBeInTheDocument();
    expect(el.value).toBe("test value");
  });

  it("applies absolute positioning styles", () => {
    const props = makeProps({ left: 50, top: 100, width: 120, height: 30 });
    renderWithProviders(<CellEditor {...props} />);
    const el = screen.getByTestId("cell-editor") as HTMLTextAreaElement;
    expect(el.style.position).toBe("absolute");
    expect(el.style.left).toBe("50px");
    expect(el.style.top).toBe("100px");
    expect(el.style.width).toBe("120px");
    expect(el.style.height).toBe("30px");
    expect(el.style.zIndex).toBe("30");
  });
});

describe("CellEditor — autofocus", () => {
  it("focuses the textarea after mount", async () => {
    const props = makeProps();
    renderWithProviders(<CellEditor {...props} />);
    const el = screen.getByTestId("cell-editor");
    await waitFor(() => {
      expect(document.activeElement).toBe(el);
    });
  });
});

describe("CellEditor — keyboard: Enter", () => {
  it("calls onCommit with updated value and 'down' on Enter", async () => {
    const props = makeProps({ initialText: "initial" });
    const user = userEvent.setup();
    renderWithProviders(<CellEditor {...props} />);
    const el = screen.getByTestId("cell-editor") as HTMLTextAreaElement;

    // Type new content
    await user.clear(el);
    await user.type(el, "new value");

    fireEvent.keyDown(el, { key: "Enter", shiftKey: false });

    expect(props.onCommit).toHaveBeenCalledOnce();
    expect(props.onCommit).toHaveBeenCalledWith("new value", "down");
    expect(props.onCancel).not.toHaveBeenCalled();
  });
});

describe("CellEditor — keyboard: Tab", () => {
  it("calls onCommit with value and 'right' on Tab", async () => {
    const props = makeProps({ initialText: "tab test" });
    renderWithProviders(<CellEditor {...props} />);
    const el = screen.getByTestId("cell-editor") as HTMLTextAreaElement;

    const event = fireEvent.keyDown(el, { key: "Tab" });
    // default should be prevented — fireEvent returns false when preventDefault was called
    expect(event).toBe(false);

    expect(props.onCommit).toHaveBeenCalledOnce();
    expect(props.onCommit).toHaveBeenCalledWith("tab test", "right");
    expect(props.onCancel).not.toHaveBeenCalled();
  });
});

describe("CellEditor — keyboard: Escape", () => {
  it("calls onCancel and does NOT call onCommit on Escape", () => {
    const props = makeProps({ initialText: "esc test" });
    renderWithProviders(<CellEditor {...props} />);
    const el = screen.getByTestId("cell-editor") as HTMLTextAreaElement;

    fireEvent.keyDown(el, { key: "Escape" });

    expect(props.onCancel).toHaveBeenCalledOnce();
    expect(props.onCommit).not.toHaveBeenCalled();
  });
});

describe("CellEditor — blur", () => {
  it("calls onCommit with value and 'none' on blur", () => {
    const props = makeProps({ initialText: "blur test" });
    renderWithProviders(<CellEditor {...props} />);
    const el = screen.getByTestId("cell-editor") as HTMLTextAreaElement;

    fireEvent.blur(el);

    expect(props.onCommit).toHaveBeenCalledOnce();
    expect(props.onCommit).toHaveBeenCalledWith("blur test", "none");
    expect(props.onCancel).not.toHaveBeenCalled();
  });
});

describe("CellEditor — Shift+Enter", () => {
  it("does NOT call onCommit on Shift+Enter (allows newline)", () => {
    const props = makeProps({ initialText: "multiline" });
    renderWithProviders(<CellEditor {...props} />);
    const el = screen.getByTestId("cell-editor") as HTMLTextAreaElement;

    fireEvent.keyDown(el, { key: "Enter", shiftKey: true });

    expect(props.onCommit).not.toHaveBeenCalled();
    expect(props.onCancel).not.toHaveBeenCalled();
  });
});
