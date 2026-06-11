import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Plus, Check, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Marquee } from "@/components/Marquee";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Workspace } from "@/lib/workspace-store";

export interface WorkspacePanelProps {
  open: boolean;
  workspaces: Workspace[];
  currentFile: { path: string; fileName: string } | null;
  recents: { path: string; fileName: string }[];
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onAddFile: (id: string, file: { path: string; fileName: string }) => void;
  onRemoveFile: (id: string, path: string) => void;
  onOpenFile: (path: string) => void;
  onBrowseAdd: (id: string) => void;
}

export function WorkspacePanel(props: WorkspacePanelProps) {
  const { t } = useTranslation();
  const [draftActive, setDraftActive] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  if (!props.open) return null;

  function startDraft() {
    setDraftActive(true);
    setDraftName("");
  }

  function cancelDraft() {
    setDraftActive(false);
    setDraftName("");
  }

  function commitDraft() {
    const n = draftName.trim();
    if (n) {
      props.onCreate(n);
    }
    cancelDraft();
  }

  function handleDraftKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelDraft();
    }
  }

  function startRename(id: string, currentName: string) {
    setEditingId(id);
    setEditingName(currentName);
  }

  function commitRename(id: string) {
    const n = editingName.trim();
    if (n) {
      props.onRename(id, n);
    }
    setEditingId(null);
    setEditingName("");
  }

  function handleRenameKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    id: string,
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename(id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditingId(null);
      setEditingName("");
    }
  }

  const pendingDeleteName =
    props.workspaces.find((w) => w.id === pendingDeleteId)?.name ?? "";

  function confirmDelete() {
    if (pendingDeleteId) {
      props.onDelete(pendingDeleteId);
    }
    setPendingDeleteId(null);
  }

  return (
    <div
      data-testid="workspace-panel"
      className="flex h-full w-full flex-col border-l border-border bg-card/30"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-medium">{t("workspace.title")}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t("workspace.addWorkspace")}
          data-testid="add-workspace-button"
          onClick={startDraft}
        >
          <Plus />
        </Button>
      </div>

      {/* Scroll body */}
      <div className="flex-1 overflow-y-auto">
        {/* Draft (inline new-workspace) row */}
        {draftActive && (
          <div
            data-testid="workspace-draft"
            className="flex items-center gap-1 px-2 py-1.5"
          >
            <input
              data-testid="draft-workspace-input"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground border border-border rounded px-2 py-1"
              value={draftName}
              autoFocus
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={handleDraftKeyDown}
              placeholder={t("workspace.newPlaceholder")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t("workspace.confirmCreate")}
              data-testid="draft-confirm-button"
              // keep input focused through the click so onClick fires reliably
              onMouseDown={(e) => e.preventDefault()}
              onClick={commitDraft}
            >
              <Check />
            </Button>
          </div>
        )}

        {props.workspaces.length === 0 && !draftActive ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">
            {t("workspace.empty")}
          </p>
        ) : (
          props.workspaces.map((w) => (
            <div key={w.id} data-testid={`workspace-${w.id}`}>
              {/* Workspace header row */}
              <div className="flex items-center gap-1 px-2 py-1.5 hover:bg-accent/30">
                <button
                  type="button"
                  className="flex flex-1 items-center gap-1 text-left text-sm font-medium truncate"
                  onClick={() => props.onToggleCollapse(w.id)}
                >
                  {w.collapsed ? (
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  {editingId === w.id ? (
                    <input
                      data-testid={`rename-input-${w.id}`}
                      className="flex-1 bg-transparent text-sm outline-none border-b border-border"
                      value={editingName}
                      autoFocus
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => handleRenameKeyDown(e, w.id)}
                      onBlur={() => commitRename(w.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className="truncate"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startRename(w.id, w.name);
                      }}
                    >
                      {w.name}
                    </span>
                  )}
                  <span className="ml-1 shrink-0 text-xs text-muted-foreground">
                    {t("workspace.fileCount", { count: w.files.length })}
                  </span>
                </button>

                {/* Add file dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("workspace.addFile")}
                    >
                      <Plus />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {props.currentFile &&
                      !w.files.some(
                        (f) => f.path === props.currentFile!.path,
                      ) && (
                        <DropdownMenuItem
                          onSelect={() =>
                            props.onAddFile(w.id, props.currentFile!)
                          }
                        >
                          {t("workspace.addCurrent")}
                        </DropdownMenuItem>
                      )}
                    {props.recents
                      .filter((r) => !w.files.some((f) => f.path === r.path))
                      .map((r) => (
                        <DropdownMenuItem
                          key={r.path}
                          onSelect={() => props.onAddFile(w.id, r)}
                        >
                          {r.fileName}
                        </DropdownMenuItem>
                      ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => props.onBrowseAdd(w.id)}>
                      {t("workspace.addBrowse")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Delete workspace (confirm first) */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("workspace.delete")}
                  onClick={() => setPendingDeleteId(w.id)}
                >
                  <Trash2 />
                </Button>
              </div>

              {/* File list (only when not collapsed) */}
              {!w.collapsed &&
                w.files.map((f) => (
                  <div
                    key={f.path}
                    className="flex items-center justify-between px-3 py-1 text-sm hover:bg-accent/40"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 text-left"
                      title={f.path}
                      onClick={() => props.onOpenFile(f.path)}
                    >
                      <Marquee text={f.fileName} className="block w-full" />
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("workspace.removeFile")}
                      onClick={() => props.onRemoveFile(w.id, f.path)}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                ))}
            </div>
          ))
        )}
      </div>

      {/* Delete confirmation modal */}
      <Dialog
        open={pendingDeleteId !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDeleteId(null);
        }}
      >
        <DialogContent data-testid="delete-workspace-dialog">
          <DialogHeader>
            <DialogTitle>{t("workspace.confirmDeleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("workspace.confirmDeleteDesc", { name: pendingDeleteName })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingDeleteId(null)}
            >
              {t("workspace.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              data-testid="confirm-delete-workspace"
              onClick={confirmDelete}
            >
              {t("workspace.confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
