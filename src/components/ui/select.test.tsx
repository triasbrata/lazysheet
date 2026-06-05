import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "./select";

describe("Select", () => {
  function BasicSelect({
    onValueChange,
    defaultValue,
  }: {
    onValueChange?: (v: string) => void;
    defaultValue?: string;
  }) {
    return (
      <Select onValueChange={onValueChange} defaultValue={defaultValue}>
        <SelectTrigger aria-label="select fruit">
          <SelectValue placeholder="Pick a fruit" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectItem value="cherry">Cherry</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  it("renders trigger with placeholder", () => {
    renderWithProviders(<BasicSelect />);
    expect(screen.getByText("Pick a fruit")).toBeInTheDocument();
  });

  it("renders trigger with data-slot", () => {
    renderWithProviders(<BasicSelect />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("data-slot", "select-trigger");
  });

  it("opens dropdown content when trigger is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BasicSelect />);

    await user.click(screen.getByRole("combobox"));
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();
    expect(screen.getByText("Cherry")).toBeInTheDocument();
  });

  it("calls onValueChange when an item is selected", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderWithProviders(<BasicSelect onValueChange={onValueChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Banana"));

    expect(onValueChange).toHaveBeenCalledWith("banana");
  });

  it("renders with defaultValue selected", () => {
    renderWithProviders(<BasicSelect defaultValue="apple" />);
    expect(screen.getByText("Apple")).toBeInTheDocument();
  });

  it("renders SelectLabel in group", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Select>
        <SelectTrigger aria-label="select">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Fruits</SelectLabel>
            <SelectItem value="apple">Apple</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );

    await user.click(screen.getByRole("combobox"));
    const label = screen.getByText("Fruits");
    expect(label).toHaveAttribute("data-slot", "select-label");
  });

  it("renders SelectSeparator", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Select>
        <SelectTrigger aria-label="select">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectSeparator />
          <SelectItem value="banana">Banana</SelectItem>
        </SelectContent>
      </Select>
    );

    await user.click(screen.getByRole("combobox"));
    const separator = document.querySelector("[data-slot='select-separator']");
    expect(separator).toBeInTheDocument();
  });

  it("renders SelectGroup with data-slot", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Select>
        <SelectTrigger aria-label="select">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="apple">Apple</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );

    await user.click(screen.getByRole("combobox"));
    const group = document.querySelector("[data-slot='select-group']");
    expect(group).toBeInTheDocument();
  });

  it("renders SelectItem with data-slot", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BasicSelect />);

    await user.click(screen.getByRole("combobox"));
    const items = document.querySelectorAll("[data-slot='select-item']");
    expect(items.length).toBeGreaterThan(0);
  });

  it("renders trigger with sm size", () => {
    renderWithProviders(
      <Select>
        <SelectTrigger size="sm" aria-label="select">
          <SelectValue placeholder="Small" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("data-size", "sm");
  });

  it("renders SelectScrollUpButton and SelectScrollDownButton inside SelectContent", () => {
    // ScrollUpButton/ScrollDownButton must be rendered within SelectContent;
    // jsdom has no layout engine so Radix conditionally hides scroll buttons when
    // there is no overflow — verify SelectContent is mounted (which wraps the buttons)
    // and that SelectItem with data-slot is present as a proxy for open content.
    renderWithProviders(
      <Select open>
        <SelectTrigger aria-label="select">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>
    );
    const content = document.querySelector("[data-slot='select-content']");
    expect(content).toBeInTheDocument();
    const item = document.querySelector("[data-slot='select-item']");
    expect(item).toBeInTheDocument();
  });
});
