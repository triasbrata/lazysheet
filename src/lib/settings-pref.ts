import { readJson, writeJson } from "@/lib/app-storage";

export interface AppSettings {
  askBeforeClose: boolean;
}

export const SETTINGS_FILE = "settings.json";

export const DEFAULT_SETTINGS: AppSettings = { askBeforeClose: false };

export function isAppSettings(v: unknown): v is AppSettings {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>).askBeforeClose === "boolean"
  );
}

export async function readStoredSettings(): Promise<AppSettings> {
  const p = await readJson<unknown>(SETTINGS_FILE, null);
  return { ...DEFAULT_SETTINGS, ...(isAppSettings(p) ? p : {}) };
}

export async function writeStoredSettings(s: AppSettings): Promise<void> {
  await writeJson(SETTINGS_FILE, s);
}
