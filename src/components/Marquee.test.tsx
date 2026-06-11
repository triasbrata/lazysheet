import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Marquee } from "./Marquee";

// ResizeObserver is already polyfilled in src/test/setup.ts.
// scrollWidth / clientWidth are both 0 in jsdom by default (no layout engine),
// so tests that need to simulate overflow must stub them before rendering.

function stubSizes(scrollWidth: number, clientWidth: number) {
  const scrollWidthSpy = vi
    .spyOn(HTMLElement.prototype, "scrollWidth", "get")
    .mockReturnValue(scrollWidth);
  const clientWidthSpy = vi
    .spyOn(HTMLElement.prototype, "clientWidth", "get")
    .mockReturnValue(clientWidth);
  return { scrollWidthSpy, clientWidthSpy };
}

describe("Marquee", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the text content", () => {
    render(<Marquee text="Hello World" />);
    expect(screen.getAllByText("Hello World").length).toBeGreaterThanOrEqual(1);
  });

  it("forwards data-testid, title, and className to the outer element", () => {
    render(
      <Marquee
        text="Test"
        data-testid="my-marquee"
        title="My title"
        className="custom-class"
      />
    );
    const outer = screen.getByTestId("my-marquee");
    expect(outer).toBeInTheDocument();
    expect(outer).toHaveAttribute("title", "My title");
    expect(outer.classList.contains("custom-class")).toBe(true);
  });

  it("renders animated track with duplicate when content overflows container", () => {
    // scrollWidth > clientWidth + 1 triggers overflow state
    stubSizes(300, 100);

    render(<Marquee text="A very long text that overflows the container" />);

    // The animated track wrapper should exist
    const track = document.querySelector(".animate-marquee");
    expect(track).not.toBeNull();

    // There should be an aria-hidden duplicate of the text
    const hiddenCopies = document.querySelectorAll('[aria-hidden]');
    expect(hiddenCopies.length).toBeGreaterThanOrEqual(1);
  });

  it("renders static truncating span (no animation) when content fits", () => {
    // scrollWidth <= clientWidth + 1 → no overflow
    stubSizes(50, 200);

    render(<Marquee text="Short text" />);

    const track = document.querySelector(".animate-marquee");
    expect(track).toBeNull();

    // The text should still be visible in a static span
    expect(screen.getByText("Short text")).toBeInTheDocument();
  });
});
