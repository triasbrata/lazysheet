import React, { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ColumnFilter, ConditionOp } from "@/lib/grid-filter";

// ─── Condition option list ────────────────────────────────────────────────────

const CONDITION_OPTIONS: { op: ConditionOp; label: string }[] = [
  { op: "none",        label: "None" },
  { op: "empty",       label: "Is empty" },
  { op: "notEmpty",    label: "Is not empty" },
  { op: "contains",    label: "Text contains" },
  { op: "notContains", label: "Text does not contain" },
  { op: "startsWith",  label: "Text starts with" },
  { op: "endsWith",    label: "Text ends with" },
  { op: "isExactly",   label: "Text is exactly" },
  { op: "gt",          label: "Greater than" },
  { op: "gte",         label: "Greater than or equal to" },
  { op: "lt",          label: "Less than" },
  { op: "lte",         label: "Less than or equal to" },
  { op: "eq",          label: "Is equal to" },
  { op: "neq",         label: "Is not equal to" },
];

/** Ops that do NOT need a text operand input. */
const NO_OPERAND_OPS = new Set<ConditionOp>(["none", "empty", "notEmpty"]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function valueLabel(v: string): string {
  return v === "" ? "(Blanks)" : v;
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ColumnFilterDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Header text for the column (currently unused in the panel, available for callers). */
  columnLabel: string;
  /** All distinct values for this column; "" = Blanks, sorted blanks-first by caller. */
  distinctValues: string[];
  /** The committed (applied) filter for this column. */
  value: ColumnFilter;
  /** Called on OK with the staged (new) filter. */
  onApply: (next: ColumnFilter) => void;
  /** The trigger element rendered by the caller. */
  children: React.ReactNode;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ColumnFilterDropdown({
  open,
  onOpenChange,
  distinctValues,
  value,
  onApply,
  children,
}: ColumnFilterDropdownProps): React.JSX.Element {
  // ── Staged state ─────────────────────────────────────────────────────────
  const [op, setOp] = useState<ConditionOp>(value.condition.op);
  const [operand, setOperand] = useState<string>(value.condition.operand);
  const [excluded, setExcluded] = useState<string[]>(value.excluded);
  const [search, setSearch] = useState<string>("");

  // Reset staged state from the committed value every time the popover opens.
  useEffect(() => {
    if (open) {
      setOp(value.condition.op);
      setOperand(value.condition.operand);
      setExcluded(value.excluded);
      setSearch("");
    }
  }, [open, value]);

  // ── Derived values ───────────────────────────────────────────────────────
  const excludedSet = new Set(excluded);
  const checkedCount = distinctValues.length - excluded.length;

  const visibleValues = distinctValues.filter((v) =>
    valueLabel(v).toLowerCase().includes(search.toLowerCase())
  );

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleToggle(v: string) {
    if (excludedSet.has(v)) {
      // was unchecked → check it (remove from excluded)
      setExcluded((prev) => prev.filter((x) => x !== v));
    } else {
      // was checked → uncheck it (add to excluded)
      setExcluded((prev) => [...prev, v]);
    }
  }

  function handleSelectAll() {
    setExcluded([]);
  }

  function handleClear() {
    setExcluded([...distinctValues]);
  }

  function handleOk() {
    onApply({ condition: { op, operand }, excluded });
    onOpenChange(false);
  }

  function handleCancel() {
    onOpenChange(false);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        data-testid="filter-panel"
        className="w-72 p-0"
        align="start"
        sideOffset={4}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col text-sm">

          {/* ── Filter by condition ──────────────────────────────────────── */}
          <div className="px-3 pt-3 pb-2 flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Filter by condition
            </span>

            {/* Condition selector */}
            <Select value={op} onValueChange={(v) => setOp(v as ConditionOp)}>
              <SelectTrigger className="w-full" data-testid="filter-condition-trigger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="item-aligned">
                {CONDITION_OPTIONS.map(({ op: o, label }) => (
                  <SelectItem key={o} value={o} data-testid={`filter-condition-${o}`}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Operand input — visible only for ops that need one */}
            {!NO_OPERAND_OPS.has(op) && (
              <input
                data-testid="filter-operand-input"
                type="text"
                value={operand}
                onChange={(e) => setOperand(e.target.value)}
                placeholder="Value"
                className={cn(
                  "w-full rounded-md border border-input bg-background px-2 py-1 text-sm",
                  "text-foreground placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                )}
              />
            )}
          </div>

          {/* ── Separator ───────────────────────────────────────────────── */}
          <div className="border-t border-border" />

          {/* ── Filter by values ─────────────────────────────────────────── */}
          <div className="px-3 pt-2 pb-2 flex flex-col gap-2">
            {/* Top row: Select all / Clear  |  Displaying N */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-primary hover:underline focus:outline-none"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-primary hover:underline focus:outline-none"
                >
                  Clear
                </button>
              </div>
              <span className="text-xs text-muted-foreground">
                Displaying {checkedCount}
              </span>
            </div>

            {/* Search box */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search values…"
                className={cn(
                  "w-full rounded-md border border-input bg-background pl-7 pr-2 py-1 text-sm",
                  "text-foreground placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                )}
              />
            </div>

            {/* Scrollable value checklist */}
            <div className="max-h-[220px] overflow-y-auto flex flex-col gap-0.5 pr-0.5">
              {visibleValues.length === 0 ? (
                <span className="text-xs text-muted-foreground py-1 text-center">
                  No values
                </span>
              ) : (
                visibleValues.map((v) => {
                  const checked = !excludedSet.has(v);
                  const id = `cf-val-${v === "" ? "__blank__" : v}`;
                  return (
                    <label
                      key={v}
                      htmlFor={id}
                      className={cn(
                        "flex items-center gap-2 rounded px-1 py-0.5 cursor-pointer select-none",
                        "hover:bg-accent"
                      )}
                    >
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={() => handleToggle(v)}
                      />
                      <span
                        className={cn(
                          "truncate",
                          v === "" ? "text-muted-foreground italic" : "text-foreground"
                        )}
                      >
                        {valueLabel(v)}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Separator ───────────────────────────────────────────────── */}
          <div className="border-t border-border" />

          {/* ── OK / Cancel ──────────────────────────────────────────────── */}
          <div className="px-3 py-2 flex items-center justify-end gap-2">
            <Button
              data-testid="filter-cancel-btn"
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              data-testid="filter-ok-btn"
              type="button"
              size="sm"
              onClick={handleOk}
            >
              OK
            </Button>
          </div>

        </div>
      </PopoverContent>
    </Popover>
  );
}
