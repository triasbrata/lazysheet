import { X, Search, FileSpreadsheet, Files, ClipboardCopy, PanelRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Marquee } from "@/components/Marquee";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getPlatform } from "@/lib/platform";
import { WindowControls } from "@/components/WindowControls";
import { cn } from "@/lib/utils";

interface TitleBarProps {
  fileName: string | null;
  onOpenCommand: () => void;
  onClose?: () => void;
  filePath?: string | null;
  onCopyFile?: () => void;
  onCopyFilePath?: () => void;
  onDragOut?: () => void;
  dirty?: boolean;
  onToggleWorkspace?: () => void;
  disableRunningText?: boolean;
}

export function TitleBar({
  fileName,
  onOpenCommand,
  onClose,
  filePath,
  onCopyFile,
  onCopyFilePath,
  onDragOut,
  dirty,
  onToggleWorkspace,
  disableRunningText,
}: TitleBarProps) {
  const { t } = useTranslation();
  const platform = getPlatform();
  const cmdShortcut = platform === "macos" ? "⌘P" : "Ctrl P";
  return (
    <div
      data-tauri-drag-region
      data-testid="titlebar"
      className={cn(
        "relative flex h-10 shrink-0 items-center gap-2 border-b border-border bg-card/50 px-3 backdrop-blur-sm",
        platform === "macos" ? "pl-20" : "pl-3",
      )}
    >
      <div
        data-tauri-drag-region
        className="flex min-w-0 flex-1 items-center gap-1.5 text-sm"
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

        <Marquee
          text={fileName ?? t("common.appName")}
          data-testid="titlebar-filename"
          data-tauri-drag-region
          className="min-w-0 select-none font-medium text-foreground/90"
          disabled={disableRunningText}
        />

        {dirty && (
          <span
            data-testid="titlebar-dirty"
            className="pointer-events-none select-none shrink-0 text-muted-foreground"
            title={t("titlebar.unsavedChanges")}
          >
            •
          </span>
        )}

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

      <div data-tauri-drag-region className="flex min-w-0 shrink justify-center">
        <button
          type="button"
          onClick={onOpenCommand}
          title={t("titlebar.openCommandCenter", { shortcut: cmdShortcut })}
          className="flex w-80 min-w-0 max-w-[40vw] items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 truncate text-left">{t("titlebar.searchCommands")}</span>
          <kbd className="pointer-events-none hidden shrink-0 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
            {cmdShortcut}
          </kbd>
        </button>
      </div>

      <div data-tauri-drag-region className="flex min-w-0 flex-1 items-center justify-end gap-0.5">
        {onToggleWorkspace && (
          <Button
            onClick={onToggleWorkspace}
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={t("workspace.toggle")}
            data-testid="titlebar-workspace-toggle"
          >
            <PanelRight className="h-3.5 w-3.5" />
          </Button>
        )}
        {fileName && onClose && (
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={t("titlebar.closeFile")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {platform !== "macos" && (
        <div className="-mr-3 flex self-stretch">
          <WindowControls platform={platform} />
        </div>
      )}
    </div>
  );
}
