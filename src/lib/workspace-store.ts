import { readJson, writeJson } from "@/lib/app-storage";

export interface WorkspaceFile {
  path: string;
  fileName: string;
  addedAt: number;
}

export interface Workspace {
  id: string;
  name: string;
  files: WorkspaceFile[];
  createdAt: number;
  collapsed: boolean;
}

export const WORKSPACES_FILE = "workspaces.json";

export function isWorkspaceArray(v: unknown): v is Workspace[] {
  if (!Array.isArray(v)) return false;
  return v.every(
    (item) =>
      typeof (item as Workspace).id === "string" &&
      typeof (item as Workspace).name === "string" &&
      Array.isArray((item as Workspace).files) &&
      typeof (item as Workspace).createdAt === "number" &&
      typeof (item as Workspace).collapsed === "boolean" &&
      (item as Workspace).files.every(
        (f) =>
          typeof f.path === "string" &&
          typeof f.fileName === "string" &&
          typeof f.addedAt === "number"
      )
  );
}

export async function readWorkspaces(): Promise<Workspace[]> {
  const data = await readJson(WORKSPACES_FILE, [] as unknown);
  return isWorkspaceArray(data) ? data : [];
}

export async function writeWorkspaces(list: Workspace[]): Promise<void> {
  await writeJson(WORKSPACES_FILE, list);
}

export function newWorkspace(name: string): Workspace {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    files: [],
    createdAt: Date.now(),
    collapsed: false,
  };
}

export function addWorkspace(list: Workspace[], name: string): Workspace[] {
  return [...list, newWorkspace(name)];
}

export function renameWorkspace(
  list: Workspace[],
  id: string,
  name: string
): Workspace[] {
  return list.map((w) => (w.id === id ? { ...w, name: name.trim() } : w));
}

export function deleteWorkspace(list: Workspace[], id: string): Workspace[] {
  return list.filter((w) => w.id !== id);
}

export function addFileToWorkspace(
  list: Workspace[],
  id: string,
  file: { path: string; fileName: string }
): Workspace[] {
  return list.map((w) => {
    if (w.id !== id) return w;
    if (w.files.some((f) => f.path === file.path)) return w;
    return {
      ...w,
      files: [
        ...w.files,
        { path: file.path, fileName: file.fileName, addedAt: Date.now() },
      ],
    };
  });
}

export function removeFileFromWorkspace(
  list: Workspace[],
  id: string,
  path: string
): Workspace[] {
  return list.map((w) =>
    w.id === id ? { ...w, files: w.files.filter((f) => f.path !== path) } : w
  );
}

export function toggleCollapsed(list: Workspace[], id: string): Workspace[] {
  return list.map((w) =>
    w.id === id ? { ...w, collapsed: !w.collapsed } : w
  );
}

export function isFileInAnyWorkspace(
  list: Workspace[],
  path: string
): boolean {
  return list.some((w) => w.files.some((f) => f.path === path));
}
