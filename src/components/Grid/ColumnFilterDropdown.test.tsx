import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { renderWithProviders, screen, userEvent, fireEvent } from "@/test/render";
import { ColumnFilterDropdown } from "./ColumnFilterDropdown";
import type { ColumnFilter } from "@/lib/grid-filter";

// ─── Default test props ───────────────────────────────────────────────────────

const DEFAULT_FILTER: ColumnFilter = {
  condition: { op: "none", operand: "" },
  excluded: [],
};

const DISTINCT_VALUES = ["apple", "banana", "cherry", ""];

function makeProps(overrides?: Partial<{
  open: boolean;
  onOpenChange: (o: boolean) => void;
  distinctValues: string[];
  value: ColumnFilter;
  onApply: (f: ColumnFilter) => void;
}>) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    columnLabel: "Fruit",
    distinctValues: DISTINCT_VALUES,
    value: DEFAULT_FILTER,
    onApply: vi.fn(),
    children: <button>Trigger</button>,
    ...overrides,
  };
}

// ─── Controlled wrapper so we can test open/close state resets ───────────────

function ControlledDropdown(props: {
  initialOpen?: boolean;
  initialFilter?: ColumnFilter;
  distinctValues?: string[];
  onApply?: (f: ColumnFilter) => void;
}) {
  const [open, setOpen] = useState(props.initialOpen ?? true);
  const [filter] = useState<ColumnFilter>(props.initialFilter ?? DEFAULT_FILTER);
  const onApply = props.onApply ?? vi.fn();

  return (
    <ColumnFilterDropdown
      open={open}
      onOpenChange={setOpen}
      columnLabel="Col"
      distinctValues={props.distinctValues ?? DISTINCT_VALUES}
      value={filter}
      onApply={onApply}
    >
      <button onClick={() => setOpen(true)}>Open Filter</button>
    </ColumnFilterDropdown>
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ColumnFilterDropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering when open ────────────────────────────────────────────────────

  describe("renders content when open=true", () => {
    it("shows the 'Filter by condition' section header", () => {
      renderWithProviders(<ColumnFilterDropdown {...makeProps()} />);
      expect(screen.getByText(/filter by condition/i)).toBeInTheDocument();
    });

    it("renders the condition Select combobox", () => {
      renderWithProviders(<ColumnFilterDropdown {...makeProps()} />);
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("renders OK and Cancel buttons", () => {
      renderWithProviders(<ColumnFilterDropdown {...makeProps()} />);
      expect(screen.getByRole("button", { name: /ok/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    it("renders value checkboxes for each distinct value", () => {
      renderWithProviders(<ColumnFilterDropdown {...makeProps()} />);
      // apple, banana, cherry are visible; "" renders as "(Blanks)"
      expect(screen.getByLabelText("apple")).toBeInTheDocument();
      expect(screen.getByLabelText("banana")).toBeInTheDocument();
      expect(screen.getByLabelText("cherry")).toBeInTheDocument();
      expect(screen.getByLabelText("(Blanks)")).toBeInTheDocument();
    });

    it("renders 'Select all' and 'Clear' buttons", () => {
      renderWithProviders(<ColumnFilterDropdown {...makeProps()} />);
      expect(screen.getByRole("button", { name: /select all/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument();
    });

    it("renders the search input", () => {
      renderWithProviders(<ColumnFilterDropdown {...makeProps()} />);
      expect(screen.getByPlaceholderText("Search values…")).toBeInTheDocument();
    });

    it("shows correct 'Displaying N' count", () => {
      renderWithProviders(<ColumnFilterDropdown {...makeProps()} />);
      // All 4 values, none excluded → Displaying 4
      expect(screen.getByText("Displaying 4")).toBeInTheDocument();
    });
  });

  // ── Operand input visibility based on op ──────────────────────────────────

  describe("operand input visibility", () => {
    it("hides operand input when op=none (NO_OPERAND_OPS)", () => {
      renderWithProviders(
        <ColumnFilterDropdown
          {...makeProps({ value: { condition: { op: "none", operand: "" }, excluded: [] } })}
        />
      );
      expect(screen.queryByPlaceholderText("Value")).toBeNull();
    });

    it("hides operand input when op=empty (NO_OPERAND_OPS)", () => {
      renderWithProviders(
        <ColumnFilterDropdown
          {...makeProps({ value: { condition: { op: "empty", operand: "" }, excluded: [] } })}
        />
      );
      expect(screen.queryByPlaceholderText("Value")).toBeNull();
    });

    it("hides operand input when op=notEmpty (NO_OPERAND_OPS)", () => {
      renderWithProviders(
        <ColumnFilterDropdown
          {...makeProps({ value: { condition: { op: "notEmpty", operand: "" }, excluded: [] } })}
        />
      );
      expect(screen.queryByPlaceholderText("Value")).toBeNull();
    });

    it("shows operand input when op=contains", () => {
      renderWithProviders(
        <ColumnFilterDropdown
          {...makeProps({ value: { condition: { op: "contains", operand: "" }, excluded: [] } })}
        />
      );
      expect(screen.getByPlaceholderText("Value")).toBeInTheDocument();
    });

    it("shows operand input when op=startsWith", () => {
      renderWithProviders(
        <ColumnFilterDropdown
          {...makeProps({ value: { condition: { op: "startsWith", operand: "x" }, excluded: [] } })}
        />
      );
      const input = screen.getByPlaceholderText("Value") as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toBe("x");
    });

    it("shows operand input when op=gt (numeric)", () => {
      renderWithProviders(
        <ColumnFilterDropdown
          {...makeProps({ value: { condition: { op: "gt", operand: "10" }, excluded: [] } })}
        />
      );
      expect(screen.getByPlaceholderText("Value")).toBeInTheDocument();
    });

    it("hides operand input after changing condition select to 'Is empty'", async () => {
      const user = userEvent.setup();
      // Start with 'contains' so operand is visible
      renderWithProviders(
        <ColumnFilterDropdown
          {...makeProps({ value: { condition: { op: "contains", operand: "" }, excluded: [] } })}
        />
      );
      expect(screen.getByPlaceholderText("Value")).toBeInTheDocument();

      // Open the condition select
      const combobox = screen.getByRole("combobox");
      await user.click(combobox);

      // Select "Is empty"
      const emptyOption = await screen.findByText("Is empty");
      await user.click(emptyOption);

      // Operand input should now be hidden
      expect(screen.queryByPlaceholderText("Value")).toBeNull();
    });

    it("shows operand input after changing condition select from none to 'Text contains'", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ColumnFilterDropdown {...makeProps()} />);

      // Initially op=none → no operand input
      expect(screen.queryByPlaceholderText("Value")).toBeNull();

      // Open select and choose "Text contains"
      const combobox = screen.getByRole("combobox");
      await user.click(combobox);

      const containsOption = await screen.findByText("Text contains");
      await user.click(containsOption);

      expect(screen.getByPlaceholderText("Value")).toBeInTheDocument();
    });
  });

  // ── Value checkboxes ──────────────────────────────────────────────────────

  describe("value checklist interactions", () => {
    it("all values are checked when excluded=[]", () => {
      renderWithProviders(<ColumnFilterDropdown {...makeProps()} />);
      const checkboxes = screen.getAllByRole("checkbox");
      checkboxes.forEach((cb) => {
        expect(cb).toBeChecked();
      });
    });

    it("excluded values render as unchecked", () => {
      renderWithProviders(
        <ColumnFilterDropdown
          {...makeProps({
            value: { condition: { op: "none", operand: "" }, excluded: ["banana"] },
          })}
        />
      );
      const bananaCheckbox = screen.getByLabelText("banana") as HTMLInputElement;
      expect(bananaCheckbox).not.toBeChecked();
    });

    it("clicking a checked value unchecks it (adds to excluded)", async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      renderWithProviders(
        <ColumnFilterDropdown {...makeProps({ onApply })} />
      );

      // Uncheck "banana"
      await user.click(screen.getByLabelText("banana"));

      // Apply
      await user.click(screen.getByRole("button", { name: /ok/i }));

      expect(onApply).toHaveBeenCalledWith({
        condition: { op: "none", operand: "" },
        excluded: ["banana"],
      });
    });

    it("clicking an unchecked value re-checks it (removes from excluded)", async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      renderWithProviders(
        <ColumnFilterDropdown
          {...makeProps({
            onApply,
            value: { condition: { op: "none", operand: "" }, excluded: ["banana"] },
          })}
        />
      );

      // Re-check "banana"
      await user.click(screen.getByLabelText("banana"));

      await user.click(screen.getByRole("button", { name: /ok/i }));

      expect(onApply).toHaveBeenCalledWith({
        condition: { op: "none", operand: "" },
        excluded: [],
      });
    });

    it("'Select all' button clears excluded list", async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      renderWithProviders(
        <ColumnFilterDropdown
          {...makeProps({
            onApply,
            value: { condition: { op: "none", operand: "" }, excluded: ["apple", "banana"] },
          })}
        />
      );

      await user.click(screen.getByRole("button", { name: /select all/i }));
      await user.click(screen.getByRole("button", { name: /ok/i }));

      expect(onApply).toHaveBeenCalledWith({
        condition: { op: "none", operand: "" },
        excluded: [],
      });
    });

    it("'Clear' button excludes all values", async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      renderWithProviders(
        <ColumnFilterDropdown {...makeProps({ onApply })} />
      );

      await user.click(screen.getByRole("button", { name: /clear/i }));
      await user.click(screen.getByRole("button", { name: /ok/i }));

      expect(onApply).toHaveBeenCalledWith({
        condition: { op: "none", operand: "" },
        excluded: DISTINCT_VALUES,
      });
    });

    it("Displaying count updates after toggling a value", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ColumnFilterDropdown {...makeProps()} />);

      expect(screen.getByText("Displaying 4")).toBeInTheDocument();
      await user.click(screen.getByLabelText("apple"));
      expect(screen.getByText("Displaying 3")).toBeInTheDocument();
    });
  });

  // ── Search / filter values box ─────────────────────────────────────────────

  describe("search box filtering", () => {
    it("filters visible values as user types", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ColumnFilterDropdown {...makeProps()} />);

      const searchBox = screen.getByPlaceholderText("Search values…");
      await user.type(searchBox, "an");

      // "banana" contains "an"; apple and cherry should be gone
      expect(screen.queryByLabelText("apple")).toBeNull();
      expect(screen.getByLabelText("banana")).toBeInTheDocument();
      expect(screen.queryByLabelText("cherry")).toBeNull();
    });

    it("search is case-insensitive", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ColumnFilterDropdown {...makeProps()} />);

      await user.type(screen.getByPlaceholderText("Search values…"), "APPLE");
      expect(screen.getByLabelText("apple")).toBeInTheDocument();
    });

    it("shows 'No values' when search matches nothing", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ColumnFilterDropdown {...makeProps()} />);

      await user.type(screen.getByPlaceholderText("Search values…"), "zzz-no-match");
      expect(screen.getByText("No values")).toBeInTheDocument();
    });

    it("'(Blanks)' item is visible when search matches blank label", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ColumnFilterDropdown {...makeProps()} />);

      await user.type(screen.getByPlaceholderText("Search values…"), "Blanks");
      expect(screen.getByLabelText("(Blanks)")).toBeInTheDocument();
    });
  });

  // ── Empty distinctValues ──────────────────────────────────────────────────

  describe("empty distinctValues", () => {
    it("shows 'No values' when distinctValues is empty", () => {
      renderWithProviders(
        <ColumnFilterDropdown {...makeProps({ distinctValues: [] })} />
      );
      expect(screen.getByText("No values")).toBeInTheDocument();
    });

    it("shows 'Displaying 0' when all values are excluded", () => {
      renderWithProviders(
        <ColumnFilterDropdown
          {...makeProps({
            distinctValues: ["a", "b"],
            value: { condition: { op: "none", operand: "" }, excluded: ["a", "b"] },
          })}
        />
      );
      expect(screen.getByText("Displaying 0")).toBeInTheDocument();
    });
  });

  // ── Apply button (onApply callback) ───────────────────────────────────────

  describe("apply / confirm", () => {
    it("calls onApply with correct ColumnFilter on OK click", async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      const onOpenChange = vi.fn();
      renderWithProviders(
        <ColumnFilterDropdown
          {...makeProps({
            onApply,
            onOpenChange,
            value: { condition: { op: "none", operand: "" }, excluded: [] },
          })}
        />
      );

      await user.click(screen.getByRole("button", { name: /ok/i }));

      expect(onApply).toHaveBeenCalledOnce();
      expect(onApply).toHaveBeenCalledWith({
        condition: { op: "none", operand: "" },
        excluded: [],
      });
      // Also closes the popover
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("calls onApply with condition op and operand when a non-operand-less op is chosen", async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();

      // Start with "contains" op
      renderWithProviders(
        <ColumnFilterDropdown
          {...makeProps({
            onApply,
            value: { condition: { op: "contains", operand: "" }, excluded: [] },
          })}
        />
      );

      const operandInput = screen.getByPlaceholderText("Value");
      await user.type(operandInput, "app");

      await user.click(screen.getByRole("button", { name: /ok/i }));

      expect(onApply).toHaveBeenCalledWith({
        condition: { op: "contains", operand: "app" },
        excluded: [],
      });
    });

    it("calls onApply with both condition and excluded", async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();

      renderWithProviders(
        <ColumnFilterDropdown
          {...makeProps({
            onApply,
            value: { condition: { op: "contains", operand: "a" }, excluded: ["cherry"] },
          })}
        />
      );

      await user.click(screen.getByRole("button", { name: /ok/i }));

      expect(onApply).toHaveBeenCalledWith({
        condition: { op: "contains", operand: "a" },
        excluded: ["cherry"],
      });
    });
  });

  // ── Cancel button ─────────────────────────────────────────────────────────

  describe("cancel", () => {
    it("calls onOpenChange(false) on Cancel click without calling onApply", async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      const onOpenChange = vi.fn();

      renderWithProviders(
        <ColumnFilterDropdown {...makeProps({ onApply, onOpenChange })} />
      );

      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onApply).not.toHaveBeenCalled();
    });
  });

  // ── Staged state resets on reopen ─────────────────────────────────────────

  describe("staged state resets when reopened", () => {
    it("resets search field to empty when popover is reopened", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ControlledDropdown />);

      // Type in search
      const searchBox = screen.getByPlaceholderText("Search values…");
      await user.type(searchBox, "ap");
      expect((searchBox as HTMLInputElement).value).toBe("ap");

      // Close via Cancel
      await user.click(screen.getByRole("button", { name: /cancel/i }));

      // Reopen via trigger button
      await user.click(screen.getByRole("button", { name: /open filter/i }));

      expect((screen.getByPlaceholderText("Search values…") as HTMLInputElement).value).toBe("");
    });

    it("resets excluded values to committed value when reopened", async () => {
      const user = userEvent.setup();
      // Committed filter has no excluded values
      renderWithProviders(
        <ControlledDropdown
          initialFilter={{ condition: { op: "none", operand: "" }, excluded: [] }}
        />
      );

      // Uncheck apple in staged state
      await user.click(screen.getByLabelText("apple"));
      expect(screen.getByText("Displaying 3")).toBeInTheDocument();

      // Cancel (discard staged)
      await user.click(screen.getByRole("button", { name: /cancel/i }));

      // Reopen
      await user.click(screen.getByRole("button", { name: /open filter/i }));

      // Should be back to Displaying 4 (reset from committed value)
      expect(screen.getByText("Displaying 4")).toBeInTheDocument();
    });
  });

  // ── Blank value rendering ─────────────────────────────────────────────────

  describe("blank value rendering", () => {
    it("renders '' as '(Blanks)' in the checklist", () => {
      renderWithProviders(
        <ColumnFilterDropdown
          {...makeProps({ distinctValues: ["", "foo"] })}
        />
      );
      expect(screen.getByLabelText("(Blanks)")).toBeInTheDocument();
    });

    it("renders blank value with italic/muted style via label text", () => {
      renderWithProviders(
        <ColumnFilterDropdown
          {...makeProps({ distinctValues: [""] })}
        />
      );
      const blanksLabel = screen.getByText("(Blanks)");
      expect(blanksLabel).toBeInTheDocument();
    });
  });

  // ── All condition options available ───────────────────────────────────────

  describe("condition options", () => {
    const CONDITIONS = [
      "None",
      "Is empty",
      "Is not empty",
      "Text contains",
      "Text does not contain",
      "Text starts with",
      "Text ends with",
      "Text is exactly",
      "Greater than",
      "Greater than or equal to",
      "Less than",
      "Less than or equal to",
      "Is equal to",
      "Is not equal to",
    ];

    it("shows all condition options in the select dropdown", async () => {
      const user = userEvent.setup();
      renderWithProviders(<ColumnFilterDropdown {...makeProps()} />);

      await user.click(screen.getByRole("combobox"));

      for (const label of CONDITIONS) {
        const matches = screen.getAllByText(label);
        expect(matches.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  // ── operand input typing ──────────────────────────────────────────────────

  describe("operand input typing", () => {
    it("updates operand value as user types", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ColumnFilterDropdown
          {...makeProps({ value: { condition: { op: "isExactly", operand: "" }, excluded: [] } })}
        />
      );

      const input = screen.getByPlaceholderText("Value") as HTMLInputElement;
      await user.type(input, "hello");
      expect(input.value).toBe("hello");
    });

    it("uses fireEvent.change to set operand value", () => {
      renderWithProviders(
        <ColumnFilterDropdown
          {...makeProps({ value: { condition: { op: "neq", operand: "" }, excluded: [] } })}
        />
      );

      const input = screen.getByPlaceholderText("Value") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "test-value" } });
      expect(input.value).toBe("test-value");
    });
  });
});
