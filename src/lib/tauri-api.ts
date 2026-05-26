import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { SheetModel, WorkbookModel } from "@/lib/types";

export const SUPPORTED_EXTS = ["xlsx", "xlsm", "xls", "csv", "tsv"] as const;

export async function openWorkbook(path: string): Promise<WorkbookModel> {
  return invoke<WorkbookModel>("open_workbook", { path });
}

export async function loadSheet(sheetName: string): Promise<SheetModel> {
  return invoke<SheetModel>("load_sheet", { sheetName });
}

export async function takePendingFiles(): Promise<string[]> {
  return invoke<string[]>("take_pending_files");
}

export async function onFilesOpened(
  cb: (paths: string[]) => void,
): Promise<UnlistenFn> {
  return listen<string[]>("files-opened", (e) => cb(e.payload));
}

export async function onWebviewDragDrop(
  cb: (paths: string[]) => void,
): Promise<UnlistenFn> {
  return getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === "drop") {
      cb(event.payload.paths);
    }
  });
}

export async function pickFile(): Promise<string | null> {
  const result = await openDialog({
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Spreadsheets",
        extensions: [...SUPPORTED_EXTS],
      },
    ],
  });
  if (typeof result === "string") return result;
  return null;
}

export function isSupportedFile(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return (SUPPORTED_EXTS as readonly string[]).includes(ext);
}

export async function openExternal(url: string): Promise<void> {
  await openUrl(url);
}
