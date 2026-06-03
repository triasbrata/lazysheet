import { X, Search, FileSpreadsheet, Files, ClipboardCopy } from "lucide-react";
import { useTranslation } from "react-i18next";
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
import { LanguageToggle } from "@/components/LanguageToggle";

const isMac =
  typeof navigator !== "undefined" &&
  /mac/i.test(navigator.platform || navigator.userAgent);
const cmdShortcut = isMac ? "⌘P" : "Ctrl P";

interface TitleBarProps {
  fileName: string | null;
  onOpenCommand: () => void;
  onClose?: () => void;
  filePath?: string | null;
  onCopyFile?: () => void;
  onCopyFilePath?: () => void;
  onDragOut?: () => void;
}

export function TitleBar({
  fileName,
  onOpenCommand,
  onClose,
  filePath,
  onCopyFile,
  onCopyFilePath,
  onDragOut,
}: TitleBarProps) {
  const { t } = useTranslation();
  return (
    <div
      data-tauri-drag-region
      className="relative flex h-10 shrink-0 items-center gap-2 border-b border-border bg-card/50 px-3 pl-20 backdrop-blur-sm"
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
            title={t("titlebar.dragFileOut")}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-grab"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
          </button>
        )}

        <span
          data-tauri-drag-region
          className="truncate font-medium text-foreground/90"
        >
          {fileName ?? t("common.appName")}
        </span>

        {filePath && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title={t("titlebar.fileActions")}>
                <Files className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel className="text-xs">{t("titlebar.fileActionsLabel")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onCopyFile} className="gap-2">
                <Files className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm">{t("titlebar.copyFile")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCopyFilePath} className="gap-2">
                <ClipboardCopy className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm">{t("titlebar.copyFilePath")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenCommand}
        title={t("titlebar.openCommandCenter", { shortcut: cmdShortcut })}
        className="absolute left-1/2 top-1/2 flex w-full max-w-xs -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 truncate text-left">{t("titlebar.searchCommands")}</span>
        <kbd className="pointer-events-none hidden shrink-0 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
          {cmdShortcut}
        </kbd>
      </button>

      <div className="flex shrink-0 items-center gap-0.5">
        <LanguageToggle />
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
