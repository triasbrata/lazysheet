import { useCallback, useState } from "react";
import {
  loadSheet as loadSheetApi,
  openWorkbook as openWorkbookApi,
} from "@/lib/tauri-api";
import type { SheetModel, WorkbookModel } from "@/lib/types";

const RECENT_KEY = "lazysheet:recent";
const RECENT_MAX = 8;

export interface RecentFile {
  path: string;
  fileName: string;
  openedAt: number;
}

function loadRecents(): RecentFile[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function pushRecent(path: string, fileName: string) {
  const list = loadRecents().filter((r) => r.path !== path);
  list.unshift({ path, fileName, openedAt: Date.now() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
}

export function useWorkbook() {
  const [workbook, setWorkbook] = useState<WorkbookModel | null>(null);
  const [activeSheet, setActiveSheet] = useState<SheetModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const wb = await openWorkbookApi(path);
      setWorkbook(wb);
      setActiveSheet(wb.active_sheet);
      pushRecent(wb.path, wb.file_name);
      return wb;
    } catch (e) {
      const msg = typeof e === "string" ? e : (e as Error).message ?? String(e);
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const switchSheet = useCallback(
    async (name: string) => {
      if (!workbook) return;
      if (activeSheet?.name === name) return;
      setLoading(true);
      setError(null);
      try {
        const sheet = await loadSheetApi(name);
        setActiveSheet(sheet);
      } catch (e) {
        const msg =
          typeof e === "string" ? e : (e as Error).message ?? String(e);
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [workbook, activeSheet],
  );

  // Re-read the currently-active sheet from disk. Used after a write-back save
  // so the in-memory rows reflect what was just persisted (switchSheet no-ops on
  // the same sheet, so it can't be reused for this).
  const reloadActiveSheet = useCallback(async () => {
    if (!workbook || !activeSheet) return;
    setError(null);
    try {
      const sheet = await loadSheetApi(activeSheet.name);
      setActiveSheet(sheet);
    } catch (e) {
      const msg = typeof e === "string" ? e : (e as Error).message ?? String(e);
      setError(msg);
    }
  }, [workbook, activeSheet]);

  const close = useCallback(() => {
    setWorkbook(null);
    setActiveSheet(null);
    setError(null);
  }, []);

  return {
    workbook,
    activeSheet,
    loading,
    error,
    open,
    switchSheet,
    reloadActiveSheet,
    close,
    recents: loadRecents,
  };
}
