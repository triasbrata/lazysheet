import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Workspace } from "@/lib/workspace-store";
import {
  readWorkspaces,
  writeWorkspaces,
  newWorkspace,
  renameWorkspace,
  deleteWorkspace,
  addFileToWorkspace,
  removeFileFromWorkspace,
  toggleCollapsed,
  isFileInAnyWorkspace,
} from "@/lib/workspace-store";

export interface UseWorkspacesApi {
  workspaces: Workspace[];
  create: (name: string) => string;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  addFile: (id: string, file: { path: string; fileName: string }) => void;
  removeFile: (id: string, path: string) => void;
  toggleCollapse: (id: string) => void;
  isInAnyWorkspace: (path: string) => boolean;
}

export function useWorkspaces(): UseWorkspacesApi {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  // Keep a ref so persist always has access to the latest state via functional update
  const workspacesRef = useRef(workspaces);
  useEffect(() => {
    workspacesRef.current = workspaces;
  }, [workspaces]);

  // Hydrate on mount
  useEffect(() => {
    let alive = true;
    readWorkspaces().then((w) => {
      if (alive) setWorkspaces(w);
    });
    return () => {
      alive = false;
    };
  }, []);

  const persist = useCallback((updater: (prev: Workspace[]) => Workspace[]) => {
    setWorkspaces((prev) => {
      const next = updater(prev);
      void writeWorkspaces(next);
      return next;
    });
  }, []);

  const create = useCallback(
    (name: string): string => {
      const ws = newWorkspace(name);
      persist((prev) => [...prev, ws]);
      return ws.id;
    },
    [persist],
  );

  const rename = useCallback(
    (id: string, name: string) => {
      persist((prev) => renameWorkspace(prev, id, name));
    },
    [persist],
  );

  const remove = useCallback(
    (id: string) => {
      persist((prev) => deleteWorkspace(prev, id));
    },
    [persist],
  );

  const addFile = useCallback(
    (id: string, file: { path: string; fileName: string }) => {
      persist((prev) => addFileToWorkspace(prev, id, file));
    },
    [persist],
  );

  const removeFile = useCallback(
    (id: string, path: string) => {
      persist((prev) => removeFileFromWorkspace(prev, id, path));
    },
    [persist],
  );

  const toggleCollapse = useCallback(
    (id: string) => {
      persist((prev) => toggleCollapsed(prev, id));
    },
    [persist],
  );

  const isInAnyWorkspace = useCallback(
    (path: string) => isFileInAnyWorkspace(workspaces, path),
    [workspaces],
  );

  return useMemo(
    () => ({
      workspaces,
      create,
      rename,
      remove,
      addFile,
      removeFile,
      toggleCollapse,
      isInAnyWorkspace,
    }),
    [
      workspaces,
      create,
      rename,
      remove,
      addFile,
      removeFile,
      toggleCollapse,
      isInAnyWorkspace,
    ],
  );
}
