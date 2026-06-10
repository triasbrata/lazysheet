import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Workspace } from "@/lib/workspace-store";

export type AddToWorkspaceState = { path: string; fileName: string } | null;

export interface AddToWorkspaceDialogProps {
  state: AddToWorkspaceState;
  workspaces: Workspace[];
  onConfirm: (workspaceId: string) => void;
  onCreateAndAdd: (name: string) => void;
  onSkip: () => void;
}

export function AddToWorkspaceDialog({
  state,
  workspaces,
  onConfirm,
  onCreateAndAdd,
  onSkip,
}: AddToWorkspaceDialogProps) {
  const { t } = useTranslation();
  const open = state !== null;

  const [mode, setMode] = useState<"existing" | "create">(
    workspaces.length === 0 ? "create" : "existing",
  );
  const [selectedId, setSelectedId] = useState<string>(
    workspaces.length > 0 ? workspaces[0].id : "",
  );
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (workspaces.length === 0) {
      setMode("create");
      setSelectedId("");
    } else {
      setMode("existing");
      setSelectedId(workspaces[0].id);
    }
    setNewName("");
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = () => {
    if (mode === "existing") {
      if (!selectedId) return;
      onConfirm(selectedId);
    } else {
      const trimmed = newName.trim();
      if (!trimmed) return;
      onCreateAndAdd(trimmed);
    }
  };

  const addDisabled =
    mode === "existing" ? !selectedId : newName.trim() === "";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onSkip(); }}>
      <DialogContent data-testid="add-to-workspace-dialog">
        <DialogHeader>
          <DialogTitle>{t("addToWs.title")}</DialogTitle>
          <DialogDescription>
            {t("addToWs.desc", { fileName: state?.fileName ?? "" })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {mode === "existing" && workspaces.length > 0 ? (
            <>
              <select
                data-testid="workspace-select"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                onClick={() => setMode("create")}
                className="self-start px-0 text-sm"
              >
                {t("addToWs.createNew")}
              </Button>
            </>
          ) : (
            <input
              data-testid="new-workspace-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("addToWs.createNew")}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onSkip}>
            {t("addToWs.skip")}
          </Button>
          <Button onClick={handleAdd} disabled={addDisabled}>
            {t("addToWs.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
