import { platform } from "@tauri-apps/plugin-os";

export type OsPlatform = "macos" | "windows" | "linux";

export function getPlatform(): OsPlatform {
  try {
    const p = platform();
    if (p === "macos" || p === "windows" || p === "linux") {
      return p;
    }
    // other Tauri platforms (ios/android) fall through to navigator fallback
  } catch {
    // not running in Tauri (unit tests, web preview) — use navigator heuristic
  }

  const ua = (typeof navigator !== "undefined"
    ? navigator.platform || navigator.userAgent
    : "") as string;

  if (/mac/i.test(ua)) return "macos";
  if (/win/i.test(ua)) return "windows";
  return "linux";
}
