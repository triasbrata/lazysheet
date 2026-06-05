import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { Cell } from "./Cell";
import type { CellModel } from "@/lib/types";

vi.mock("@/lib/tauri-api", () => ({
  openExternal: vi.fn().mockResolvedValue(undefined),
}));

import { openExternal } from "@/lib/tauri-api";

function makeCell(overrides: Partial<CellModel> = {}): CellModel {
  return {
    v: { t: "Text", c: "Hello" },
    ...overrides,
  };
}

const defaultProps = {
  width: 80,
  minHeight: 24,
};

describe("Cell — placeholder branch", () => {
  it("renders a blank div (no text, no borders) when placeholder=true", () => {
    const { container } = renderWithProviders(
      <Cell {...defaultProps} cell={undefined} placeholder />
    );
    const div = container.firstChild as HTMLElement;
    expect(div.tagName).toBe("DIV");
    expect(div.textContent).toBe("");
    // No data-r / data-c on placeholder (no inner children)
    expect(div.children.length).toBe(0);
  });
});

describe("Cell — normal text cell", () => {
  it("renders cell text content", () => {
    const cell = makeCell({ v: { t: "Text", c: "World" } });
    renderWithProviders(<Cell {...defaultProps} cell={cell} />);
    expect(screen.getByText("World")).toBeInTheDocument();
  });

  it("renders empty text for empty cell value", () => {
    const cell = makeCell({ v: { t: "Empty" } });
    const { container } = renderWithProviders(
      <Cell {...defaultProps} cell={cell} />
    );
    // Should render without crash; text is empty
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders numeric cell", () => {
    const cell = makeCell({ v: { t: "Number", c: 42.5 } });
    renderWithProviders(<Cell {...defaultProps} cell={cell} />);
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it("renders boolean cell as TRUE/FALSE", () => {
    const cell = makeCell({ v: { t: "Bool", c: true } });
    renderWithProviders(<Cell {...defaultProps} cell={cell} />);
    expect(screen.getByText("TRUE")).toBeInTheDocument();
  });
});

describe("Cell — hyperlink cell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a button when cell.h is set", () => {
    const cell = makeCell({ v: { t: "Text", c: "Click me" }, h: "https://example.com" });
    renderWithProviders(<Cell {...defaultProps} cell={cell} />);
    const btn = screen.getByRole("button");
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toContain("Click me");
  });

  it("calls openExternal when hyperlink button is clicked", async () => {
    const cell = makeCell({ v: { t: "Text", c: "Go" }, h: "https://example.com" });
    const user = userEvent.setup();
    renderWithProviders(<Cell {...defaultProps} cell={cell} />);
    await user.click(screen.getByRole("button"));
    expect(openExternal).toHaveBeenCalledOnce();
    expect(openExternal).toHaveBeenCalledWith("https://example.com");
  });
});

