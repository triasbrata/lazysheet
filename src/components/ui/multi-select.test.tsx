import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { MultiSelect } from "./multi-select";

const OPTIONS = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "cherry", label: "Cherry" },
];

describe("MultiSelect", () => {
  it("renders trigger button", () => {
    renderWithProviders(
      <MultiSelect options={OPTIONS} selected={[]} onChange={() => {}} />
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("shows placeholder when nothing selected", () => {
    renderWithProviders(
      <MultiSelect
        options={OPTIONS}
        selected={[]}
        onChange={() => {}}
        placeholder="Pick one"
      />
    );
    expect(screen.getByText("Pick one")).toBeInTheDocument();
  });

  it("shows default placeholder text when no placeholder prop", () => {
    renderWithProviders(
      <MultiSelect options={OPTIONS} selected={[]} onChange={() => {}} />
    );
    expect(screen.getByText("Select…")).toBeInTheDocument();
  });

  it("shows chip for selected option", () => {
    renderWithProviders(
      <MultiSelect options={OPTIONS} selected={["apple"]} onChange={() => {}} />
    );
    expect(screen.getByText("Apple")).toBeInTheDocument();
  });

  it("opens popover and shows options on trigger click", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MultiSelect options={OPTIONS} selected={[]} onChange={() => {}} />
    );

    await user.click(screen.getByRole("button"));
    // Options are rendered in the popover
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();
    expect(screen.getByText("Cherry")).toBeInTheDocument();
  });

  it("calls onChange with toggled option when an option is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <MultiSelect options={OPTIONS} selected={[]} onChange={onChange} />
    );

    await user.click(screen.getByRole("button"));
    const appleOption = screen.getByRole("option", { name: /Apple/i });
    await user.click(appleOption);

    expect(onChange).toHaveBeenCalledWith(["apple"]);
  });

  it("calls onChange removing option when already selected option is clicked (toggle off)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <MultiSelect options={OPTIONS} selected={["apple"]} onChange={onChange} />
    );

    // With a selected chip, multiple buttons are present; target the trigger by data-slot
    const trigger = document.querySelector("[data-slot='multi-select-trigger']") as HTMLElement;
    await user.click(trigger);
    const appleOption = screen.getByRole("option", { name: /Apple/i });
    await user.click(appleOption);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("removes chip when remove button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <MultiSelect
        options={OPTIONS}
        selected={["apple", "banana"]}
        onChange={onChange}
      />
    );

    const removeApple = screen.getByRole("button", { name: "Remove Apple" });
    await user.click(removeApple);

    expect(onChange).toHaveBeenCalledWith(["banana"]);
  });

  it("shows 'No options' when options array is empty and popover is open", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MultiSelect options={[]} selected={[]} onChange={() => {}} />
    );

    await user.click(screen.getByRole("button"));
    expect(screen.getByText("No options")).toBeInTheDocument();
  });

  it("applies custom className to trigger", () => {
    const { container } = renderWithProviders(
      <MultiSelect
        options={OPTIONS}
        selected={[]}
        onChange={() => {}}
        className="my-custom"
      />
    );
    expect(container.querySelector(".my-custom")).toBeInTheDocument();
  });

  it("shows multiple chips for multiple selected options", () => {
    renderWithProviders(
      <MultiSelect
        options={OPTIONS}
        selected={["apple", "cherry"]}
        onChange={() => {}}
      />
    );
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Cherry")).toBeInTheDocument();
  });

  it("handles keyboard Enter on remove chip span", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <MultiSelect
        options={OPTIONS}
        selected={["banana"]}
        onChange={onChange}
      />
    );

    const removeBtn = screen.getByRole("button", { name: "Remove Banana" });
    removeBtn.focus();
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
