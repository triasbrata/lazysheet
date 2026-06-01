import { FolderOpen, X, ChevronDown, Search, FileSpreadsheet, Files, ClipboardCopy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from "@/components/mode-toggle";
import type { RecentFile } from "@/hooks/useWorkbook";

const isMac =
  typeof navigator !== "undefined" &&
  /mac/i.test(navigator.platform || navigator.userAgent);
const cmdShortcut = isMac ? "⌘P" : "Ctrl P";

interface TitleBarProps {
  fileName: string | null;
  recents: RecentFile[];
  onOpen: (path: string) => void;
  onPick: () => void;
  onOpenCommand: () => void;
  onClose?: () => void;
  filePath?: string | null;
  onCopyFile?: () => void;
  onCopyFilePath?: () => void;
  onDragOut?: () => void;
}

export function TitleBar({
  fileName,
  recents,
  onOpen,
  onPick,
  onOpenCommand,
  onClose,
  filePath,
  onCopyFile,
  onCopyFilePath,
  onDragOut,
}: TitleBarProps) {
  return (
    <div
      data-tauri-drag-region
      className="relative flex h-10 shrink-0 items-center gap-2 border-b border-border bg-card/50 px-2 pl-20 backdrop-blur-sm"
    >
      <div
        data-tauri-drag-region
        className="flex flex-1 items-center gap-1.5 text-sm min-w-0"
      >
        {filePath && (
          <button
            type="button"
            draggable
            onDragStart={(e) => {
              e.preventDefault();
              onDragOut?.();
            }}
            title="Drag file out"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-grab"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
          </button>
        )}

        <span
          data-tauri-drag-region
          className="truncate font-medium text-foreground/90"
        >
          {fileName ?? "LazySheet"}
        </span>

        {filePath && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="File actions">
                <Files className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel className="text-xs">File Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onCopyFile} className="gap-2">
                <Files className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm">Copy file</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCopyFilePath} className="gap-2">
                <ClipboardCopy className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm">Copy file path</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenCommand}
        title={`Open command center (${cmdShortcut})`}
        className="absolute left-1/2 top-1/2 flex w-full max-w-xs -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 truncate text-left">Search commands…</span>
        <kbd className="pointer-events-none hidden shrink-0 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
          {cmdShortcut}
        </kbd>
      </button>

      <div className="flex shrink-0 items-center gap-0.5">
        {recents.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                Recent
                <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-xs">
                Recent Files
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {recents.slice(0, 8).map((r) => (
                <DropdownMenuItem
                  key={r.path}
                  onClick={() => onOpen(r.path)}
                  className="flex-col items-start gap-0"
                >
                  <span className="truncate text-sm font-medium">
                    {r.fileName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground w-full">
                    {r.path}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button
          onClick={onPick}
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Open file"
        >
          <FolderOpen className="h-3.5 w-3.5" />
        </Button>

        <ModeToggle />

        {fileName && onClose && (
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Close file"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
