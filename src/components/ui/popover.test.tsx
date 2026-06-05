import { describe, it, expect } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from "./popover";

describe("Popover", () => {
  it("renders trigger button", () => {
    renderWithProviders(
      <Popover>
        <PopoverTrigger>Open Popover</PopoverTrigger>
        <PopoverContent>
          <p>Popover content</p>
        </PopoverContent>
      </Popover>
    );
    expect(screen.getByText("Open Popover")).toBeInTheDocument();
  });

  it("renders popover trigger with correct data-slot", () => {
    renderWithProviders(
      <Popover>
        <PopoverTrigger>Trigger</PopoverTrigger>
        <PopoverContent>Content</PopoverContent>
      </Popover>
    );
    const trigger = screen.getByText("Trigger");
    expect(trigger).toHaveAttribute("data-slot", "popover-trigger");
  });

  it("opens popover content when trigger is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>
          <p>Popover inner content</p>
        </PopoverContent>
      </Popover>
    );

    await user.click(screen.getByText("Open"));
    expect(screen.getByText("Popover inner content")).toBeInTheDocument();
  });

  it("renders popover content with correct data-slot", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Content</PopoverContent>
      </Popover>
    );

    await user.click(screen.getByText("Open"));
    const content = document.querySelector("[data-slot='popover-content']");
    expect(content).toBeInTheDocument();
  });

  it("renders controlled open popover", () => {
    renderWithProviders(
      <Popover open>
        <PopoverTrigger>Trigger</PopoverTrigger>
        <PopoverContent>Always open content</PopoverContent>
      </Popover>
    );
    expect(screen.getByText("Always open content")).toBeInTheDocument();
  });

  it("applies custom className to popover content", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent className="custom-popover">Inner</PopoverContent>
      </Popover>
    );

    await user.click(screen.getByText("Open"));
    const content = document.querySelector(".custom-popover");
    expect(content).toBeInTheDocument();
  });

  it("renders popover with default data-slot on root", () => {
    // Radix Popover.Root is a context-only provider with no DOM node of its own;
    // verify the popover tree is mounted by asserting the trigger's data-slot attribute.
    renderWithProviders(
      <Popover>
        <PopoverTrigger>T</PopoverTrigger>
        <PopoverContent>C</PopoverContent>
      </Popover>
    );
    const trigger = document.querySelector("[data-slot='popover-trigger']");
    expect(trigger).toBeInTheDocument();
  });

  it("renders PopoverAnchor", () => {
    renderWithProviders(
      <Popover open>
        <PopoverAnchor>
          <div data-testid="anchor-child">Anchor</div>
        </PopoverAnchor>
        <PopoverTrigger>Trigger</PopoverTrigger>
        <PopoverContent>Content</PopoverContent>
      </Popover>
    );
    const anchor = document.querySelector("[data-slot='popover-anchor']");
    expect(anchor).toBeInTheDocument();
  });

  it("renders popover content with custom align and sideOffset", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent align="center" sideOffset={8}>
          Aligned content
        </PopoverContent>
      </Popover>
    );

    await user.click(screen.getByText("Open"));
    expect(screen.getByText("Aligned content")).toBeInTheDocument();
  });
});
