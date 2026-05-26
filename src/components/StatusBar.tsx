import { useMemo } from "react";
import { Sigma } from "lucide-react";
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

interface StatusBarProps {
  sheet: SheetModel | null;
  selection: Selection | null;
  canSummarize?: boolean;
  onOpenSummary?: () => void;
}

const PREVIEW_MAX = 200;

export function StatusBar({
  sheet,
  selection,
  canSummarize,
  onOpenSummary,
}: StatusBarProps) {
  if (!sheet || !selection) {
    return (
      <div className="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-muted/30 px-3 text-[11px] text-muted-foreground">
        <span className="min-w-[3rem] font-mono font-medium tabular-nums text-foreground/80">
          —
        </span>
        <span className="flex-1 truncate"></span>
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
    summary = `${rows}R × ${cols}C · ${rows * cols} cells`;
  }

  const stats = useMemo(
    () => (isSingle ? null : computeSelectionStats(sheet, bounds)),
    [sheet, bounds.r1, bounds.r2, bounds.c1, bounds.c2, isSingle],
  );

  const statsLabel = stats
    ? `SUM: ${formatStatNumber(stats.sum)} · AVG: ${formatStatNumber(stats.avg)} · MIN: ${formatStatNumber(stats.min)} · MAX: ${formatStatNumber(stats.max)} · COUNT: ${stats.count}`
    : null;

  // Convenience anchor label — show the active cell coord when in a range.
  const anchorLabel = isSingle
    ? null
    : `${columnLetter(selection.anchor.col)}${selection.anchor.row + 1}`;

  return (
    <div className="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-muted/30 px-3 text-[11px] text-muted-foreground">
      <span className="min-w-[3rem] font-mono font-medium tabular-nums text-foreground/80">
        {ref}
      </span>
      {anchorLabel && (
        <span
          className="font-mono tabular-nums text-foreground/60"
          title="Active cell"
        >
          ⇢ {anchorLabel}
        </span>
      )}
      <span className="flex-1 truncate" title={preview || summary}>
        {isSingle ? preview : summary}
      </span>
      {statsLabel && (
        <span
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
          title="Group-by summary (⌘⇧Y)"
        >
          <Sigma className="h-3 w-3" />
          <span>Analyze</span>
        </button>
      )}
    </div>
  );
}
