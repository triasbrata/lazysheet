import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { TitleBar } from "@/components/TitleBar";
import { Welcome } from "@/components/Welcome";
import { SheetTabs } from "@/components/SheetTabs";
import { StatusBar } from "@/components/StatusBar";
import { Grid, type GridMatch, type Selection } from "@/components/Grid/Grid";
import {
  CommandPalette,
  type PaletteMode,
} from "@/components/CommandPalette";
import { FindBar } from "@/components/FindBar";
import {
  buildMergeInfo,
  columnLetter,
  effectiveColWidth,
  effectiveRowHeight,
  expandBoundsForMerges,
  parseA1,
  selectionBounds,
} from "@/components/Grid/grid-utils";
import {
  ResizeDialog,
  type SizeDialogState,
} from "@/components/ResizeDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWorkbook } from "@/hooks/useWorkbook";
import { useEditBuffer } from "@/hooks/useEditBuffer";
import { useFileEvents } from "@/hooks/useFileEvents";
import { useFileState } from "@/hooks/useFileState";
import { pickFile, saveEdits } from "@/lib/tauri-api";
import { readText } from "tauri-plugin-clipboard-api";
import { cellText, coerceInput, isWritableFormat } from "@/lib/types";
import { flags } from "@/lib/feature-flags";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  copyFilePath,
  copyFileToClipboard,
  dragOutFile,
} from "@/lib/file-actions";
import {
  buildSelectionMarkdown,
  type CopyFormat,
} from "@/lib/markdown-export";
import {
  DEFAULT_COPY_FORMAT_KEY,
  readStoredDefaultCopyFormat,
} from "@/lib/copy-format-pref";
import {
  buildMergedRowSet,
  headerGroups,
  hasActiveFilters,
  computeVisibleRows,
  type SheetFilters,
  type ColumnFilter,
} from "@/lib/grid-filter";
import { SummaryPanel } from "@/components/SummaryPanel";
import { runUpdateCheck, type UpdateHandle } from "@/lib/updater";
import { renderNodeToPngBlob } from "@/lib/copy-as-image";
import {
  shouldCloseSheet,
  shouldOpenFile,
  shouldZoomIn,
  shouldZoomOut,
  shouldZoomReset,
} from "@/lib/keyboard-shortcuts";
import { clampZoom, stepZoom } from "@/lib/zoom";
import {
  buildSqlQuery,
  generateSqlWithProgress,
  keyHasDuplicates,
  sqlColumns,
  SQL_ASYNC_THRESHOLD,
  type QueryKind,
  type SqlDialect,
  type BuildSqlOptions,
  type SqlProgress,
} from "@/lib/sql-copy";
import {
  readStoredDialect,
  writeStoredDialect,
  readStoredTableName,
  writeStoredTableName,
  readStoredKeyCols,
  writeStoredKeyCols,
  sanitizeTableName,
  stripExt,
} from "@/lib/sql-pref";
import { QueryModal, type QueryModalState, type QueryConfirm } from "@/components/QueryModal";

const COPY_FORMAT_LABELS: Record<CopyFormat, string> = {
  inline: "markdown",
  title: "markdown title",
  table: "markdown table",
  ascii: "ASCII table",
  csv: "CSV",
  tsv: "TSV",
  plain: "plain text",
};

function findNextAfterAnchor(
  matches: GridMatch[],
  anchor: { row: number; col: number },
): number {
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (m.row > anchor.row || (m.row === anchor.row && m.col > anchor.col)) {
      return i;
    }
  }
  return -1;
}

function findPrevBeforeAnchor(
  matches: GridMatch[],
  anchor: { row: number; col: number },
): number {
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    if (m.row < anchor.row || (m.row === anchor.row && m.col < anchor.col)) {
      return i;
    }
  }
  return -1;
}

