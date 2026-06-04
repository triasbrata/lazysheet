import { describe, it, expect } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./tooltip";

// Note: renderWithProviders already wraps with TooltipProvider

describe("Tooltip", () => {
  it("renders tooltip trigger", () => {
    renderWithProviders(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Tooltip text</TooltipContent>
      </Tooltip>
    );
    expect(screen.getByText("Hover me")).toBeInTheDocument();
  });

  it("renders trigger with correct data-slot", () => {
    renderWithProviders(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Tooltip</TooltipContent>
      </Tooltip>
    );
    const trigger = screen.getByText("Hover me");
    expect(trigger).toHaveAttribute("data-slot", "tooltip-trigger");
  });

  it("shows tooltip content on hover", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Tooltip text</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    await user.hover(screen.getByText("Hover me"));
    const matches = await screen.findAllByText("Tooltip text");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("shows tooltip content on focus", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger>Focus me</TooltipTrigger>
          <TooltipContent>Focus tooltip</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    await user.tab();
    const matches = await screen.findAllByText("Focus tooltip");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders open tooltip when open=true", () => {
    renderWithProviders(
      <Tooltip open>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent>Always visible</TooltipContent>
      </Tooltip>
    );
    expect(screen.getAllByText("Always visible").length).toBeGreaterThanOrEqual(1);
  });

  it("renders TooltipContent with data-slot", () => {
    renderWithProviders(
      <Tooltip open>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent>Content here</TooltipContent>
      </Tooltip>
    );
    const content = document.querySelector("[data-slot='tooltip-content']");
    expect(content).toBeInTheDocument();
  });

  it("renders Tooltip with custom sideOffset on content", () => {
    renderWithProviders(
      <Tooltip open>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent sideOffset={8}>Tooltip with offset</TooltipContent>
      </Tooltip>
    );
    expect(screen.getAllByText("Tooltip with offset").length).toBeGreaterThanOrEqual(1);
  });

  it("renders standalone TooltipProvider wrapping children", () => {
    renderWithProviders(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Provider tooltip</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    expect(screen.getAllByText("Provider tooltip").length).toBeGreaterThanOrEqual(1);
  });

  it("renders TooltipProvider with custom delayDuration", () => {
    renderWithProviders(
      <TooltipProvider delayDuration={500}>
        <Tooltip open>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Delayed</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    expect(screen.getAllByText("Delayed").length).toBeGreaterThanOrEqual(1);
  });

  it("applies custom className to TooltipContent", () => {
    renderWithProviders(
      <Tooltip open>
        <TooltipTrigger>Trigger</TooltipTrigger>
        <TooltipContent className="my-tooltip-class">Custom class</TooltipContent>
      </Tooltip>
    );
    const content = document.querySelector(".my-tooltip-class");
    expect(content).toBeInTheDocument();
  });
});
