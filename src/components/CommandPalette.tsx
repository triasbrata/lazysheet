import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ClipboardCopy, Crosshair, Files, Sigma } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type PaletteMode = "root" | "goto";

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  mode: PaletteMode;
  onOpenChange: (open: boolean) => void;
  onModeChange: (mode: PaletteMode) => void;
  onGoto: (cellRef: string) => string | null;
  onOpenSummary?: () => void;
  onCopyFile?: () => void;
  onCopyFilePath?: () => void;
}

export function CommandPalette({
  open,
  mode,
  onOpenChange,
  onModeChange,
  onGoto,
  onOpenSummary,
  onCopyFile,
  onCopyFilePath,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setError(null);
      setActiveIdx(0);
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open, mode]);

  const commands = useMemo<CommandItem[]>(
    () => [
      {
        id: "goto",
        label: "Goto",
        hint: "Jump to cell (e.g. A1, B12)",
        icon: Crosshair,
        run: () => onModeChange("goto"),
      },
      ...(onOpenSummary
        ? [
            {
              id: "summarize",
              label: "Summarize selection",
              hint: "Group-by (⌘⇧Y)",
              icon: Sigma,
              run: () => {
                onOpenChange(false);
                onOpenSummary();
              },
            },
          ]
        : []),
      ...(onCopyFile
        ? [
            {
              id: "copy-file",
              label: "Copy file",
              hint: "Copy .xlsx to clipboard",
              icon: Files,
              run: () => {
                onOpenChange(false);
                onCopyFile!();
              },
            },
          ]
        : []),
      ...(onCopyFilePath
        ? [
            {
              id: "copy-file-path",
              label: "Copy file path",
              hint: "Copy path as text",
              icon: ClipboardCopy,
              run: () => {
                onOpenChange(false);
                onCopyFilePath!();
              },
            },
          ]
        : []),
    ],
    [onModeChange, onOpenChange, onOpenSummary, onCopyFile, onCopyFilePath],
  );

  const filtered = useMemo(() => {
    if (mode !== "root") return commands;
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.hint?.toLowerCase().includes(q),
    );
  }, [commands, query, mode]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query, mode]);

  const submit = () => {
    if (mode === "root") {
      const cmd = filtered[activeIdx];
      if (cmd) cmd.run();
      return;
    }
    if (mode === "goto") {
      const err = onGoto(query);
      if (err) {
        setError(err);
        return;
      }
      onOpenChange(false);
      return;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (mode !== "root") {
        onModeChange("root");
        return;
      }
      onOpenChange(false);
      return;
    }
    if (mode === "root") {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const placeholder =
    mode === "root"
      ? "Type a command…"
      : "Cell reference (e.g. A1, B12, AB45)";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md p-0 gap-0 overflow-hidden sm:max-w-md"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          {mode !== "root" && (
            <button
              onClick={() => onModeChange("root")}
              className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide bg-muted text-muted-foreground hover:bg-muted/70"
            >
              {mode}
            </button>
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {error && (
          <div className="border-b border-border bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
            {error}
          </div>
        )}

        {mode === "root" && (
          <div className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground">
                No commands match.
              </div>
            ) : (
              filtered.map((c, i) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => c.run()}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                      i === activeIdx
                        ? "bg-muted text-foreground"
                        : "text-foreground/90",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1">{c.label}</span>
                    {c.hint && (
                      <span className="text-[11px] text-muted-foreground">
                        {c.hint}
                      </span>
                    )}
                    <ArrowRight className="h-3 w-3 opacity-40" />
                  </button>
                );
              })
            )}
          </div>
        )}

        {mode === "goto" && (
          <div className="px-3 py-2 text-[11px] text-muted-foreground">
            Press Enter to jump. Esc to back.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