function App() {
  const wb = useWorkbook();
  const [recents, setRecents] = useState(wb.recents());
  const [dragOver, setDragOver] = useState(false);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<PaletteMode>("root");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findFocusNonce, setFindFocusNonce] = useState(0);
  const [summaryPanelOpen, setSummaryPanelOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const fileState = useFileState(wb.workbook?.path ?? null);
  const headerRows = fileState.headerRows;

  const editBuffer = useEditBuffer();
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const activeSheetName = wb.activeSheet?.name ?? "";
  const editEnabled = flags.inlineEdit && isWritableFormat(wb.workbook?.path);
  const getEditedCell = useCallback(
    (row: number, col: number) => editBuffer.getEdit(activeSheetName, row, col),
    [editBuffer, activeSheetName],
  );

  const [filters, setFilters] = useState<Record<string, SheetFilters>>({});

  const handleEditStart = useCallback(
    (row: number, col: number) => {
      if (editEnabled) setEditingCell({ row, col });
    },
    [editEnabled],
  );

  const handleEditCommit = useCallback(
    (row: number, col: number, raw: string, nav: "down" | "right" | "none") => {
      editBuffer.setEdit(activeSheetName, row, col, coerceInput(raw));
      setEditingCell(null);
      if (nav === "none") return;
      const maxRow = (wb.activeSheet?.rows.length ?? 1) - 1;
      const maxCol = (wb.activeSheet?.max_col ?? 1) - 1;
      let nr = row;
      let nc = col;
      if (nav === "down") nr = Math.min(row + 1, maxRow);
      if (nav === "right") nc = Math.min(col + 1, maxCol);
      setSelection({
        anchor: { row: nr, col: nc },
        focus: { row: nr, col: nc },
        mode: "cell",
        nonce: Date.now(),
      });
    },
    [editBuffer, activeSheetName, wb.activeSheet],
  );

  const handleEditCancel = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editBuffer.isDirty) return;
    try {
      await saveEdits(editBuffer.editsForSave());
      // Re-read from disk so in-memory rows match what was saved, THEN drop the
      // overlay buffer — otherwise display falls back to the stale parsed rows.
      await wb.reloadActiveSheet();
      editBuffer.clearAll();
      toast.success("Saved");
    } catch (e) {
      const msg = typeof e === "string" ? e : (e as Error).message ?? String(e);
      const friendly = msg.includes("unsupported_format")
        ? "This file type can't be saved. Save as .xlsx."
        : msg;
      toast.error(friendly);
    }
  }, [editBuffer, wb]);

  const open = useCallback(
    async (path: string) => {
      editBuffer.clearAll();
      setEditingCell(null);
      try {
        await wb.open(path);
        setRecents(wb.recents());
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error("Failed to open file", { description: msg });
      }
    },
    [wb, editBuffer],
  );

  const handlePick = useCallback(async () => {
    const p = await pickFile();
    if (p) open(p);
  }, [open]);

  const handleClose = useCallback(() => {
    wb.close();
    setRecents(wb.recents());
    setSelection(null);
    setFindOpen(false);
    setFindQuery("");
    setSummaryPanelOpen(false);
    editBuffer.clearAll();
    setEditingCell(null);
  }, [wb, editBuffer]);

  const handleSelectionChange = useCallback(
    (next: Selection, _scroll: "none" | "ifNeeded" | "center") => {
      setSelection(next);
      const sheetName = wb.activeSheet?.name;
      if (
        sheetName &&
        next.mode === "cell" &&
        next.anchor.row === next.focus.row &&
        next.anchor.col === next.focus.col
      ) {
        fileState.setAnchor(sheetName, {
          row: next.anchor.row,
          col: next.anchor.col,
        });
      }
    },
    [wb.activeSheet?.name, fileState],
  );

  const handleSwitchSheet = useCallback(
    async (name: string) => {
      setSelection(null);
      await wb.switchSheet(name);
      fileState.setActiveSheet(name);
    },
    [wb, fileState],
  );

  // Reset selection when workbook/sheet changes via any path (open, file drop, etc).
  useEffect(() => {
    setSelection(null);
    setSummaryPanelOpen(false);
  }, [wb.activeSheet?.name, wb.workbook?.path]);

  // Restore persisted state on file open. Runs AFTER the clear effect above.
  // Two refs:
  //   - sheetSwitchAttemptedRef: tracks paths where we've already tried to
  //     switch to the persisted last-active sheet. Prevents fighting the user
  //     when they switch sheets manually.
  //   - anchorRestoredRef: tracks (path, sheet) pairs where anchor restore has
  //     already fired. Prevents re-restore on every selection-change re-render.
  const sheetSwitchAttemptedRef = useRef<string | null>(null);
  const anchorRestoredRef = useRef<string | null>(null);
  // Zoom refs: live ref for fresh reads in __E2E__; debounce timer ref for persist.
  const zoomLiveRef = useRef(zoom);
  zoomLiveRef.current = zoom;
  const zoomPersistTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const sheet = wb.activeSheet;
    const path = wb.workbook?.path;
    if (!sheet || !path) {
      sheetSwitchAttemptedRef.current = null;
      anchorRestoredRef.current = null;
      return;
    }

    // Switch to persisted last-active sheet once per file open, only if it
    // differs from the backend's default and still exists in the workbook.
    if (sheetSwitchAttemptedRef.current !== path) {
      sheetSwitchAttemptedRef.current = path;
      const lastSheet = fileState.getLastActiveSheet();
      if (
        lastSheet &&
        lastSheet !== sheet.name &&
        wb.workbook?.sheets.some((s) => s.name === lastSheet)
      ) {
        void wb.switchSheet(lastSheet);
        return; // Effect will re-fire after switch with restored sheet.
      }
    }

    const key = `${path}::${sheet.name}`;
    if (anchorRestoredRef.current === key) return;
    anchorRestoredRef.current = key;

    const anchor = fileState.getAnchor(sheet.name);
    if (!anchor) return;
    if (anchor.row >= sheet.rows.length) return;
    if (anchor.col >= sheet.max_col) return;

    setSelection({
      anchor: { row: anchor.row, col: anchor.col },
      focus: { row: anchor.row, col: anchor.col },
      mode: "cell",
      scroll: "center",
      nonce: Date.now(),
    });
  }, [wb.activeSheet, wb.workbook, wb.switchSheet, fileState]);

  useFileEvents(open);

  // Restore zoom from persistence when file opens or switches; reset stale
  // debounce timer so a previous file's pending write doesn't fire.
  const filePath = wb.workbook?.path ?? null;
  useEffect(() => {
    if (zoomPersistTimerRef.current !== null) {
      window.clearTimeout(zoomPersistTimerRef.current);
      zoomPersistTimerRef.current = null;
    }
    setZoom(filePath ? fileState.getZoom() : 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath]);

  // E2E test hook — only compiled into builds made with VITE_E2E=true (tree-shaken
  // from prod). Lets WebdriverIO open a file via the REAL backend (no native dialog)
  // and read the clipboard for copy assertions. See e2e/ and .rpi/e2e-webdriver/.
  useEffect(() => {
    if (!import.meta.env.VITE_E2E) return;
    window.__E2E__ = {
      open: (path: string) => open(path),
      readClipboard: () => readText(),
      // Drive the updater with a mocked plugin response so specs can assert the
      // toast UX (up-to-date / offer / error) without a real update server or a
      // genuine app relaunch. relaunchFn is a no-op for the same reason.
      runUpdateCheck: (mock) =>
        runUpdateCheck({
          trigger: mock.trigger ?? "manual",
          checkFn: async () => {
            if (mock.fail) throw new Error(mock.fail);
            if (!mock.update) return null;
            return {
              version: mock.update.version,
              currentVersion: "0.0.0",
              downloadAndInstall: async () => {},
            } satisfies UpdateHandle;
          },
          relaunchFn: async () => {},
        }),
      // Dismiss all toasts — lets specs isolate toast assertions without a full
      // page reload (which races sonner's mount/paint on WebKit).
      dismissToasts: () => toast.dismiss(),
      // Render the summary table to a PNG via the REAL render pipeline (the same
      // renderNodeToPngBlob that copyNodeAsImage uses) — bypassing the clipboard
      // write that WebKit's WebDriver rejects. Decodes the PNG and reports size +
      // a non-blank check so the spec can verify the WebKit blank-render
      // workaround actually produced pixels. A hard timeout guarantees the
      // promise always settles (never hangs the e2e runner).
      captureSummaryImage: async () => {
        const node = document.querySelector<HTMLElement>(
          '[data-testid="summary-table-container"]',
        );
        if (!node) return { ok: false, error: "summary container not found" };

        // Mirror handleCopyImage: expand so the full table rasterizes.
        const prevMaxHeight = node.style.maxHeight;
        const prevOverflow = node.style.overflow;
        node.style.maxHeight = "none";
        node.style.overflow = "visible";
        try {
          const analyze = async () => {
            const blob = await renderNodeToPngBlob(node);
            const bmp = await createImageBitmap(blob);
            const canvas = document.createElement("canvas");
            canvas.width = bmp.width;
            canvas.height = bmp.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("no 2d context");
            ctx.drawImage(bmp, 0, 0);
            const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
            // Non-blank = at least one pixel differs from the top-left pixel.
            const r0 = data[0];
            const g0 = data[1];
            const b0 = data[2];
            let nonBlank = false;
            for (let i = 4; i < data.length; i += 4) {
              if (data[i] !== r0 || data[i + 1] !== g0 || data[i + 2] !== b0) {
                nonBlank = true;
                break;
              }
            }
            return {
              ok: true as const,
              bytes: blob.size,
              width: bmp.width,
              height: bmp.height,
              nonBlank,
            };
          };
          const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("capture timed out")), 20000),
          );
          return await Promise.race([analyze(), timeout]);
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) };
        } finally {
          node.style.maxHeight = prevMaxHeight;
          node.style.overflow = prevOverflow;
        }
      },
      // Returns the current grid zoom level; uses a live ref for freshness.
      getZoom: () => zoomLiveRef.current,
    };
    return () => {
      delete window.__E2E__;
    };
  }, [open]);

  // Silent startup update check — shows nothing unless an update is available.
  useEffect(() => {
    void runUpdateCheck({ trigger: "startup" });
  }, []);

  const handleCheckUpdates = useCallback(() => {
    void runUpdateCheck({ trigger: "manual" });
  }, []);

  useEffect(() => {
    const unlistenPromise = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "enter" || event.payload.type === "over") {
        setDragOver(true);
      } else {
        setDragOver(false);
      }
    });
    return () => {
      unlistenPromise.then((fn) => fn()).catch(() => undefined);
    };
  }, []);

  const openPalette = useCallback((mode: PaletteMode) => {
    setPaletteMode(mode);
    setPaletteOpen(true);
  }, []);

  const openFind = useCallback(() => {
    setFindOpen(true);
    setFindFocusNonce((n) => n + 1);
  }, []);

  const summaryEligible = useMemo(() => {
    if (!wb.activeSheet || !selection) return false;
    const totalRows = wb.activeSheet.rows.length;
    const totalCols = wb.activeSheet.max_col;
    const base = selectionBounds(selection, totalRows, totalCols);
    const merges = buildMergeInfo(wb.activeSheet.merges);
    const b = expandBoundsForMerges(base, merges);
    return b.r2 - b.r1 >= 1 && b.c2 - b.c1 >= 1;
  }, [wb.activeSheet, selection]);

  const handleOpenSummary = useCallback(() => {
    if (!summaryEligible) {
      toast.message("Select a range (≥2 cols × ≥2 rows) first");
      return;
    }
    setSummaryPanelOpen(true);
  }, [summaryEligible]);

  const handleCloseSummary = useCallback(() => {
    setSummaryPanelOpen(false);
  }, []);

  // ── Zoom handlers ────────────────────────────────────────────────────────
  const handleZoomChange = useCallback((next: number) => {
    const clamped = clampZoom(next);
    setZoom(clamped);
    if (zoomPersistTimerRef.current !== null) {
      window.clearTimeout(zoomPersistTimerRef.current);
    }
    zoomPersistTimerRef.current = window.setTimeout(() => {
      zoomPersistTimerRef.current = null;
      fileState.setZoom(clamped);
    }, 250);
  }, [fileState]);

  const handleZoomIn = useCallback(() => {
    handleZoomChange(stepZoom(zoomLiveRef.current, 1));
  }, [handleZoomChange]);

  const handleZoomOut = useCallback(() => {
    handleZoomChange(stepZoom(zoomLiveRef.current, -1));
  }, [handleZoomChange]);

  const handleZoomReset = useCallback(() => {
    handleZoomChange(1);
  }, [handleZoomChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (shouldCloseSheet(e, !!wb.workbook)) {
        e.preventDefault();
        handleClose();
        return;
      }
      if (shouldOpenFile(e)) {
        e.preventDefault();
        handlePick();
        return;
      }
      if (wb.workbook) {
        if (shouldZoomIn(e))    { e.preventDefault(); handleZoomIn(); return; }
        if (shouldZoomOut(e))   { e.preventDefault(); handleZoomOut(); return; }
        if (shouldZoomReset(e)) { e.preventDefault(); handleZoomReset(); return; }
      }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "k" || k === "p") {
        e.preventDefault();
        openPalette("root");
      } else if (k === "f") {
        e.preventDefault();
        openFind();
      } else if (k === "g") {
        e.preventDefault();
        openPalette("goto");
      } else if (k === "y" && e.shiftKey) {
        e.preventDefault();
        if (summaryPanelOpen) {
          setSummaryPanelOpen(false);
        } else if (summaryEligible) {
          setSummaryPanelOpen(true);
        } else {
          toast.message("Select a range (≥2 cols × ≥2 rows) first");
        }
      } else if (k === "s" && !e.shiftKey && flags.inlineEdit) {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPalette, openFind, summaryEligible, summaryPanelOpen, handleClose, handlePick, wb.workbook, handleZoomIn, handleZoomOut, handleZoomReset, handleSave]);

  const allowCloseRef = useRef(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  useEffect(() => {
    if (!flags.inlineEdit) return;
    let unlisten: (() => void) | undefined;
    let active = true;
    getCurrentWindow().onCloseRequested((ev) => {
      // Already confirmed, or nothing unsaved → let the close proceed.
      if (allowCloseRef.current || !editBuffer.isDirty) return;
      ev.preventDefault();
      setCloseConfirmOpen(true); // show in-app modal instead of window.confirm
    }).then((fn) => { if (active) unlisten = fn; else fn(); });
    return () => { active = false; unlisten?.(); };
  }, [editBuffer.isDirty]);

  const handleConfirmClose = useCallback(() => {
    allowCloseRef.current = true;
    setCloseConfirmOpen(false);
    // Re-issue close; the guard above now lets it through. close() uses the
    // already-granted core:window:allow-close (no destroy permission needed).
    void getCurrentWindow().close();
  }, []);

  const handleGoto = useCallback(
    (ref: string): string | null => {
      if (!wb.activeSheet) return "No sheet open";
      const parsed = parseA1(ref);
      if (!parsed) return "Invalid cell reference";
      const totalRows = wb.activeSheet.rows.length;
      const totalCols = wb.activeSheet.max_col;
      if (parsed.row >= totalRows) return `Row out of range (max ${totalRows})`;
      if (parsed.col >= totalCols)
        return `Column out of range (max ${totalCols})`;
      setSelection({
        anchor: { row: parsed.row, col: parsed.col },
        focus: { row: parsed.row, col: parsed.col },
        mode: "cell",
        scroll: "center",
        nonce: Date.now(),
      });
      return null;
    },
    [wb.activeSheet],
  );

  const matches: GridMatch[] = useMemo(() => {
    if (!wb.activeSheet || !findQuery.trim()) return [];
    const q = findQuery.trim().toLowerCase();
    const out: GridMatch[] = [];
    const rows = wb.activeSheet.rows;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (!cell) continue;
        if (cellText(cell).toLowerCase().includes(q)) {
          out.push({ row: r, col: c });
          if (out.length > 5000) return out;
        }
      }
    }
    return out;
  }, [wb.activeSheet, findQuery]);

  const matchIndexMap = useMemo(() => {
    const m = new Map<string, number>();
    matches.forEach((mt, i) => m.set(`${mt.row}:${mt.col}`, i));
    return m;
  }, [matches]);

  // Anchor cell drives find index — but only when selection is a single cell
  // (anchor === focus). A range selection has no meaningful "active match".
  const singleAnchor = useMemo(() => {
    if (!selection) return null;
    if (
      selection.anchor.row !== selection.focus.row ||
      selection.anchor.col !== selection.focus.col ||
      selection.mode !== "cell"
    ) {
      return null;
    }
    return selection.anchor;
  }, [selection]);

  const activeMatchIdx = useMemo(() => {
    if (!singleAnchor) return -1;
    return matchIndexMap.get(`${singleAnchor.row}:${singleAnchor.col}`) ?? -1;
  }, [singleAnchor, matchIndexMap]);

  const setSingleCellSelection = useCallback(
    (row: number, col: number) => {
      setSelection({
        anchor: { row, col },
        focus: { row, col },
        mode: "cell",
        scroll: "center",
        nonce: Date.now(),
      });
    },
    [],
  );

  const handleFindNext = useCallback(() => {
    if (matches.length === 0) return;
    let nextIdx: number;
    if (activeMatchIdx >= 0) {
      nextIdx = (activeMatchIdx + 1) % matches.length;
    } else {
      const anchor = singleAnchor ??
        (selection?.anchor ?? { row: 0, col: 0 });
      nextIdx = findNextAfterAnchor(matches, anchor);
      if (nextIdx === -1) nextIdx = 0;
    }
    const m = matches[nextIdx];
    setSingleCellSelection(m.row, m.col);
  }, [matches, activeMatchIdx, singleAnchor, selection, setSingleCellSelection]);

  const handleFindPrev = useCallback(() => {
    if (matches.length === 0) return;
    let prevIdx: number;
    if (activeMatchIdx >= 0) {
      prevIdx = activeMatchIdx <= 0 ? matches.length - 1 : activeMatchIdx - 1;
    } else {
      const anchor = singleAnchor ??
        (selection?.anchor ?? { row: 0, col: 0 });
      prevIdx = findPrevBeforeAnchor(matches, anchor);
      if (prevIdx === -1) prevIdx = matches.length - 1;
    }
    const m = matches[prevIdx];
    setSingleCellSelection(m.row, m.col);
  }, [matches, activeMatchIdx, singleAnchor, selection, setSingleCellSelection]);

  const handleFindClose = useCallback(() => {
    setFindOpen(false);
  }, []);

  const headerRow =
    activeSheetName !== "" ? headerRows[activeSheetName] ?? null : null;
  const activeFilters = activeSheetName ? filters[activeSheetName] ?? {} : {};

  const handleMarkAsHeader = useCallback(
    (row: number | null) => {
      if (!activeSheetName) return;
      fileState.setHeader(activeSheetName, row);
      toast.success(
        row === null
          ? "Header row unmarked"
          : `Row ${row + 1} marked as header`,
      );
    },
    [activeSheetName, fileState],
  );

  const handleColumnFilterChange = useCallback(
    (colAnchor: number, filter: ColumnFilter) => {
      if (!activeSheetName) return;
      const sheet = wb.activeSheet;
      const prevSheetFilters = filters[activeSheetName] ?? {};
      const wasActive = hasActiveFilters(prevSheetFilters);

      const isInactive =
        filter.condition.op === "none" && filter.excluded.length === 0;
      const nextSheetFilters: SheetFilters = { ...prevSheetFilters };
      if (isInactive) delete nextSheetFilters[colAnchor];
      else nextSheetFilters[colAnchor] = filter;
      const nowActive = hasActiveFilters(nextSheetFilters);

      setFilters((prev) => ({ ...prev, [activeSheetName]: nextSheetFilters }));

      if (!wasActive && nowActive && sheet) {
        const hasMerges = buildMergedRowSet(sheet.merges).size > 0;
        if (hasMerges) {
          toast.message("Filters skip merged cells", {
            description:
              "Merged cells are always shown; filters apply only to non-merged rows.",
          });
        }
      }
    },
    [activeSheetName, filters, wb.activeSheet, headerRow],
  );

  // ── Resize: overrides + stale-prompt state ────────────────────────────────
  const activeSheet = wb.activeSheet ?? null;

  const colOverrides = useMemo(
    () =>
      activeSheet && activeSheetName
        ? fileState.getColOverrides(activeSheetName, activeSheet)
        : undefined,
    [activeSheet, activeSheetName, fileState],
  );
  const rowOverrides = useMemo(
    () =>
      activeSheet && activeSheetName
        ? fileState.getRowOverrides(activeSheetName, activeSheet)
        : undefined,
    [activeSheet, activeSheetName, fileState],
  );

  const [staleLockedSheets, setStaleLockedSheets] = useState<Set<string>>(
    () => new Set(),
  );
  const resizeDisabled =
    !!activeSheetName && staleLockedSheets.has(activeSheetName);
  const promptedSheetsRef = useRef<Set<string>>(new Set());

  // Reset per-session prompt de-dup AND lock state when workbook reference
  // changes (each open() returns a fresh object → triggers even on
  // reopen-same-path).
  useEffect(() => {
    promptedSheetsRef.current = new Set();
    setStaleLockedSheets(new Set());
  }, [wb.workbook]);

  // Stale-prompt effect — surfaces a persistent toast when stored overrides
  // were written against a different sheet structure than what's currently
  // loaded. Until user picks, overrides are withheld (getColOverrides
  // returns undefined for stale fps).
  useEffect(() => {
    if (!activeSheet || !activeSheetName) return;
    if (promptedSheetsRef.current.has(activeSheetName)) return;

    const { hasStaleCols, hasStaleRows } = fileState.detectStaleOverrides(
      activeSheetName,
      activeSheet,
    );
    if (!hasStaleCols && !hasStaleRows) return;

    promptedSheetsRef.current.add(activeSheetName);
    setStaleLockedSheets((prev) => {
      const next = new Set(prev);
      next.add(activeSheetName);
      return next;
    });

    const unlock = () =>
      setStaleLockedSheets((prev) => {
        const next = new Set(prev);
        next.delete(activeSheetName);
        return next;
      });

    toast.warning(
      "File structure changed since last open. Keep your resized column/row sizes?",
      {
        duration: Infinity,
        action: {
          label: "Keep my sizes",
          onClick: () => {
            fileState.reapplyStaleOverrides(activeSheetName, activeSheet);
            unlock();
          },
        },
        cancel: {
          label: "Reset",
          onClick: () => {
            fileState.discardStaleOverrides(activeSheetName, activeSheet);
            unlock();
          },
        },
        onDismiss: () => {
          fileState.discardStaleOverrides(activeSheetName, activeSheet);
          unlock();
        },
        onAutoClose: () => {
          fileState.discardStaleOverrides(activeSheetName, activeSheet);
          unlock();
        },
      },
    );
  }, [activeSheet, activeSheetName, fileState]);

  const handleColResize = useCallback(
    (col: number, width: number) => {
      if (!activeSheetName || !activeSheet) return;
      fileState.setColWidth(activeSheetName, activeSheet, col, width);
    },
    [activeSheetName, activeSheet, fileState],
  );

  const handleRowResize = useCallback(
    (row: number, height: number) => {
      if (!activeSheetName || !activeSheet) return;
      fileState.setRowHeight(activeSheetName, activeSheet, row, height);
    },
    [activeSheetName, activeSheet, fileState],
  );

  const handleColReset = useCallback(
    (col: number) => {
      if (!activeSheetName) return;
      fileState.resetColWidth(activeSheetName, col);
    },
    [activeSheetName, fileState],
  );

  const handleRowReset = useCallback(
    (row: number) => {
      if (!activeSheetName) return;
      fileState.resetRowHeight(activeSheetName, row);
    },
    [activeSheetName, fileState],
  );

  const handleResetAllDimensions = useCallback(() => {
    if (!activeSheetName) return;
    fileState.resetAllDimensions(activeSheetName);
  }, [activeSheetName, fileState]);

  // ── Manual-size input dialog ────────────────────────────────────────────
  const [sizeDialog, setSizeDialog] = useState<SizeDialogState>(null);

  // ── Copy-as-Query (SQL) ─────────────────────────────────────────────────
  const [queryModal, setQueryModal] = useState<QueryModalState | null>(null);
  const [queryProgress, setQueryProgress] = useState<SqlProgress | null>(null);
  const queryAbortRef = useRef<AbortController | null>(null);

  const handleOpenColWidthDialog = useCallback(
    (col: number) => {
      if (!activeSheet) return;
      const current = effectiveColWidth(activeSheet, col, colOverrides);
      setSizeDialog({ kind: "col", index: col, current });
    },
    [activeSheet, colOverrides],
  );

  const handleOpenRowHeightDialog = useCallback(
    (row: number) => {
      if (!activeSheet) return;
      const current = effectiveRowHeight(activeSheet, row, rowOverrides);
      setSizeDialog({ kind: "row", index: row, current });
    },
    [activeSheet, rowOverrides],
  );

  const handleSizeDialogConfirm = useCallback(
    (value: number) => {
      if (!sizeDialog) return;
      if (sizeDialog.kind === "col") {
        handleColResize(sizeDialog.index, value);
      } else {
        handleRowResize(sizeDialog.index, value);
      }
      setSizeDialog(null);
    },
    [sizeDialog, handleColResize, handleRowResize],
  );

  const handleSizeDialogReset = useCallback(() => {
    if (!sizeDialog) return;
    if (sizeDialog.kind === "col") {
      handleColReset(sizeDialog.index);
    } else {
      handleRowReset(sizeDialog.index);
    }
    setSizeDialog(null);
  }, [sizeDialog, handleColReset, handleRowReset]);

  // App-global default copy format (used by Cmd/Ctrl+C and the context-menu
  // star). Persisted to localStorage; falls back to "inline".
  const [defaultCopyFormat, setDefaultCopyFormat] = useState<CopyFormat>(
    readStoredDefaultCopyFormat,
  );
  useEffect(() => {
    try {
      localStorage.setItem(DEFAULT_COPY_FORMAT_KEY, defaultCopyFormat);
    } catch {
      // ignore (disabled/quota)
    }
  }, [defaultCopyFormat]);

  const copyMarkdown = useCallback(
    async (format: CopyFormat, headerOverride?: number | null) => {
      const sheet = wb.activeSheet;
      if (!sheet || !selection) return;
      const totalRows = sheet.rows.length;
      const totalCols = sheet.max_col;
      const base = selectionBounds(selection, totalRows, totalCols);
      const merges = buildMergeInfo(sheet.merges);
      const bounds = expandBoundsForMerges(base, merges);
      const headerIdx =
        headerOverride !== undefined
          ? headerOverride
          : activeSheetName
            ? headerRows[activeSheetName] ?? null
            : null;
      const sheetFilters = activeSheetName ? filters[activeSheetName] ?? {} : {};
      let rowFilter: ((r: number) => boolean) | undefined;
      if (hasActiveFilters(sheetFilters)) {
        const mi = buildMergeInfo(sheet.merges);
        const mergedRowSet = buildMergedRowSet(sheet.merges);
        const groups = headerGroups(mi, headerIdx, sheet.max_col);
        const visible = new Set(
          computeVisibleRows(sheet, mergedRowSet, headerIdx, groups, sheetFilters, sheet.rows.length),
        );
        rowFilter = (r: number) => visible.has(r);
      }
      const { text, rowsEmitted, truncated } = buildSelectionMarkdown(
        sheet,
        bounds,
        headerIdx,
        format,
        rowFilter,
      );
      if (!text) {
        toast.message("Nothing to copy");
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        const suffix = truncated ? " (truncated)" : "";
        const label = COPY_FORMAT_LABELS[format];
        toast.success(
          `Copied ${rowsEmitted} row${rowsEmitted === 1 ? "" : "s"} as ${label}${suffix}`,
        );
        if (headerIdx === null) {
          const topRow = bounds.r1;
          toast.custom(
            (id) => (
              <div className="flex w-full flex-col gap-2 rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-lg">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    No header row set — used column letters (A, B, C…).
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Markdown tables read best with a real header row.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    toast.dismiss(id);
                    handleMarkAsHeader(topRow);
                    void copyMarkdown(format, topRow);
                  }}
                  className="self-end rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium hover:bg-secondary/80"
                >
                  Mark row {topRow + 1} as header
                </button>
              </div>
            ),
            { unstyled: true, duration: 8000 },
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error("Copy failed", { description: msg });
      }
    },
    [wb.activeSheet, selection, headerRows, activeSheetName, handleMarkAsHeader, filters],
  );

  // ── Copy-as-Query helpers ───────────────────────────────────────────────

  const resolveSqlContext = useCallback(() => {
    const sheet = wb.activeSheet;
    if (!sheet || !selection) return null;
    const totalRows = sheet.rows.length;
    const totalCols = sheet.max_col;
    const base = selectionBounds(selection, totalRows, totalCols);
    const merges = buildMergeInfo(sheet.merges);
    const bounds = expandBoundsForMerges(base, merges);
    const headerIdx = activeSheetName ? (headerRows[activeSheetName] ?? null) : null;
    const sheetFilters = activeSheetName ? filters[activeSheetName] ?? {} : {};
    let rowFilter: ((r: number) => boolean) | undefined;
    if (hasActiveFilters(sheetFilters)) {
      const mi = buildMergeInfo(sheet.merges);
      const mergedRowSet = buildMergedRowSet(sheet.merges);
      const groups = headerGroups(mi, headerIdx, sheet.max_col);
      const visible = new Set(
        computeVisibleRows(sheet, mergedRowSet, headerIdx, groups, sheetFilters, sheet.rows.length),
      );
      rowFilter = (r: number) => visible.has(r);
    }
    return { sheet, bounds, headerIdx, rowFilter };
  }, [wb.activeSheet, selection, headerRows, activeSheetName, filters]);

  const reconfigureRef = useRef<(kind: QueryKind) => void>(() => {});

  // Shared: generate + clipboard + result toast (with a "Change here" CTA).
  // Shows the progress view (via the modal shell) only for large async copies.
  const runQueryCopy = useCallback(
    async (args: {
      snapshot: {
        sheet: BuildSqlOptions["sheet"];
        bounds: BuildSqlOptions["bounds"];
        headerIdx: number;
        rowFilter?: (r: number) => boolean;
      };
      kind: QueryKind;
      tableName: string;
      dialect: SqlDialect;
      keyCols: number[];
      progressState: QueryModalState;
      fromModal: boolean; // true → just configured via modal: no "Change here" CTA
    }) => {
      const { snapshot: s, kind, tableName, dialect, keyCols, progressState, fromModal } = args;
      const opts: BuildSqlOptions = {
        sheet: s.sheet,
        bounds: s.bounds,
        headerRowIdx: s.headerIdx,
        kind,
        tableName,
        dialect,
        keyCols,
        rowFilter: s.rowFilter,
      };
      const estRows = s.bounds.r2 - s.bounds.r1 + 1;
      let res: Awaited<ReturnType<typeof buildSqlQuery>>;
      try {
        if (estRows <= SQL_ASYNC_THRESHOLD) {
          res = buildSqlQuery(opts);
        } else {
          const ac = new AbortController();
          queryAbortRef.current = ac;
          setQueryModal(progressState);
          setQueryProgress({ done: 0, total: estRows });
          res = await generateSqlWithProgress(opts, (p) => setQueryProgress(p), ac.signal);
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          toast.message("Cancelled");
        } else {
          toast.error("Copy failed", { description: e instanceof Error ? e.message : String(e) });
        }
        queryAbortRef.current = null;
        setQueryProgress(null);
        setQueryModal(null);
        return;
      }

      if (!res.text) {
        toast.message(
          res.skippedRows.length
            ? `Nothing to copy · ${res.skippedRows.length} row(s) skipped`
            : "Nothing to copy",
        );
      } else {
        try {
          await navigator.clipboard.writeText(res.text);
        } catch (e) {
          toast.error("Copy failed", { description: e instanceof Error ? e.message : String(e) });
          queryAbortRef.current = null;
          setQueryProgress(null);
          setQueryModal(null);
          return;
        }
        const suffix = res.truncated ? " (truncated)" : "";
        const skipNote = res.skippedRows.length
          ? ` · ${res.skippedRows.length} row(s) skipped (see comment in copied SQL)`
          : "";
        const base = `Copied ${res.rowsEmitted} row(s) as ${kind.toUpperCase()} into table ${tableName} (${dialect})${suffix}${skipNote}`;
        if (fromModal) {
          toast.success(base);
        } else {
          toast.success(`${base}. Not what you want?`, {
            action: {
              label: "Change here",
              onClick: () => reconfigureRef.current(kind),
            },
          });
        }
      }

      queryAbortRef.current = null;
      setQueryProgress(null);
      setQueryModal(null);
    },
    [],
  );

  const handleCopyQuery = useCallback(
    (kind: QueryKind, forceModal = false) => {
      const ctx = resolveSqlContext();
      if (!ctx) return;

      if (ctx.headerIdx == null) {
        const topRow = ctx.bounds.r1;
        toast.custom(
          (id) => (
            <div className="flex w-full flex-col gap-2 rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-lg">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  Use row {topRow + 1} as column names for the query?
                </span>
                <span className="text-xs text-muted-foreground">
                  A header row is required to generate a SQL query.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  toast.dismiss(id);
                  handleMarkAsHeader(topRow);
                  handleCopyQuery(kind, forceModal);
                }}
                className="self-end rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium hover:bg-secondary/80"
              >
                Use as header
              </button>
            </div>
          ),
          { unstyled: true, duration: 8000 },
        );
        return;
      }

      const cols = sqlColumns(ctx.sheet, ctx.bounds, ctx.headerIdx);

      const emptyCols = cols.filter((c) => c.name.trim() === "");
      if (emptyCols.length > 0) {
        toast.error(
          `Cannot copy as query: column(s) ${emptyCols.map((c) => columnLetter(c.index)).join(", ")} have no name. Set a header value first.`,
        );
        return;
      }

      const nameCounts: Record<string, number> = {};
      for (const c of cols) {
        nameCounts[c.name] = (nameCounts[c.name] ?? 0) + 1;
      }
      const dup = cols.filter((c) => nameCounts[c.name] > 1).map((c) => c.name);
      if (dup.length > 0) {
        toast.error(
          `Cannot copy as query: duplicate column names (${[...new Set(dup)].join(", ")}). Rename to continue.`,
        );
        return;
      }

      const fileName = wb.workbook?.file_name ?? (activeSheetName ?? "table");
      const sheetKey = activeSheetName ?? "";
      const storedTable = readStoredTableName(fileName, sheetKey);
      const dialect = readStoredDialect();
      const needsKey = kind === "update" || kind === "upsert";

      const colIndexSet = new Set(cols.map((c) => c.index));
      const storedKeys = needsKey ? readStoredKeyCols(fileName, sheetKey, kind) : null;
      const validKeys = storedKeys?.filter((k) => colIndexSet.has(k)) ?? null;
      const missingKeys = storedKeys?.filter((k) => !colIndexSet.has(k)) ?? [];

      // Header label for an absolute column index (used in warnings).
      const labelAt = (idx: number) => {
        const cell = ctx.sheet.rows[ctx.headerIdx!]?.[idx];
        const t = cell ? cellText(cell) : "";
        return t.trim() !== "" ? t : columnLetter(idx);
      };

      const snapshot = {
        sheet: ctx.sheet,
        bounds: ctx.bounds,
        headerIdx: ctx.headerIdx!, // non-null here (guarded above)
        rowFilter: ctx.rowFilter,
      };
      const keyDupCheck = (keyCols: number[]) =>
        keyHasDuplicates(snapshot.sheet, snapshot.bounds, snapshot.headerIdx, keyCols, snapshot.rowFilter);

      const keyWarning =
        missingKeys.length > 0
          ? `WHERE field(s) ${missingKeys.map(labelAt).join(", ")} from your last setting are not in the current range — re-select.`
          : undefined;

      const modalState: QueryModalState = {
        kind,
        columns: cols,
        tableName: storedTable ?? sanitizeTableName(stripExt(fileName)),
        dialect,
        keyDupCheck,
        initialKeyCols: validKeys ?? undefined,
        keyWarning,
        _snapshot: snapshot,
      };

      // Skip the modal once the sheet is configured (table stored) and, for
      // update/upsert, the remembered keys are all still in range.
      const configured = storedTable != null;
      const keysReady =
        !needsKey ||
        (validKeys != null && validKeys.length > 0 && missingKeys.length === 0);
      const canSkip = !forceModal && configured && keysReady;

      if (canSkip) {
        void runQueryCopy({
          snapshot,
          kind,
          tableName: storedTable!,
          dialect,
          keyCols: needsKey ? validKeys! : [],
          progressState: modalState,
          fromModal: false,
        });
        return;
      }

      if (missingKeys.length > 0) {
        toast.warning(
          `Key field(s) ${missingKeys.map(labelAt).join(", ")} are no longer in the selected range — please re-select.`,
        );
      }

      setQueryModal(modalState);
    },
    [resolveSqlContext, handleMarkAsHeader, wb.workbook?.file_name, activeSheetName, runQueryCopy],
  );

  useEffect(() => {
    reconfigureRef.current = (kind: QueryKind) => handleCopyQuery(kind, true);
  }, [handleCopyQuery]);

  const handleQueryConfirm = useCallback(
    (c: QueryConfirm) => {
      const m = queryModal;
      if (!m) return;
      const s = m._snapshot as {
        sheet: BuildSqlOptions["sheet"];
        bounds: BuildSqlOptions["bounds"];
        headerIdx: number;
        rowFilter?: (r: number) => boolean;
      };

      const fileName = wb.workbook?.file_name ?? (activeSheetName ?? "table");
      writeStoredDialect(c.dialect);
      writeStoredTableName(fileName, activeSheetName ?? "", c.tableName);
      if (m.kind === "update" || m.kind === "upsert") {
        writeStoredKeyCols(fileName, activeSheetName ?? "", m.kind, c.keyCols);
      }

      void runQueryCopy({
        snapshot: s,
        kind: m.kind,
        tableName: c.tableName,
        dialect: c.dialect,
        keyCols: c.keyCols,
        progressState: { ...m, tableName: c.tableName, dialect: c.dialect },
        fromModal: true,
      });
    },
    [queryModal, wb.workbook?.file_name, activeSheetName, runQueryCopy],
  );

  const handleQueryCancel = useCallback(() => {
    queryAbortRef.current?.abort();
    queryAbortRef.current = null;
    setQueryProgress(null);
    setQueryModal(null);
  }, []);

  // Context-menu copy. Plain click → copy now. Cmd/Ctrl+click (setAsDefault)
  // → copy now AND persist that format as the default.
  const handleCopyFormat = useCallback(
    (format: CopyFormat, setAsDefault: boolean) => {
      copyMarkdown(format);
      if (setAsDefault) {
        setDefaultCopyFormat(format);
        toast.success(`Set "${format}" as default copy format`);
      }
    },
    [copyMarkdown],
  );

  // Cmd/Ctrl+C → copy selection using the saved default format.
  const handleCopyDefault = useCallback(
    () => copyMarkdown(defaultCopyFormat),
    [copyMarkdown, defaultCopyFormat],
  );

  // Context-menu star click → set default only (no copy).
  const handleSetDefaultFormat = useCallback((format: CopyFormat) => {
    setDefaultCopyFormat(format);
    toast.success(`Set "${format}" as default copy format`);
  }, []);

  const findActive = findOpen && !!wb.activeSheet;

  const handleCopyFilePath = useCallback(async () => {
    if (!filePath) {
      toast.message("No file open");
      return;
    }
    try {
      await copyFilePath(filePath);
      toast.success("Copied file path");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Copy failed", { description: msg });
    }
  }, [filePath]);

  const handleCopyFile = useCallback(async () => {
    if (!filePath) {
      toast.message("No file open");
      return;
    }
    try {
      await copyFileToClipboard(filePath);
      toast.success("Copied file to clipboard");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Copy failed", { description: msg });
    }
  }, [filePath]);

  const handleDragOut = useCallback(async () => {
    if (!filePath) {
      toast.message("No file open");
      return;
    }
    try {
      await dragOutFile(filePath);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Drag failed", { description: msg });
    }
  }, [filePath]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground antialiased overflow-hidden">
      <TitleBar
        fileName={wb.workbook?.file_name ?? null}
        onOpenCommand={() => openPalette("root")}
        onClose={wb.workbook ? handleClose : undefined}
        filePath={filePath}
        onCopyFile={handleCopyFile}
        onCopyFilePath={handleCopyFilePath}
        onDragOut={handleDragOut}
        dirty={editBuffer.isDirty}
      />

      {wb.loading && (
        <div className="absolute inset-x-0 top-10 z-50 h-0.5 overflow-hidden bg-muted">
          <div className="h-full w-1/3 animate-pulse bg-primary" />
        </div>
      )}

      {!wb.workbook ? (
        <Welcome onOpen={open} recents={recents} dragOver={dragOver} />
      ) : (
        <>
          {wb.activeSheet && (
            <Grid
              sheet={wb.activeSheet}
              selection={selection}
              matches={findActive ? matches : undefined}
              onSelectionChange={handleSelectionChange}
              headerRow={headerRow}
              onMarkHeader={handleMarkAsHeader}
              defaultCopyFormat={defaultCopyFormat}
              onCopyFormat={handleCopyFormat}
              onSetDefaultFormat={handleSetDefaultFormat}
              onCopyDefault={handleCopyDefault}
              onSummarize={handleOpenSummary}
              canSummarize={summaryEligible}
              colOverrides={colOverrides}
              rowOverrides={rowOverrides}
              resizeDisabled={resizeDisabled}
              onColResize={handleColResize}
              onRowResize={handleRowResize}
              onColReset={handleColReset}
              onRowReset={handleRowReset}
              onResetAllDimensions={handleResetAllDimensions}
              onOpenColWidthDialog={handleOpenColWidthDialog}
              onOpenRowHeightDialog={handleOpenRowHeightDialog}
              filters={activeFilters}
              onColumnFilterChange={handleColumnFilterChange}
              canCopyQuery
              onCopyQuery={handleCopyQuery}
              zoom={zoom}
              onZoomChange={handleZoomChange}
              editEnabled={editEnabled}
              editingCell={editingCell}
              getEditedCell={getEditedCell}
              onEditStart={handleEditStart}
              onEditCommit={handleEditCommit}
              onEditCancel={handleEditCancel}
            />
          )}
          <StatusBar
            sheet={wb.activeSheet}
            selection={selection}
            canSummarize={summaryEligible}
            onOpenSummary={handleOpenSummary}
            zoom={zoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
          />
          {summaryPanelOpen && wb.activeSheet && selection && (
            <SummaryPanel
              sheet={wb.activeSheet}
              selection={selection}
              headerRow={headerRow}
              onClose={handleCloseSummary}
            />
          )}
          <SheetTabs
            sheets={wb.workbook.sheets}
            activeName={wb.activeSheet?.name ?? ""}
            onSwitch={handleSwitchSheet}
          />
        </>
      )}

      <FindBar
        open={findActive}
        query={findQuery}
        matchCount={matches.length}
        activeIndex={activeMatchIdx}
        focusNonce={findFocusNonce}
        onQueryChange={setFindQuery}
        onNext={handleFindNext}
        onPrev={handleFindPrev}
        onClose={handleFindClose}
      />

      <CommandPalette
        open={paletteOpen}
        mode={paletteMode}
        onOpenChange={setPaletteOpen}
        onModeChange={setPaletteMode}
        onGoto={handleGoto}
        onOpenSummary={handleOpenSummary}
        onCopyFile={filePath ? handleCopyFile : undefined}
        onCopyFilePath={filePath ? handleCopyFilePath : undefined}
        hasFile={!!wb.workbook}
        recents={recents}
        onOpenRecent={open}
        onPickFile={handlePick}
        currentPath={filePath}
        onCheckUpdates={handleCheckUpdates}
      />

      <ResizeDialog
        state={sizeDialog}
        onConfirm={handleSizeDialogConfirm}
        onReset={handleSizeDialogReset}
        onCancel={() => setSizeDialog(null)}
      />
      <QueryModal
        state={queryModal}
        progress={queryProgress}
        onConfirm={handleQueryConfirm}
        onCancel={handleQueryCancel}
      />
      <Dialog
        open={closeConfirmOpen}
        onOpenChange={(o) => !o && setCloseConfirmOpen(false)}
      >
        <DialogContent className="sm:max-w-sm" data-testid="close-confirm-dialog">
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogDescription>
              You have unsaved edits. Close without saving? Your changes will be
              lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmClose}
              data-testid="close-confirm-btn"
            >
              Close without saving
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
