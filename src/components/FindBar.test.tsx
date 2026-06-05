import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { FindBar, type FindBarProps } from "./FindBar";

function makeProps(overrides: Partial<FindBarProps> = {}): FindBarProps {
  return {
    open: true,
    query: "",
    matchCount: 0,
    activeIndex: -1,
    onQueryChange: vi.fn(),
    onNext: vi.fn(),
    onPrev: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("FindBar — open=false", () => {
  it("renders nothing when open is false", () => {
    const { container } = renderWithProviders(
      <FindBar {...makeProps({ open: false })} />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("FindBar — open=true renders the bar", () => {
  it("renders the search input when open=true", () => {
    renderWithProviders(<FindBar {...makeProps()} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders Previous, Next, and Close buttons", () => {
    renderWithProviders(<FindBar {...makeProps()} />);
    expect(screen.getByRole("button", { name: /Previous match/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next match/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Close find/i })).toBeInTheDocument();
  });

  it("has role=search on the container", () => {
    renderWithProviders(<FindBar {...makeProps()} />);
    expect(screen.getByRole("search")).toBeInTheDocument();
  });
});

describe("FindBar — counter text branches", () => {
  it("shows 'x of y' when matchCount>0 and activeIndex>=0", () => {
    renderWithProviders(
      <FindBar {...makeProps({ matchCount: 5, activeIndex: 2, query: "foo" })} />
    );
    // en locale: "{{current}} of {{total}}" → "3 of 5"
    expect(screen.getByText("3 of 5")).toBeInTheDocument();
  });

  it("shows match count when matchCount>0 but activeIndex<0", () => {
    renderWithProviders(
      <FindBar {...makeProps({ matchCount: 3, activeIndex: -1, query: "foo" })} />
    );
    // en locale: "{{count}} matches" → "3 matches"
    expect(screen.getByText("3 matches")).toBeInTheDocument();
  });

  it("shows '1 match' (singular) when matchCount=1 and activeIndex<0", () => {
    renderWithProviders(
      <FindBar {...makeProps({ matchCount: 1, activeIndex: -1, query: "foo" })} />
    );
    expect(screen.getByText("1 match")).toBeInTheDocument();
  });

  it("shows 'No matches' when matchCount=0 and query is non-empty", () => {
    renderWithProviders(
      <FindBar {...makeProps({ matchCount: 0, activeIndex: -1, query: "xyz" })} />
    );
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("shows empty counter text when matchCount=0 and query is empty", () => {
    renderWithProviders(
      <FindBar {...makeProps({ matchCount: 0, activeIndex: -1, query: "" })} />
    );
    // Empty string — no matches text shown
    expect(screen.queryByText("No matches")).toBeNull();
  });
});

describe("FindBar — interactions", () => {
  it("calls onQueryChange when user types in the input", async () => {
    const onQueryChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <FindBar {...makeProps({ onQueryChange })} />
    );
    await user.type(screen.getByRole("textbox"), "hello");
    expect(onQueryChange).toHaveBeenCalled();
    expect(onQueryChange).toHaveBeenCalledWith(expect.stringContaining("h"));
  });

  it("calls onNext when Next button is clicked", async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <FindBar {...makeProps({ matchCount: 3, activeIndex: 0, query: "a", onNext })} />
    );
    await user.click(screen.getByRole("button", { name: /Next match/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("calls onPrev when Previous button is clicked", async () => {
    const onPrev = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <FindBar {...makeProps({ matchCount: 3, activeIndex: 0, query: "a", onPrev })} />
    );
    await user.click(screen.getByRole("button", { name: /Previous match/i }));
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it("calls onClose when Close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <FindBar {...makeProps({ onClose })} />
    );
    await user.click(screen.getByRole("button", { name: /Close find/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when Escape key is pressed in the input", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <FindBar {...makeProps({ onClose })} />
    );
    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onNext when Enter key is pressed in the input", async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <FindBar {...makeProps({ matchCount: 2, activeIndex: 0, query: "a", onNext })} />
    );
    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Enter}");
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("calls onPrev when Shift+Enter is pressed in the input", async () => {
    const onPrev = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <FindBar {...makeProps({ matchCount: 2, activeIndex: 0, query: "a", onPrev })} />
    );
    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it("Next and Prev buttons are disabled when matchCount=0", () => {
    renderWithProviders(
      <FindBar {...makeProps({ matchCount: 0 })} />
    );
    expect(screen.getByRole("button", { name: /Next match/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Previous match/i })).toBeDisabled();
  });

  it("Next and Prev buttons are enabled when matchCount>0", () => {
    renderWithProviders(
      <FindBar {...makeProps({ matchCount: 2, activeIndex: 0, query: "a" })} />
    );
    expect(screen.getByRole("button", { name: /Next match/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Previous match/i })).not.toBeDisabled();
  });
});
