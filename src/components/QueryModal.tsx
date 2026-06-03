import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useAnimationControls } from "motion/react";
import { XIcon } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import type { QueryKind, SqlDialect, SqlColumn, SqlProgress } from "@/lib/sql-copy";
import { sanitizeTableName } from "@/lib/sql-pref";

export interface QueryModalState {
  kind: QueryKind;
  columns: SqlColumn[];        // labels guaranteed non-empty & unique (validated upstream)
  tableName: string;           // prefilled
  dialect: SqlDialect;         // prefilled
  keyDupCheck: (keyCols: number[]) => boolean;
  initialKeyCols?: number[];   // prefill key multi-select (remembered last keys)
  keyWarning?: string;         // shown under the key picker (e.g. remembered keys out of range)
  // internal snapshot used by the parent on confirm; carry it through opaquely:
  _snapshot: unknown;
}

export interface QueryConfirm {
  tableName: string;
  dialect: SqlDialect;
  keyCols: number[];
}

interface QueryModalProps {
  state: QueryModalState | null;
  progress: SqlProgress | null;   // non-null while async generation runs → show progress view
  onConfirm: (c: QueryConfirm) => void;
  onCancel: () => void;           // closes + aborts in-flight generation
}

export function QueryModal(props: QueryModalProps): React.JSX.Element {
  const { state, progress, onConfirm, onCancel } = props;

  const open = state !== null;

  const [tableName, setTableName] = useState("");
  const [dialect, setDialect] = useState<SqlDialect>("mysql");
  const [keyVals, setKeyVals] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Backdrop-click guard: first outside click shakes the dialog instead of
  // closing; a second outside click within the arm window actually closes.
  // Shake is a motion animation on the inner box so the dialog's centering
  // transform (on DialogContent) is never touched — no position jump.
  const shakeControls = useAnimationControls();
  const armedToCloseRef = useRef(false);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!state) return;
    // Reset backdrop-close arming each time the modal opens.
    armedToCloseRef.current = false;
    if (armTimerRef.current) clearTimeout(armTimerRef.current);
    setTableName(state.tableName);
    // If upsert + ansi → coerce to mysql (ansi upsert unsupported)
    const resolvedDialect =
      state.kind === "upsert" && state.dialect === "ansi"
        ? "mysql"
        : state.dialect;
    setDialect(resolvedDialect);
    // Prefill remembered keys, but only those still present in the current columns.
    const valid = new Set(state.columns.map((c) => c.index));
    setKeyVals(
      (state.initialKeyCols ?? [])
        .filter((c) => valid.has(c))
        .map(String),
    );
    queueMicrotask(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [state]);

  const generating = progress !== null;

  const needsKey = state?.kind === "update" || state?.kind === "upsert";

  const nonKeyCount = state ? state.columns.length - keyVals.length : 0;

  const keyDup = useMemo(
    () =>
      keyVals.length > 0 && state
        ? state.keyDupCheck(keyVals.map(Number))
        : false,
    [keyVals, state],
  );

  const submit = () => {
    if (!state) return;

    const t = tableName.trim();
    if (t === "") {
      toast.error("Enter a table name");
      return;
    }
    if (
      sanitizeTableName(t) === "" ||
      t.split(".").some((seg) => seg.trim() === "")
    ) {
      toast.error("Invalid table name");
      return;
    }

    if (needsKey && keyVals.length === 0) {
      toast.error("Pick at least one key field");
      return;
    }
    if (needsKey && nonKeyCount === 0) {
      toast.error("Need at least one non-key column");
      return;
    }

    onConfirm({ tableName: t, dialect, keyCols: keyVals.map(Number) });
  };

  const title = state ? `Copy as ${state.kind.toUpperCase()}` : "";

  const pct =
    progress && progress.total
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  // First outside interaction shakes; second (within 2s) closes.
  const handleInteractOutside = (e: Event) => {
    if (!armedToCloseRef.current) {
      e.preventDefault();
      void shakeControls.start({
        x: [0, -8, 8, -6, 6, -3, 3, 0],
        transition: { duration: 0.4, ease: "easeInOut" },
      });
      armedToCloseRef.current = true;
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
      armTimerRef.current = setTimeout(() => {
        armedToCloseRef.current = false;
      }, 2000);
    }
    // else: armed → let Radix close (onOpenChange → onCancel)
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent
        className="sm:max-w-md border-0 bg-transparent p-0 shadow-none ring-0"
        showCloseButton={false}
        onInteractOutside={handleInteractOutside}
        onEscapeKeyDown={(e) => {
          // Keep Escape as an explicit, immediate close.
          e.preventDefault();
          onCancel();
        }}
      >
        <motion.div
          animate={shakeControls}
          className="relative grid gap-4 rounded-xl bg-popover p-4 text-popover-foreground ring-1 ring-foreground/10"
        >
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-70 transition-opacity hover:bg-accent hover:opacity-100"
          aria-label="Close"
        >
          <XIcon className="size-4" />
        </button>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {!generating && (
            <DialogDescription>
              Configure options for the SQL query.
            </DialogDescription>
          )}
        </DialogHeader>

        {generating ? (
          <>
            <div className="flex flex-col gap-3 py-2">
              <p className="text-sm text-muted-foreground">
                Generating&hellip; {progress!.done}/{progress!.total} rows ({pct}%)
              </p>
              <div className="h-2 w-full rounded bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-150"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <DialogFooter className="flex-row justify-end [&>*]:w-auto">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {/* Table name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Table name</label>
                <input
                  ref={inputRef}
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
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
                  required
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {/* Dialect */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">SQL dialect</label>
                <Select
                  value={dialect}
                  onValueChange={(v) => setDialect(v as SqlDialect)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mysql">MySQL</SelectItem>
                    <SelectItem value="postgres">PostgreSQL</SelectItem>
                    <SelectItem value="sqlite">SQLite</SelectItem>
                    <SelectItem
                      value="ansi"
                      disabled={state?.kind === "upsert"}
                      title={
                        state?.kind === "upsert"
                          ? "ANSI SQL does not support upsert"
                          : undefined
                      }
                    >
                      ANSI SQL
                      {state?.kind === "upsert" && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (unsupported for upsert)
                        </span>
                      )}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Key columns (update / upsert only) */}
              {needsKey && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Key field(s)</label>
                  <MultiSelect
                    options={
                      state
                        ? state.columns.map((c) => ({
                            value: String(c.index),
                            label: c.name,
                          }))
                        : []
                    }
                    selected={keyVals}
                    onChange={setKeyVals}
                    placeholder="Select key field(s)…"
                  />
                  {state?.keyWarning && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {state.keyWarning}
                    </p>
                  )}
                  {keyDup && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Selected key has duplicate values in selection — may affect
                      multiple rows.
                    </p>
                  )}
                  {nonKeyCount === 0 && keyVals.length > 0 && (
                    <p className="text-xs text-destructive">
                      Need at least one non-key column.
                    </p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="flex-row justify-end [&>*]:w-auto">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={generating || (needsKey && nonKeyCount === 0)}
              >
                Copy
              </Button>
            </DialogFooter>
          </>
        )}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
