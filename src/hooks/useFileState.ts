import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SheetModel } from "@/lib/types";
import { sheetFingerprint } from "@/components/Grid/grid-utils";

const STORAGE_KEY = "lazysheet:file-state";
const MAX_FILES = 32;
const ANCHOR_DEBOUNCE_MS = 250;

export interface PersistedAnchor {
  row: number;
  col: number;
}

export interface DimensionOverrides {
  fp: string;
  values: Record<number, number>;
}

export interface PersistedSheetState {
  anchor?: PersistedAnchor;
  headerRow?: number;
  col_widths?: DimensionOverrides;
  row_heights?: DimensionOverrides;
}

export interface PersistedFileState {
  lastActiveSheet?: string;
  sheets: Record<string, PersistedSheetState>;
  updatedAt: number;
  // Per-file grid zoom factor; 1 = 100%. Absent means default (1).
  zoom?: number;
}

type Store = Record<string, PersistedFileState>;

export interface UseFileStateApi {
  state: PersistedFileState | null;
  headerRows: Record<string, number>;
  getAnchor: (sheetName: string) => PersistedAnchor | null;
  getLastActiveSheet: () => string | null;
  setHeader: (sheetName: string, row: number | null) => void;
  setAnchor: (sheetName: string, anchor: PersistedAnchor) => void;
  setActiveSheet: (sheetName: string) => void;

  getColOverrides: (
    sheetName: string,
    sheet: SheetModel,
  ) => Record<number, number> | undefined;
  getRowOverrides: (
    sheetName: string,
    sheet: SheetModel,
  ) => Record<number, number> | undefined;

  setColWidth: (
    sheetName: string,
    sheet: SheetModel,
    col: number,
    width: number,
  ) => void;
  setRowHeight: (
    sheetName: string,
    sheet: SheetModel,
    row: number,
    height: number,
  ) => void;

  resetColWidth: (sheetName: string, col: number) => void;
  resetRowHeight: (sheetName: string, row: number) => void;
  resetAllDimensions: (sheetName: string) => void;

  getZoom: () => number;
  setZoom: (zoom: number) => void;

  detectStaleOverrides: (
    sheetName: string,
    sheet: SheetModel,
  ) => { hasStaleCols: boolean; hasStaleRows: boolean };
  reapplyStaleOverrides: (sheetName: string, sheet: SheetModel) => void;
  discardStaleOverrides: (sheetName: string, sheet: SheetModel) => void;
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Store;
  } catch {
    return {};
  }
}

function saveStore(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota or disabled storage — ignore silently.
  }
}

function evictLRU(store: Store): Store {
  const keys = Object.keys(store);
  if (keys.length <= MAX_FILES) return store;
  const sorted = keys
    .map((k) => ({ k, t: store[k].updatedAt ?? 0 }))
    .sort((a, b) => a.t - b.t);
  const drop = sorted.slice(0, keys.length - MAX_FILES);
  const next: Store = { ...store };
  for (const { k } of drop) delete next[k];
  return next;
}

function ensureEntry(store: Store, path: string): PersistedFileState {
  const existing = store[path];
  if (existing) {
    return {
      lastActiveSheet: existing.lastActiveSheet,
      sheets: { ...(existing.sheets ?? {}) },
      updatedAt: existing.updatedAt ?? 0,
      zoom: existing.zoom,
    };
  }
  return { sheets: {}, updatedAt: 0 };
}

function sheetIsEmpty(sheet: PersistedSheetState): boolean {
  return (
    sheet.anchor === undefined &&
    sheet.headerRow === undefined &&
    sheet.col_widths === undefined &&
    sheet.row_heights === undefined
  );
}

