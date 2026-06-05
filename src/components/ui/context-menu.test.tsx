import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, userEvent, fireEvent } from "@/test/render";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "./context-menu";

describe("ContextMenu", () => {
  it("renders trigger area", () => {
    renderWithProviders(
      <ContextMenu>
        <ContextMenuTrigger>Right-click me</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Item 1</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
    expect(screen.getByText("Right-click me")).toBeInTheDocument();
  });

  it("opens content on right-click (contextMenu event)", async () => {
    renderWithProviders(
      <ContextMenu>
        <ContextMenuTrigger data-testid="trigger">Right-click area</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Context Action</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );

    const trigger = screen.getByTestId("trigger");
    fireEvent.contextMenu(trigger);

    expect(screen.getByText("Context Action")).toBeInTheDocument();
  });

  it("renders ContextMenuItem with correct data-slot", async () => {
    renderWithProviders(
      <ContextMenu>
        <ContextMenuTrigger data-testid="trigger">area</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>My Action</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );

    fireEvent.contextMenu(screen.getByTestId("trigger"));
    const item = screen.getByText("My Action").closest("[data-slot='context-menu-item']");
    expect(item).toBeInTheDocument();
  });

  it("renders ContextMenuItem with destructive variant", async () => {
    renderWithProviders(
      <ContextMenu>
        <ContextMenuTrigger data-testid="trigger">area</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem variant="destructive">Delete</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );

    fireEvent.contextMenu(screen.getByTestId("trigger"));
    const item = screen.getByText("Delete").closest("[data-slot='context-menu-item']");
    expect(item).toHaveAttribute("data-variant", "destructive");
  });

  it("renders ContextMenuLabel", async () => {
    renderWithProviders(
      <ContextMenu>
        <ContextMenuTrigger data-testid="trigger">area</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>Section Title</ContextMenuLabel>
          <ContextMenuItem>Item</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );

    fireEvent.contextMenu(screen.getByTestId("trigger"));
    const label = screen.getByText("Section Title");
    expect(label).toHaveAttribute("data-slot", "context-menu-label");
  });

  it("renders ContextMenuSeparator", async () => {
    renderWithProviders(
      <ContextMenu>
        <ContextMenuTrigger data-testid="trigger">area</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Item 1</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem>Item 2</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );

    fireEvent.contextMenu(screen.getByTestId("trigger"));
    const separator = document.querySelector("[data-slot='context-menu-separator']");
    expect(separator).toBeInTheDocument();
  });

  it("renders ContextMenuShortcut", async () => {
    renderWithProviders(
      <ContextMenu>
        <ContextMenuTrigger data-testid="trigger">area</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>
            Copy
            <ContextMenuShortcut>⌘C</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );

    fireEvent.contextMenu(screen.getByTestId("trigger"));
    const shortcut = screen.getByText("⌘C");
    expect(shortcut).toHaveAttribute("data-slot", "context-menu-shortcut");
  });

  it("renders ContextMenuGroup", async () => {
    renderWithProviders(
      <ContextMenu>
        <ContextMenuTrigger data-testid="trigger">area</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuGroup>
            <ContextMenuItem>Grouped</ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
    );

    fireEvent.contextMenu(screen.getByTestId("trigger"));
    const group = document.querySelector("[data-slot='context-menu-group']");
    expect(group).toBeInTheDocument();
  });

  it("renders ContextMenuSub with SubTrigger", async () => {
    renderWithProviders(
      <ContextMenu>
        <ContextMenuTrigger data-testid="trigger">area</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuSub>
            <ContextMenuSubTrigger>More</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem>Sub Action</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>
    );

    fireEvent.contextMenu(screen.getByTestId("trigger"));
    const subTrigger = screen.getByText("More");
    expect(subTrigger).toBeInTheDocument();
    expect(subTrigger.closest("[data-slot='context-menu-sub-trigger']")).toBeInTheDocument();
  });

  it("calls onSelect when item is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(
      <ContextMenu>
        <ContextMenuTrigger data-testid="trigger">area</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={onSelect}>Action</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );

    fireEvent.contextMenu(screen.getByTestId("trigger"));
    await user.click(screen.getByText("Action"));
    expect(onSelect).toHaveBeenCalled();
  });

  it("renders inset ContextMenuItem", async () => {
    renderWithProviders(
      <ContextMenu>
        <ContextMenuTrigger data-testid="trigger">area</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem inset>Indented</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );

    fireEvent.contextMenu(screen.getByTestId("trigger"));
    const item = screen.getByText("Indented").closest("[data-slot='context-menu-item']");
    expect(item).toHaveAttribute("data-inset", "true");
  });
});
