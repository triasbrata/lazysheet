import { FolderOpen, X, ChevronDown } from "lucide-react";
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

interface TitleBarProps {
  fileName: string | null;
  recents: RecentFile[];
  onOpen: (path: string) => void;
  onPick: () => void;
  onClose?: () => void;
}

export function TitleBar({
  fileName,
  recents,
  onOpen,
  onPick,
  onClose,
}: TitleBarProps) {
  return (
    <div
      data-tauri-drag-region
      className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-card/50 px-2 pl-20 backdrop-blur-sm"
    >
      <div
        data-tauri-drag-region
        className="flex flex-1 items-center gap-2 text-sm min-w-0"
      >
        <span
          data-tauri-drag-region
          className="truncate font-medium text-foreground/90"
        >
          {fileName ?? "LazySheet"}
        </span>
      </div>

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