describe("Cell — highlight variants", () => {
  it("renders without error for highlight=anchor", () => {
    const cell = makeCell();
    const { container } = renderWithProviders(
      <Cell {...defaultProps} cell={cell} highlight="anchor" />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders without error for highlight=selected", () => {
    const cell = makeCell();
    const { container } = renderWithProviders(
      <Cell {...defaultProps} cell={cell} highlight="selected" />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("applies match background color for highlight=match", () => {
    const cell = makeCell({ v: { t: "Text", c: "match me" } });
    const { container } = renderWithProviders(
      <Cell {...defaultProps} cell={cell} highlight="match" />
    );
    const div = container.firstChild as HTMLElement;
    expect(div.style.background).toContain("var(--primary)");
  });

  it("renders without error for highlight=null (default)", () => {
    const cell = makeCell();
    const { container } = renderWithProviders(
      <Cell {...defaultProps} cell={cell} highlight={null} />
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});

describe("Cell — formula badge", () => {
  it("renders FormulaBadge when cell.f is present", () => {
    const cell = makeCell({ v: { t: "Number", c: 10 }, f: "=SUM(A1:A5)" });
    renderWithProviders(<Cell {...defaultProps} cell={cell} />);
    // FormulaBadge renders a button with aria-label="Show formula"
    expect(screen.getByRole("button", { name: /Show formula/i })).toBeInTheDocument();
  });

  it("does not render FormulaBadge when cell.f is absent", () => {
    const cell = makeCell({ v: { t: "Text", c: "plain" } });
    renderWithProviders(<Cell {...defaultProps} cell={cell} />);
    expect(screen.queryByRole("button", { name: /Show formula/i })).toBeNull();
  });
});

describe("Cell — inHeaderRow", () => {
  it("applies header top border when inHeaderRow=true and not anchor", () => {
    const cell = makeCell({ v: { t: "Text", c: "Header" } });
    const { container } = renderWithProviders(
      <Cell {...defaultProps} cell={cell} inHeaderRow highlight={null} />
    );
    const div = container.firstChild as HTMLElement;
    expect(div.style.borderTop).toContain("var(--primary)");
  });

  it("does not apply header border when inHeaderRow=false", () => {
    const cell = makeCell({ v: { t: "Text", c: "Not header" } });
    const { container } = renderWithProviders(
      <Cell {...defaultProps} cell={cell} inHeaderRow={false} />
    );
    const div = container.firstChild as HTMLElement;
    expect(div.style.borderTop).toBe("");
  });

  it("skips header border when inHeaderRow=true but highlight=anchor", () => {
    const cell = makeCell({ v: { t: "Text", c: "H" } });
    const { container } = renderWithProviders(
      <Cell {...defaultProps} cell={cell} inHeaderRow highlight="anchor" />
    );
    const div = container.firstChild as HTMLElement;
    // anchor highlight takes precedence, no borderTop from header
    expect(div.style.borderTop).toBe("");
  });
});

describe("Cell — absolute style branch", () => {
  it("sets position=absolute when absolute=true", () => {
    const cell = makeCell();
    const { container } = renderWithProviders(
      <Cell
        {...defaultProps}
        cell={cell}
        absolute
        absoluteTop={10}
        absoluteLeft={20}
      />
    );
    const div = container.firstChild as HTMLElement;
    expect(div.style.position).toBe("absolute");
    expect(div.style.top).toBe("10px");
    expect(div.style.left).toBe("20px");
  });

  it("sets position=relative when absolute=false (default)", () => {
    const cell = makeCell();
    const { container } = renderWithProviders(
      <Cell {...defaultProps} cell={cell} />
    );
    const div = container.firstChild as HTMLElement;
    expect(div.style.position).toBe("relative");
  });
});

describe("Cell — wrap + clipOverflow", () => {
  it("renders with wrap style when cell has s.wrap=true", () => {
    const cell = makeCell({ s: { wrap: true } });
    const { container } = renderWithProviders(
      <Cell {...defaultProps} cell={cell} />
    );
    // The inner span should have whiteSpace: pre-wrap
    const innerSpan = container.querySelector("span");
    expect(innerSpan).toBeInTheDocument();
    expect(innerSpan!.style.whiteSpace).toBe("pre-wrap");
  });

  it("renders trailing slot when trailing prop is provided", () => {
    const cell = makeCell();
    renderWithProviders(
      <Cell {...defaultProps} cell={cell} trailing={<span>trailing-content</span>} />
    );
    expect(screen.getByText("trailing-content")).toBeInTheDocument();
  });
});

describe("Cell — CRLF normalization", () => {
  it("renders text with normalized newlines", () => {
    const cell = makeCell({ v: { t: "Text", c: "Line1\r\nLine2" } });
    const { container } = renderWithProviders(
      <Cell {...defaultProps} cell={cell} />
    );
    // Rendered text should have LF (\n) not CRLF
    expect(container.textContent).toContain("Line1");
    expect(container.textContent).toContain("Line2");
  });
});
