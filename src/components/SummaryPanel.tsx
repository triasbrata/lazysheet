import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Copy, Sigma, X } from "lucide-react";
import type { SheetModel } from "@/lib/types";
import type { Selection } from "@/components/Grid/Grid";
import {
  buildMergeInfo,
  expandBoundsForMerges,
  selectionBounds,
  type Bounds,
} from "@/components/Grid/grid-utils";
import { formatStatNumber } from "@/lib/selection-stats";
import {
  buildValueHeader,
  computeGroupBySummary,
  formatGroupByMarkdown,
  formatGroupByTSV,
  resolveFields,
  type AggFn,
  type FieldDescriptor,
} from "@/lib/group-by-summary";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SummaryPanelProps {
  sheet: SheetModel;
  selection: Selection;
  headerRow: number | null;
  onClose: () => void;
}

const AGG_LABELS: Record<AggFn, string> = {
  sum: "SUM",
  avg: "AVG",
  min: "MIN",
  max: "MAX",
  count: "COUNT",
};

const AGG_OPTIONS: AggFn[] = ["sum", "avg", "min", "max", "count"];

// Pick a sensible default value column: prefer the first column with mostly
// numeric content (sample-based). Falls back to last column of selection.
function pickDefaultValueCol(
  sheet: SheetModel,
  bounds: Bounds,
  excludeCol: number,
): number {
  const sampleRows = Math.min(20, bounds.r2 - bounds.r1 + 1);
  let bestCol = -1;
  let bestScore = -1;
  for (let c = bounds.c1; c <= bounds.c2; c++) {
    if (c === excludeCol) continue;
    let numericHits = 0;
    let nonEmpty = 0;
    for (let i = 0; i < sampleRows; i++) {
      const r = bounds.r1 + i;
      const cell = sheet.rows[r]?.[c];
      if (!cell) continue;
      if (cell.v.t === "Empty") continue;
      nonEmpty++;
      if (cell.v.t === "Number" || cell.v.t === "Integer") numericHits++;
    }
    const score = nonEmpty > 0 ? numericHits / nonEmpty : 0;
    if (score > bestScore) {
      bestScore = score;
      bestCol = c;
    }
  }
  if (bestCol === -1) {
    return bounds.c2 === excludeCol ? bounds.c1 : bounds.c2;
  }
  return bestCol;
}

