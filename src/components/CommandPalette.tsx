import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ClipboardCopy, Crosshair, FileSpreadsheet, Files, FolderOpen, Sigma } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { RecentFile } from "@/hooks/useWorkbook";

export type PaletteMode = "root" | "goto";

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
}

interface Section {
  title: string;
  items: CommandItem[];
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
  hasFile: boolean;
  recents: RecentFile[];
  onOpenRecent: (path: string) => void;
  onPickFile?: () => void;
  currentPath?: string | null;
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
  hasFile,
  recents,
  onOpenRecent,
  onPickFile,
  currentPath,
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

  const sections = useMemo<Section[]>(() => {
    const visibleRecents = recents.filter((r) => r.path !== currentPath);

    const fileItems: CommandItem[] = [];
    if (onPickFile) {
      fileItems.push({
        id: "open-file",
        label: "Open file…",
        hint: "Browse (.xlsx, .csv…)",
        icon: FolderOpen,
        run: () => {
          onOpenChange(false);
          onPickFile();
        },
      });
    }
    for (const r of visibleRecents) {
      fileItems.push({
        id: "recent:" + r.path,
        label: r.fileName,
        subtitle: r.path,
        icon: FileSpreadsheet,
        run: () => {
          onOpenChange(false);
          onOpenRecent(r.path);
        },
      });
    }

    if (!hasFile) {
      return [{ title: "Recent Files", items: fileItems }];
    }

    const cmdItems: CommandItem[] = [
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
    ];

    return [
      { title: "Commands", items: cmdItems },
      { title: "Recent Files", items: fileItems },
    ];
  }, [
    hasFile,
    recents,
    currentPath,
    onOpenRecent,
    onPickFile,
    onModeChange,
    onOpenChange,
    onOpenSummary,
    onCopyFile,
    onCopyFilePath,
  ]);

  const filteredSections = useMemo<Section[]>(() => {
    if (mode !== "root") return [];
    const q = query.trim().toLowerCase();
    return sections
      .map((s) => ({
        ...s,
        items: q
          ? s.items.filter(
              (c) =>
                c.label.toLowerCase().includes(q) ||
                c.hint?.toLowerCase().includes(q) ||
                c.subtitle?.toLowerCase().includes(q),
            )
          : s.items,
      }))
      .filter((s) => s.items.length > 0);
  }, [sections, query, mode]);

  const flatItems = useMemo(
    () => filteredSections.flatMap((s) => s.items),
    [filteredSections],
  );

  useEffect(() => {
    setActiveIdx(0);
  }, [query, mode]);

  const submit = () => {
    if (mode === "root") {
      const cmd = flatItems[activeIdx];
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
        setActiveIdx((i) => Math.min(i + 1, flatItems.length - 1));
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
      ? (!hasFile ? "Search recent files…" : "Type a command…")
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
          <div className="max-h-72 overflow-y-auto px-2 py-1">
            {flatItems.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground">
                {!hasFile ? "No recent files." : "No commands match."}
              </div>
            ) : (
              (() => {
                let idx = 0;
                return filteredSections.map((section) => (
                  <div key={section.title}>
                    <div className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {section.title}
                    </div>
                    {section.items.map((c) => {
                      const globalIdx = idx++;
                      const Icon = c.icon;
                      return (
                        <button
                          key={c.id}
                          onMouseEnter={() => setActiveIdx(globalIdx)}
                          onClick={() => c.run()}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm",
                            globalIdx === activeIdx
                              ? "bg-muted text-foreground"
                              : "text-foreground/90",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate">{c.label}</span>
                            {c.subtitle && (
                              <span
                                className="truncate text-[11px] text-muted-foreground"
                                title={c.subtitle}
                              >
                                {c.subtitle}
                              </span>
                            )}
                          </span>
                          {c.hint && (
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {c.hint}
                            </span>
                          )}
                          <ArrowRight className="h-3 w-3 shrink-0 opacity-40" />
                        </button>
                      );
                    })}
                  </div>
                ));
              })()
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