export function useFileState(path: string | null): UseFileStateApi {
  const [store, setStore] = useState<Store>(() => loadStore());
  const debounceRef = useRef<number | null>(null);
  const pendingAnchorRef = useRef<{ sheet: string; anchor: PersistedAnchor } | null>(null);

  // Functional commit — receives prev store, returns next. Required so
  // multiple synchronous calls within a single tick (e.g. multi-row autofit)
  // each see the updated store from the previous call, instead of all
  // capturing the same stale closure value and overwriting each other.
  const commit = useCallback((updater: (prev: Store) => Store) => {
    setStore((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      const evicted = evictLRU(next);
      saveStore(evicted);
      return evicted;
    });
  }, []);

  const state = useMemo<PersistedFileState | null>(() => {
    if (!path) return null;
    return store[path] ?? null;
  }, [store, path]);

  const headerRows = useMemo<Record<string, number>>(() => {
    if (!state) return {};
    const out: Record<string, number> = {};
    for (const [sheet, s] of Object.entries(state.sheets)) {
      if (typeof s.headerRow === "number") out[sheet] = s.headerRow;
    }
    return out;
  }, [state]);

  const getAnchor = useCallback(
    (sheetName: string): PersistedAnchor | null => {
      if (!path) return null;
      const entry = store[path];
      const a = entry?.sheets?.[sheetName]?.anchor;
      return a ? { row: a.row, col: a.col } : null;
    },
    [store, path],
  );

  const getLastActiveSheet = useCallback((): string | null => {
    if (!path) return null;
    return store[path]?.lastActiveSheet ?? null;
  }, [store, path]);

  const setHeader = useCallback(
    (sheetName: string, row: number | null) => {
      if (!path) return;
      commit((prev) => {
        const next: Store = { ...prev };
        const entry = ensureEntry(next, path);
        const sheet = { ...(entry.sheets[sheetName] ?? {}) };
        if (row === null) {
          delete sheet.headerRow;
        } else {
          sheet.headerRow = row;
        }
        if (sheetIsEmpty(sheet)) {
          delete entry.sheets[sheetName];
        } else {
          entry.sheets[sheetName] = sheet;
        }
        entry.updatedAt = Date.now();
        next[path] = entry;
        return next;
      });
    },
    [path, commit],
  );

  const flushAnchor = useCallback(() => {
    debounceRef.current = null;
    const pending = pendingAnchorRef.current;
    pendingAnchorRef.current = null;
    if (!pending || !path) return;
    commit((prev) => {
      const next: Store = { ...prev };
      const entry = ensureEntry(next, path);
      const sheet = { ...(entry.sheets[pending.sheet] ?? {}) };
      sheet.anchor = pending.anchor;
      entry.sheets[pending.sheet] = sheet;
      entry.updatedAt = Date.now();
      next[path] = entry;
      return next;
    });
  }, [path, commit]);

  const setAnchor = useCallback(
    (sheetName: string, anchor: PersistedAnchor) => {
      if (!path) return;
      pendingAnchorRef.current = { sheet: sheetName, anchor };
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(flushAnchor, ANCHOR_DEBOUNCE_MS);
    },
    [path, flushAnchor],
  );

  const setActiveSheet = useCallback(
    (sheetName: string) => {
      if (!path) return;
      commit((prev) => {
        const next: Store = { ...prev };
        const entry = ensureEntry(next, path);
        if (entry.lastActiveSheet === sheetName) return prev;
        entry.lastActiveSheet = sheetName;
        entry.updatedAt = Date.now();
        next[path] = entry;
        return next;
      });
    },
    [path, commit],
  );

  const getColOverrides = useCallback(
    (sheetName: string, sheet: SheetModel): Record<number, number> | undefined => {
      if (!path) return undefined;
      const block = store[path]?.sheets?.[sheetName]?.col_widths;
      if (!block) return undefined;
      if (block.fp !== sheetFingerprint(sheet)) return undefined;
      return block.values;
    },
    [store, path],
  );

  const getRowOverrides = useCallback(
    (sheetName: string, sheet: SheetModel): Record<number, number> | undefined => {
      if (!path) return undefined;
      const block = store[path]?.sheets?.[sheetName]?.row_heights;
      if (!block) return undefined;
      if (block.fp !== sheetFingerprint(sheet)) return undefined;
      return block.values;
    },
    [store, path],
  );

  const setColWidth = useCallback(
    (sheetName: string, sheet: SheetModel, col: number, width: number) => {
      if (!path) return;
      const fp = sheetFingerprint(sheet);
      commit((prev) => {
        const next: Store = { ...prev };
        const entry = ensureEntry(next, path);
        const ss = { ...(entry.sheets[sheetName] ?? {}) };
        const prevBlock = ss.col_widths;
        const baseValues =
          prevBlock && prevBlock.fp === fp ? { ...prevBlock.values } : {};
        baseValues[col] = width;
        ss.col_widths = { fp, values: baseValues };
        entry.sheets[sheetName] = ss;
        entry.updatedAt = Date.now();
        next[path] = entry;
        return next;
      });
    },
    [path, commit],
  );

  const setRowHeight = useCallback(
    (sheetName: string, sheet: SheetModel, row: number, height: number) => {
      if (!path) return;
      const fp = sheetFingerprint(sheet);
      commit((prev) => {
        const next: Store = { ...prev };
        const entry = ensureEntry(next, path);
        const ss = { ...(entry.sheets[sheetName] ?? {}) };
        const prevBlock = ss.row_heights;
        const baseValues =
          prevBlock && prevBlock.fp === fp ? { ...prevBlock.values } : {};
        baseValues[row] = height;
        ss.row_heights = { fp, values: baseValues };
        entry.sheets[sheetName] = ss;
        entry.updatedAt = Date.now();
        next[path] = entry;
        return next;
      });
    },
    [path, commit],
  );

  const resetColWidth = useCallback(
    (sheetName: string, col: number) => {
      if (!path) return;
      commit((prev) => {
        const block = prev[path]?.sheets?.[sheetName]?.col_widths;
        if (!block || block.values[col] === undefined) return prev;
        const next: Store = { ...prev };
        const entry = ensureEntry(next, path);
        const ss = { ...(entry.sheets[sheetName] ?? {}) };
        const nextValues = { ...block.values };
        delete nextValues[col];
        if (Object.keys(nextValues).length === 0) {
          delete ss.col_widths;
        } else {
          ss.col_widths = { fp: block.fp, values: nextValues };
        }
        if (sheetIsEmpty(ss)) {
          delete entry.sheets[sheetName];
        } else {
          entry.sheets[sheetName] = ss;
        }
        entry.updatedAt = Date.now();
        next[path] = entry;
        return next;
      });
    },
    [path, commit],
  );

  const resetRowHeight = useCallback(
    (sheetName: string, row: number) => {
      if (!path) return;
      commit((prev) => {
        const block = prev[path]?.sheets?.[sheetName]?.row_heights;
        if (!block || block.values[row] === undefined) return prev;
        const next: Store = { ...prev };
        const entry = ensureEntry(next, path);
        const ss = { ...(entry.sheets[sheetName] ?? {}) };
        const nextValues = { ...block.values };
        delete nextValues[row];
        if (Object.keys(nextValues).length === 0) {
          delete ss.row_heights;
        } else {
          ss.row_heights = { fp: block.fp, values: nextValues };
        }
        if (sheetIsEmpty(ss)) {
          delete entry.sheets[sheetName];
        } else {
          entry.sheets[sheetName] = ss;
        }
        entry.updatedAt = Date.now();
        next[path] = entry;
        return next;
      });
    },
    [path, commit],
  );

  const resetAllDimensions = useCallback(
    (sheetName: string) => {
      if (!path) return;
      commit((prev) => {
        const ss0 = prev[path]?.sheets?.[sheetName];
        if (!ss0 || (!ss0.col_widths && !ss0.row_heights)) return prev;
        const next: Store = { ...prev };
        const entry = ensureEntry(next, path);
        const ss = { ...(entry.sheets[sheetName] ?? {}) };
        delete ss.col_widths;
        delete ss.row_heights;
        if (sheetIsEmpty(ss)) {
          delete entry.sheets[sheetName];
        } else {
          entry.sheets[sheetName] = ss;
        }
        entry.updatedAt = Date.now();
        next[path] = entry;
        return next;
      });
    },
    [path, commit],
  );

  const detectStaleOverrides = useCallback(
    (sheetName: string, sheet: SheetModel) => {
      if (!path) return { hasStaleCols: false, hasStaleRows: false };
      const ss = store[path]?.sheets?.[sheetName];
      if (!ss) return { hasStaleCols: false, hasStaleRows: false };
      const fp = sheetFingerprint(sheet);
      return {
        hasStaleCols: !!ss.col_widths && ss.col_widths.fp !== fp,
        hasStaleRows: !!ss.row_heights && ss.row_heights.fp !== fp,
      };
    },
    [store, path],
  );

  const reapplyStaleOverrides = useCallback(
    (sheetName: string, sheet: SheetModel) => {
      if (!path) return;
      const fp = sheetFingerprint(sheet);
      commit((prev) => {
        const ss0 = prev[path]?.sheets?.[sheetName];
        if (!ss0) return prev;
        let changed = false;
        const next: Store = { ...prev };
        const entry = ensureEntry(next, path);
        const ss = { ...(entry.sheets[sheetName] ?? {}) };
        if (ss.col_widths && ss.col_widths.fp !== fp) {
          ss.col_widths = { fp, values: ss.col_widths.values };
          changed = true;
        }
        if (ss.row_heights && ss.row_heights.fp !== fp) {
          ss.row_heights = { fp, values: ss.row_heights.values };
          changed = true;
        }
        if (!changed) return prev;
        entry.sheets[sheetName] = ss;
        entry.updatedAt = Date.now();
        next[path] = entry;
        return next;
      });
    },
    [path, commit],
  );

  const discardStaleOverrides = useCallback(
    (sheetName: string, sheet: SheetModel) => {
      if (!path) return;
      const fp = sheetFingerprint(sheet);
      commit((prev) => {
        const ss0 = prev[path]?.sheets?.[sheetName];
        if (!ss0 || (!ss0.col_widths && !ss0.row_heights)) return prev;
        let changed = false;
        const next: Store = { ...prev };
        const entry = ensureEntry(next, path);
        const ss = { ...(entry.sheets[sheetName] ?? {}) };
        if (ss.col_widths && ss.col_widths.fp !== fp) {
          delete ss.col_widths;
          changed = true;
        }
        if (ss.row_heights && ss.row_heights.fp !== fp) {
          delete ss.row_heights;
          changed = true;
        }
        if (!changed) return prev;
        if (sheetIsEmpty(ss)) {
          delete entry.sheets[sheetName];
        } else {
          entry.sheets[sheetName] = ss;
        }
        entry.updatedAt = Date.now();
        next[path] = entry;
        return next;
      });
    },
    [path, commit],
  );

  const getZoom = useCallback((): number => {
    if (!path) return 1;
    return store[path]?.zoom ?? 1;
  }, [store, path]);

  const setZoom = useCallback(
    (zoom: number) => {
      if (!path) return;
      commit((prev) => {
        const next: Store = { ...prev };
        const entry = ensureEntry(next, path);
        if (zoom === 1) {
          delete entry.zoom;
        } else {
          entry.zoom = zoom;
        }
        entry.updatedAt = Date.now();
        next[path] = entry;
        return next;
      });
    },
    [path, commit],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
        // Flush any pending write synchronously on unmount so we don't lose it.
        const pending = pendingAnchorRef.current;
        pendingAnchorRef.current = null;
        if (pending && path) {
          const fresh = loadStore();
          const entry = ensureEntry(fresh, path);
          const sheet = { ...(entry.sheets[pending.sheet] ?? {}) };
          sheet.anchor = pending.anchor;
          entry.sheets[pending.sheet] = sheet;
          entry.updatedAt = Date.now();
          fresh[path] = entry;
          saveStore(evictLRU(fresh));
        }
      }
    };
  }, [path]);

  return {
    state,
    headerRows,
    getAnchor,
    getLastActiveSheet,
    setHeader,
    setAnchor,
    setActiveSheet,
    getColOverrides,
    getRowOverrides,
    setColWidth,
    setRowHeight,
    resetColWidth,
    resetRowHeight,
    resetAllDimensions,
    detectStaleOverrides,
    reapplyStaleOverrides,
    discardStaleOverrides,
    getZoom,
    setZoom,
  };
}
