export function shouldCloseSheet(e: KeyboardEvent, hasWorkbook: boolean): boolean {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return false;
  if (e.key.toLowerCase() !== "w") return false;
  if (e.shiftKey) return false;
  return hasWorkbook;
}
