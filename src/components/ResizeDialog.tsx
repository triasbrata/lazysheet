import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { columnLetter } from "@/components/Grid/grid-utils";

// Pixel range mirrors the drag-resize clamp so manual entry and drag share
// the same valid space.
export const RESIZE_DIALOG_MIN = 16;
export const RESIZE_DIALOG_MAX = 2000;
const COL_DEFAULT = 59;
const ROW_DEFAULT = 20;

export type SizeDialogState =
  | { kind: "col"; index: number; current: number }
  | { kind: "row"; index: number; current: number }
  | null;

interface ResizeDialogProps {
  state: SizeDialogState;
  onConfirm: (value: number) => void;
  onReset: () => void;
  onCancel: () => void;
}

export function ResizeDialog({
  state,
  onConfirm,
  onReset,
  onCancel,
}: ResizeDialogProps) {
  const open = state !== null;
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state) return;
    setValue(String(Math.round(state.current)));
    // queueMicrotask defers focus until after Radix has mounted the input —
    // matches CommandPalette's pattern.
    queueMicrotask(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [state]);

  const submit = () => {
    if (!state) return;
    const trimmed = value.trim();
    if (trimmed === "") {
      toast.error("Enter a value in pixels");
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      toast.error("Value must be a number");
      return;
    }
    const rounded = Math.round(n);
    if (rounded < RESIZE_DIALOG_MIN || rounded > RESIZE_DIALOG_MAX) {
      toast.error(
        `Value must be between ${RESIZE_DIALOG_MIN} and ${RESIZE_DIALOG_MAX} px`,
      );
      return;
    }
    onConfirm(rounded);
  };

  const title =
    state?.kind === "col"
      ? `Column ${columnLetter(state.index)} width`
      : state
        ? `Row ${state.index + 1} height`
        : "";

  const defaultPx = state?.kind === "col" ? COL_DEFAULT : ROW_DEFAULT;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Enter size in pixels ({RESIZE_DIALOG_MIN}–{RESIZE_DIALOG_MAX}).
            Default is {defaultPx}px.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            min={RESIZE_DIALOG_MIN}
            max={RESIZE_DIALOG_MAX}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span className="text-xs text-muted-foreground">px</span>
        </div>

        <DialogFooter>
          <Button variant="destructive" onClick={onReset}>
            Reset to default
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={submit}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