export function SummaryPanel({
  sheet,
  selection,
  headerRow,
  onClose,
}: SummaryPanelProps) {
  const totalRows = sheet.rows.length;
  const totalCols = sheet.max_col;

  const bounds = useMemo(() => {
    const base = selectionBounds(selection, totalRows, totalCols);
    const merges = buildMergeInfo(sheet.merges);
    return expandBoundsForMerges(base, merges);
  }, [selection, totalRows, totalCols, sheet.merges]);

  const boundsKey = `${bounds.r1}:${bounds.c1}:${bounds.r2}:${bounds.c2}`;

  const hasMultipleCols = bounds.c2 > bounds.c1;
  const hasMultipleRows = bounds.r2 > bounds.r1;

  const [treatFirstRowAsHeader, setTreatFirstRowAsHeader] = useState(true);
  const [aggFn, setAggFn] = useState<AggFn>("sum");
  const [categoryCol, setCategoryCol] = useState<number>(bounds.c1);
  const [valueCol, setValueCol] = useState<number>(() =>
    pickDefaultValueCol(sheet, bounds, bounds.c1),
  );

  // Reset picker state when selection bounds shape changes.
  useEffect(() => {
    setCategoryCol(bounds.c1);
    setValueCol(pickDefaultValueCol(sheet, bounds, bounds.c1));
    setAggFn("sum");
    // Intentional: react only to bounds shape change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey]);

  // Esc closes the panel when focus is within.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  const resolved = useMemo(
    () => resolveFields(sheet, bounds, headerRow, treatFirstRowAsHeader),
    [sheet, bounds, headerRow, treatFirstRowAsHeader],
  );

  // Keep current picks valid against resolved fields.
  const fieldsByCol = useMemo(() => {
    const m = new Map<number, FieldDescriptor>();
    for (const f of resolved.fields) m.set(f.col, f);
    return m;
  }, [resolved.fields]);

  useEffect(() => {
    if (!fieldsByCol.has(categoryCol) && resolved.fields[0]) {
      setCategoryCol(resolved.fields[0].col);
    }
    if (!fieldsByCol.has(valueCol)) {
      const fallback = resolved.fields.find((f) => f.col !== categoryCol);
      if (fallback) setValueCol(fallback.col);
    }
  }, [fieldsByCol, categoryCol, valueCol, resolved.fields]);

  const headerInsideSelection =
    headerRow !== null &&
    headerRow >= bounds.r1 &&
    headerRow <= bounds.r2;

  const result = useMemo(
    () =>
      computeGroupBySummary(sheet, bounds, {
        aggFn,
        categoryCol,
        valueCol,
        excludeRow: resolved.excludeRow,
      }),
    [sheet, bounds, aggFn, categoryCol, valueCol, resolved.excludeRow],
  );

  const catLabel = fieldsByCol.get(categoryCol)?.label ?? "Category";
  const valueLabel = fieldsByCol.get(valueCol)?.label ?? "Value";
  const valueHeader = buildValueHeader(aggFn, valueLabel);

  const handleCopyMarkdown = useCallback(async () => {
    if (result.rows.length === 0) {
      toast.message("Nothing to copy");
      return;
    }
    try {
      const text = formatGroupByMarkdown(result, catLabel, valueHeader);
      await navigator.clipboard.writeText(text);
      const suffix = result.truncated ? " (truncated)" : "";
      toast.success(
        `Copied ${result.rows.length} group${result.rows.length === 1 ? "" : "s"} as markdown${suffix}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Copy failed", { description: msg });
    }
  }, [result, catLabel, valueHeader]);

  const handleCopyTSV = useCallback(async () => {
    if (result.rows.length === 0) {
      toast.message("Nothing to copy");
      return;
    }
    try {
      const text = formatGroupByTSV(result, catLabel, valueHeader);
      await navigator.clipboard.writeText(text);
      const suffix = result.truncated ? " (truncated)" : "";
      toast.success(
        `Copied ${result.rows.length} group${result.rows.length === 1 ? "" : "s"} as TSV${suffix}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Copy failed", { description: msg });
    }
  }, [result, catLabel, valueHeader]);

  if (!hasMultipleCols || !hasMultipleRows) return null;

  return (
    <div
      className="flex shrink-0 flex-col border-t border-border bg-card/30"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60">
        <Sigma className="h-3.5 w-3.5 text-foreground/70" />
        <span className="text-xs font-medium text-foreground/80">
          Group-by summary
        </span>

        <div className="flex items-center gap-1.5 ml-2">
          <FieldPicker
            label="Aggregate"
            current={AGG_LABELS[aggFn]}
            options={AGG_OPTIONS.map((a) => ({ value: a, label: AGG_LABELS[a] }))}
            value={aggFn}
            onChange={(v) => setAggFn(v as AggFn)}
          />
          <FieldPicker
            label="of"
            current={valueLabel}
            disabled={aggFn === "count" ? false : false}
            options={resolved.fields.map((f) => ({
              value: String(f.col),
              label: f.label,
            }))}
            value={String(valueCol)}
            onChange={(v) => setValueCol(Number(v))}
          />
          <span className="text-[11px] text-muted-foreground">by</span>
          <FieldPicker
            label="Category"
            current={catLabel}
            options={resolved.fields.map((f) => ({
              value: String(f.col),
              label: f.label,
            }))}
            value={String(categoryCol)}
            onChange={(v) => setCategoryCol(Number(v))}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {headerInsideSelection ? (
            <span
              className="text-[11px] text-muted-foreground"
              title="Header row marked via context menu"
            >
              Using marked header row
            </span>
          ) : headerRow !== null ? (
            <span
              className="text-[11px] text-muted-foreground"
              title="Header row is outside the current selection"
            >
              Header row (row {headerRow + 1})
            </span>
          ) : (
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={treatFirstRowAsHeader}
                onChange={(e) => setTreatFirstRowAsHeader(e.target.checked)}
                className="h-3 w-3 accent-primary"
              />
              First row is header
            </label>
          )}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleCopyMarkdown}
            disabled={result.rows.length === 0}
            title="Copy as Markdown table"
          >
            <Copy className="h-3 w-3" />
            <span>Markdown</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleCopyTSV}
            disabled={result.rows.length === 0}
            title="Copy as TSV"
          >
            <Copy className="h-3 w-3" />
            <span>TSV</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close summary panel"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="max-h-56 overflow-auto">
        {result.tooLarge ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">
            Selection too large to summarize. Pick a smaller range.
          </div>
        ) : result.rows.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">
            No data to aggregate
            {aggFn !== "count" && result.skippedNonNumeric > 0
              ? ` (${result.skippedNonNumeric} non-numeric value cells skipped).`
              : "."}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/40 backdrop-blur-sm">
              <tr className="text-foreground/70">
                <th className="text-left font-medium px-3 py-1.5 border-b border-border/60">
                  {catLabel}
                </th>
                <th className="text-right font-medium px-3 py-1.5 border-b border-border/60 tabular-nums">
                  {valueHeader}
                </th>
                <th className="text-right font-medium px-3 py-1.5 border-b border-border/60 tabular-nums w-16">
                  N
                </th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.key} className="hover:bg-muted/30">
                  <td className="px-3 py-1 text-foreground/90">
                    {r.display}
                  </td>
                  <td className="px-3 py-1 text-right font-mono tabular-nums">
                    {formatStatNumber(r.value)}
                  </td>
                  <td className="px-3 py-1 text-right font-mono tabular-nums text-muted-foreground">
                    {r.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border/60 text-[11px] text-muted-foreground">
        <span>
          {result.tooLarge
            ? "—"
            : `${result.totalGroups} group${result.totalGroups === 1 ? "" : "s"}`}
        </span>
        <span>·</span>
        <span>
          {result.totalRowsAggregated} row
          {result.totalRowsAggregated === 1 ? "" : "s"} aggregated
        </span>
        {aggFn !== "count" && result.skippedNonNumeric > 0 && (
          <>
            <span>·</span>
            <span>{result.skippedNonNumeric} non-numeric skipped</span>
          </>
        )}
        {result.truncated && (
          <>
            <span>·</span>
            <span>
              showing top {result.rows.length} of {result.totalGroups}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

interface FieldPickerProps {
  label: string;
  current: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

function FieldPicker({
  label,
  current,
  options,
  value,
  onChange,
  disabled,
}: FieldPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="xs"
          disabled={disabled}
          className="font-normal"
          title={label}
        >
          <span className="text-muted-foreground mr-1">{label}:</span>
          <span className="truncate max-w-[140px]">{current}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-auto">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
