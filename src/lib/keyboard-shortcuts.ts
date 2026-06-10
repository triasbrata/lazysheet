export function shouldCloseSheet(e: KeyboardEvent, hasWorkbook: boolean): boolean {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return false;
  if (e.key.toLowerCase() !== "w") return false;
  if (e.shiftKey) return false;
  return hasWorkbook;
}

export function shouldOpenFile(e: KeyboardEvent): boolean {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return false;
  if (e.key.toLowerCase() !== "o") return false;
  if (e.shiftKey) return false;
  return true;
}

export function shouldOpenSettings(e: KeyboardEvent): boolean {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return false;
  if (e.key !== ",") return false;
  if (e.shiftKey) return false;
  return true;
}

export function shouldZoomIn(e: KeyboardEvent): boolean {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return false;
  if (e.key !== "=" && e.key !== "+") return false;
  return true;
}

export function shouldZoomOut(e: KeyboardEvent): boolean {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return false;
  if (e.key !== "-") return false;
  return true;
}

export function shouldZoomReset(e: KeyboardEvent): boolean {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return false;
  if (e.key !== "0") return false;
  return true;
}

export function shouldUndo(e: KeyboardEvent): boolean {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return false;
  if (e.key.toLowerCase() !== "z") return false;
  if (e.shiftKey) return false;
  return true;
}

export function shouldRedo(e: KeyboardEvent): boolean {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return false;
  const k = e.key.toLowerCase();
  if (k === "z" && e.shiftKey) return true;
  if (k === "y" && !e.shiftKey) return true;
  return false;
}
