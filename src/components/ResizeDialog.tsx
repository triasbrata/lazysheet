import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      toast.error(t("resize.enterValue"));
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      toast.error(t("resize.mustBeNumber"));
      return;
    }
    const rounded = Math.round(n);
    if (rounded < RESIZE_DIALOG_MIN || rounded > RESIZE_DIALOG_MAX) {
      toast.error(
        t("resize.outOfRange", { min: RESIZE_DIALOG_MIN, max: RESIZE_DIALOG_MAX }),
      );
      return;
    }
    onConfirm(rounded);
  };

  const title =
    state?.kind === "col"
      ? t("resize.colTitle", { letter: columnLetter(state.index) })
      : state
        ? t("resize.rowTitle", { row: state.index + 1 })
        : "";

  const defaultPx = state?.kind === "col" ? COL_DEFAULT : ROW_DEFAULT;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm" data-testid="resize-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {t("resize.description", { min: RESIZE_DIALOG_MIN, max: RESIZE_DIALOG_MAX, default: defaultPx })}
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
            data-testid="resize-input"
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
            {t("resize.resetDefault")}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} data-testid="resize-ok-btn">{t("common.ok")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
