import { readTextFile, writeTextFile, exists, mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";
import { appDataDir } from "@tauri-apps/api/path";

const OPT = { baseDir: BaseDirectory.AppData };

/**
 * Tauri's writeTextFile does NOT create parent directories, and the app's
 * AppData directory does not exist on first run — so the very first write
 * would fail (silently) and nothing would persist. Ensure it exists first.
 */
async function ensureBaseDir(): Promise<void> {
  const dir = await appDataDir();
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
}

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    if (!(await exists(file, OPT))) return fallback;
    const text = await readTextFile(file, OPT);
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(file: string, data: unknown): Promise<void> {
  try {
    await ensureBaseDir();
    await writeTextFile(file, JSON.stringify(data), OPT);
  } catch {
    /* swallow — non-tauri/web or perm error degrades silently */
  }
}
