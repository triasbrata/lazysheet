import { writeFilesURIs } from "tauri-plugin-clipboard-api";
import { startDrag } from "@crabnebula/tauri-plugin-drag";

// Drag preview icon embedded as a base64 data URL. The drag plugin accepts a
// `data:image/png;base64,...` icon directly, so we avoid resolveResource() —
// which fails in `tauri dev` with "unknown path" (the Resource base dir is not
// resolvable in dev). This works identically in dev and production, all OSes.
const DRAG_ICON =
  "data:image/png;base64,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";

export function pathToFileUri(path: string): string {
  let normalized = path.replace(/\\/g, "/");
  if (!normalized.startsWith("/")) {
    normalized = "/" + normalized;
  }
  return "file://" + encodeURI(normalized);
}

export async function copyFilePath(path: string): Promise<void> {
  await navigator.clipboard.writeText(path);
}

export async function copyFileToClipboard(path: string): Promise<void> {
  const uri = pathToFileUri(path);
  await writeFilesURIs([uri]);
}

export async function dragOutFile(path: string): Promise<void> {
  await startDrag({ item: [path], icon: DRAG_ICON });
}
