import * as React from "react";
import { ChevronDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select…",
  className,
}: MultiSelectProps): React.JSX.Element {
  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  function removeChip(value: string, e: React.MouseEvent) {
    e.stopPropagation();
    onChange(selected.filter((v) => v !== value));
  }

  const selectedOptions = options.filter((o) => selected.includes(o.value));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-slot="multi-select-trigger"
          data-testid="multi-select-trigger"
          className={cn(
            "w-full justify-between h-auto min-h-8 py-1.5 px-2 font-normal",
            className,
          )}
        >
          <span className="flex flex-wrap gap-1 items-center">
            {selectedOptions.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selectedOptions.map((opt) => (
                <span
                  key={opt.value}
                  className="inline-flex items-center gap-0.5 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-foreground"
                >
                  {opt.label}
                  <span
                    role="button"
                    aria-label={`Remove ${opt.label}`}
                    tabIndex={0}
                    onClick={(e) => removeChip(opt.value, e)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        onChange(selected.filter((v) => v !== opt.value));
                      }
                    }}
                    className="ml-0.5 cursor-pointer rounded-sm opacity-60 hover:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <X className="size-3" />
                  </span>
                </span>
              ))
            )}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-1"
        align="start"
      >
        <div className="max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <p className="py-2 px-2 text-sm text-muted-foreground">
              No options
            </p>
          ) : (
            options.map((opt) => {
              const isChecked = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  data-testid={`multi-select-option-${opt.value}`}
                  aria-selected={isChecked}
                  onClick={() => toggle(opt.value)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none cursor-pointer",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:bg-accent focus-visible:text-accent-foreground",
                    isChecked && "bg-accent/50",
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    aria-hidden
                    tabIndex={-1}
                    className="pointer-events-none"
                  />
                  <span>{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
