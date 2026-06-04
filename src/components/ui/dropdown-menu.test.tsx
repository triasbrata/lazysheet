import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "./dropdown-menu";

describe("DropdownMenu", () => {
  it("renders trigger button", () => {
    renderWithProviders(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.getByText("Open Menu")).toBeInTheDocument();
  });

  it("opens content when trigger is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Action Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByText("Open"));
    expect(screen.getByText("Action Item")).toBeInTheDocument();
  });

  it("renders DropdownMenuItem with correct data-slot", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>My Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByText("Open"));
    const item = screen.getByText("My Item");
    expect(item.closest("[data-slot='dropdown-menu-item']")).toBeInTheDocument();
  });

  it("renders DropdownMenuItem with destructive variant", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByText("Open"));
    const item = screen.getByText("Delete").closest("[data-slot='dropdown-menu-item']");
    expect(item).toHaveAttribute("data-variant", "destructive");
  });

  it("renders CheckboxItem with checked state", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked onCheckedChange={() => {}}>
            Toggle Feature
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByText("Open"));
    const item = screen.getByText("Toggle Feature");
    expect(item).toBeInTheDocument();
    const checkboxEl = item.closest("[data-slot='dropdown-menu-checkbox-item']");
    expect(checkboxEl).toBeInTheDocument();
    expect(checkboxEl).toHaveAttribute("data-state", "checked");
  });

  it("renders RadioGroup with RadioItem", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="option1">
            <DropdownMenuRadioItem value="option1">Option 1</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="option2">Option 2</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByText("Open"));
    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
    const checkedItem = screen.getByText("Option 1").closest("[data-slot='dropdown-menu-radio-item']");
    expect(checkedItem).toHaveAttribute("data-state", "checked");
  });

  it("renders DropdownMenuLabel", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Category</DropdownMenuLabel>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByText("Open"));
    const label = screen.getByText("Category");
    expect(label).toHaveAttribute("data-slot", "dropdown-menu-label");
  });

  it("renders DropdownMenuSeparator", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Item 2</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByText("Open"));
    const separator = document.querySelector("[data-slot='dropdown-menu-separator']");
    expect(separator).toBeInTheDocument();
  });

  it("renders DropdownMenuShortcut", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            Save
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByText("Open"));
    const shortcut = screen.getByText("⌘S");
    expect(shortcut).toHaveAttribute("data-slot", "dropdown-menu-shortcut");
  });

  it("renders DropdownMenuGroup", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuItem>Grouped Item</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByText("Open"));
    const group = document.querySelector("[data-slot='dropdown-menu-group']");
    expect(group).toBeInTheDocument();
    expect(screen.getByText("Grouped Item")).toBeInTheDocument();
  });

  it("renders Sub menu components", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>More Options</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Sub Item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByText("Open"));
    const subTrigger = screen.getByText("More Options");
    expect(subTrigger).toBeInTheDocument();
    expect(subTrigger.closest("[data-slot='dropdown-menu-sub-trigger']")).toBeInTheDocument();
  });

  it("calls onSelect when item is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>Click Me</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByText("Open"));
    await user.click(screen.getByText("Click Me"));
    expect(onSelect).toHaveBeenCalled();
  });

  it("renders inset DropdownMenuItem", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem inset>Inset Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByText("Open"));
    const item = screen.getByText("Inset Item").closest("[data-slot='dropdown-menu-item']");
    expect(item).toHaveAttribute("data-inset", "true");
  });
});
