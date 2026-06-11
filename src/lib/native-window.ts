import { invoke } from "@tauri-apps/api/core";

/** Parse a CSS rgb()/rgba() string into integer channels. Returns null if not parseable. */
export function parseRgb(s: string): { r: number; g: number; b: number } | null {
  const m = s.match(/rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/);
  if (!m) return null;
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
}

function isTauri(): boolean {
  return typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

/**
 * Push the resolved theme background color to the native window so the macOS
 * resize gap renders as theme bg instead of white. No-op outside Tauri.
 */
export function syncNativeBackground(): void {
  if (!isTauri()) return;
  // Read synchronously — getComputedStyle forces a style flush so the freshly
  // applied theme class is reflected. (No rAF: it is throttled when the window
  // isn't frontmost, which made the color push unreliable.)
  const root = getComputedStyle(document.documentElement).backgroundColor;
  const bg =
    root && root !== "rgba(0, 0, 0, 0)"
      ? root
      : getComputedStyle(document.body).backgroundColor;
  const c = parseRgb(bg);
  if (!c) return;
  invoke("set_native_background", { r: c.r, g: c.g, b: c.b }).catch(() => {});
}
