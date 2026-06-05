import { useMemo } from "react";
import { Sigma } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SheetModel } from "@/lib/types";
import { cellText } from "@/lib/types";
import {
  columnLetter,
  expandBoundsForMerges,
  buildMergeInfo,
  formatSelectionRef,
  selectionBounds,
} from "@/components/Grid/grid-utils";
import type { Selection } from "@/components/Grid/Grid";
import {
  computeSelectionStats,
  formatStatNumber,
} from "@/lib/selection-stats";
import { formatZoomPercent } from "@/lib/zoom";

interface StatusBarProps {
  sheet: SheetModel | null;
  selection: Selection | null;
  canSummarize?: boolean;
  onOpenSummary?: () => void;
  // Zoom controls — wired in Step 6, UI rendered in Step 7.
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
}

const PREVIEW_MAX = 200;

export function StatusBar({
  sheet,
  selection,
  canSummarize,
  onOpenSummary,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: StatusBarProps) {
  const { t } = useTranslation();

  // Hook must run unconditionally — keep above any early return (Rules of Hooks).
  const stats = useMemo(() => {
    if (!sheet || !selection) return null;
    const base = selectionBounds(selection, sheet.rows.length, sheet.max_col);
    const merges = buildMergeInfo(sheet.merges);
    const bounds = expandBoundsForMerges(base, merges);
    const single =
      bounds.r1 === bounds.r2 &&
      bounds.c1 === bounds.c2 &&
      selection.mode === "cell";
    return single ? null : computeSelectionStats(sheet, bounds);
  }, [sheet, selection]);

  if (!sheet || !selection) {
    return (
      <div
        data-tauri-drag-region
        className="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-muted/30 px-3 text-[11px] text-muted-foreground"
      >
        <span
          data-tauri-drag-region
          className="min-w-[3rem] font-mono font-medium tabular-nums text-foreground/80"
        >
          —
        </span>
        <span data-tauri-drag-region className="flex-1 truncate"></span>
      </div>
    );
  }

  const totalRows = sheet.rows.length;
  const totalCols = sheet.max_col;
  const base = selectionBounds(selection, totalRows, totalCols);
  const merges = buildMergeInfo(sheet.merges);
  const bounds = expandBoundsForMerges(base, merges);

  const isSingle =
    bounds.r1 === bounds.r2 &&
    bounds.c1 === bounds.c2 &&
    selection.mode === "cell";

  const ref = formatSelectionRef(selection, bounds);

  let summary = "";
  let preview = "";
  if (isSingle) {
    const cell = sheet.rows[bounds.r1]?.[bounds.c1];
    const value = cell ? cellText(cell) : "";
    preview =
      value.length > PREVIEW_MAX ? value.slice(0, PREVIEW_MAX) + "…" : value;
  } else {
    const rows = bounds.r2 - bounds.r1 + 1;
    const cols = bounds.c2 - bounds.c1 + 1;
    summary = t("statusbar.selectionSize", { rows, cols, count: rows * cols });
  }

  const statsLabel = stats
    ? `SUM: ${formatStatNumber(stats.sum)} · AVG: ${formatStatNumber(stats.avg)} · MIN: ${formatStatNumber(stats.min)} · MAX: ${formatStatNumber(stats.max)} · COUNT: ${stats.count}`
    : null;

  // Convenience anchor label — show the active cell coord when in a range.
  const anchorLabel = isSingle
    ? null
    : `${columnLetter(selection.anchor.col)}${selection.anchor.row + 1}`;

  return (
    <div
      data-tauri-drag-region
      data-testid="statusbar"
      className="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-muted/30 px-3 text-[11px] text-muted-foreground"
    >
      <span
        data-tauri-drag-region
        data-testid="statusbar-cell-ref"
        className="min-w-[3rem] font-mono font-medium tabular-nums text-foreground/80"
      >
        {ref}
      </span>
      {anchorLabel && (
        <span
          data-tauri-drag-region
          className="font-mono tabular-nums text-foreground/60"
          title={t("statusbar.activeCell")}
        >
          ⇢ {anchorLabel}
        </span>
      )}
      <span
        data-tauri-drag-region
        className="flex-1 truncate"
        title={preview || summary}
      >
        {isSingle ? preview : summary}
      </span>
      {statsLabel && (
        <span
          data-tauri-drag-region
          data-testid="statusbar-stats"
          className="font-mono tabular-nums text-foreground/70"
          title={statsLabel}
        >
          {statsLabel}
        </span>
      )}
      {canSummarize && onOpenSummary && (
        <button
          type="button"
          onClick={onOpenSummary}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-foreground/70 hover:bg-muted/50 hover:text-foreground"
          data-testid="statusbar-analyze"
          title={t("statusbar.summaryTitle", { shortcut: "⌘⇧Y" })}
        >
          <Sigma className="h-3 w-3" />
          <span>{t("statusbar.analyze")}</span>
        </button>
      )}
      {zoom !== undefined && onZoomOut && onZoomReset && onZoomIn && (
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            data-testid="statusbar-zoom-out"
            onClick={onZoomOut}
            title={t("statusbar.zoomOut")}
            className="rounded px-1.5 py-0.5 text-[11px] text-foreground/70 hover:bg-muted/50 hover:text-foreground"
          >
            −
          </button>
          <button
            type="button"
            data-testid="statusbar-zoom-label"
            onClick={onZoomReset}
            title={t("statusbar.zoomReset")}
            className="rounded px-1.5 py-0.5 text-[11px] font-mono tabular-nums text-foreground/70 hover:bg-muted/50 hover:text-foreground"
          >
            {formatZoomPercent(zoom)}
          </button>
          <button
            type="button"
            data-testid="statusbar-zoom-in"
            onClick={onZoomIn}
            title={t("statusbar.zoomIn")}
            className="rounded px-1.5 py-0.5 text-[11px] text-foreground/70 hover:bg-muted/50 hover:text-foreground"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
