import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  ImageDown,
  Plus,
  Sigma,
  X,
} from "lucide-react";

type CopyFormat = "markdown" | "tsv" | "image";
const COPY_FORMAT_KEY = "summary-panel:copy-format";
const DEFAULT_COPY_FORMAT: CopyFormat = "markdown";

function readStoredCopyFormat(): CopyFormat {
  try {
    const v = localStorage.getItem(COPY_FORMAT_KEY);
    if (v === "markdown" || v === "tsv" || v === "image") return v;
  } catch {
    // ignore
  }
  return DEFAULT_COPY_FORMAT;
}
import { copyNodeAsImage } from "@/lib/copy-as-image";
import type { SheetModel } from "@/lib/types";
import type { Selection } from "@/components/Grid/Grid";
import {
  buildMergeInfo,
  columnLetter,
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
  MAX_CATEGORY_FIELDS,
  resolveFields,
  SUBTOTAL_LABEL_SUFFIX,
  type AggFn,
  type FieldDescriptor,
  type GroupByRow,
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
const TREE_INDENT_PX = 12;

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

// Aggregate rollup for synthetic parent rows in tree view when subtotals OFF.
// Same math as lib's rollup but local to UI to avoid coupling.
function rollupForTree(
  aggFn: AggFn,
  leaves: GroupByRow[],
): { value: number; count: number } {
  if (leaves.length === 0) return { value: 0, count: 0 };
  switch (aggFn) {
    case "sum":
    case "count": {
      let value = 0;
      let count = 0;
      for (const l of leaves) {
        value += l.value;
        count += l.count;
      }
      return { value, count };
    }
    case "min": {
      let value = Number.POSITIVE_INFINITY;
      let count = 0;
      for (const l of leaves) {
        if (l.value < value) value = l.value;
        count += l.count;
      }
      return {
        value: value === Number.POSITIVE_INFINITY ? 0 : value,
        count,
      };
    }
    case "max": {
      let value = Number.NEGATIVE_INFINITY;
      let count = 0;
      for (const l of leaves) {
        if (l.value > value) value = l.value;
        count += l.count;
      }
      return {
        value: value === Number.NEGATIVE_INFINITY ? 0 : value,
        count,
      };
    }
    case "avg": {
      let sumWeighted = 0;
      let countWeighted = 0;
      for (const l of leaves) {
        sumWeighted += l.value * l.count;
        countWeighted += l.count;
      }
      return {
        value: countWeighted > 0 ? sumWeighted / countWeighted : 0,
        count: countWeighted,
      };
    }
  }
}

interface TreeNode {
  kind: "parent" | "leaf" | "subtotal";
  depth: number;
  prefixKey: string;
  displays: string[];
  value: number;
  count: number;
  // Indent depth for rendering. Parent rows indent at their depth.
  // Leaves render at the last column.
  // Subtotal rows: render indented at subtotalDepth.
  isParent: boolean;
}

// Build linear tree rows from canonical leaves (+ optional embedded subtotals).
// When subtotals are embedded in `rows`, parent headers ARE the subtotal rows
// for their depth — we don't synthesize duplicates. When subtotals are not
// embedded (toggle OFF), we synthesize a parent row at each level on prefix
// change.
function buildTreeRows(
  rows: GroupByRow[],
  aggFn: AggFn,
  categoryDepth: number,
  subtotalsEmbedded: boolean,
): TreeNode[] {
  if (rows.length === 0 || categoryDepth <= 1) {
    // Single category: tree view degenerates to flat — just emit leaves as-is.
    return rows.map((r) => ({
      kind: "leaf",
      depth: 0,
      prefixKey: r.keys.join(" "),
      displays: r.displays,
      value: r.value,
      count: r.count,
      isParent: false,
    }));
  }

  const out: TreeNode[] = [];

  if (subtotalsEmbedded) {
    // Use subtotal rows from lib as parent headers. Just classify each row.
    for (const r of rows) {
      if (r.subtotalDepth !== undefined && r.subtotalDepth >= 0) {
        out.push({
          kind: "subtotal",
          depth: r.subtotalDepth,
          prefixKey: r.keys.slice(0, r.subtotalDepth + 1).join(" "),
          displays: r.displays.map((d, i) =>
            i === r.subtotalDepth ? d + SUBTOTAL_LABEL_SUFFIX : d,
          ),
          value: r.value,
          count: r.count,
          isParent: true,
        });
      } else {
        out.push({
          kind: "leaf",
          depth: categoryDepth - 1,
          prefixKey: r.keys.join(" "),
          displays: r.displays,
          value: r.value,
          count: r.count,
          isParent: false,
        });
      }
    }
    return out;
  }

  // Subtotals OFF: synthesize parent rows at each depth on prefix change.
  // Walk leaves; track parent run starts at each level.
  const leafRuns: number[] = new Array(categoryDepth - 1).fill(0);
  const emitParentBefore = (
    leafIdx: number,
    d: number,
  ) => {
    // Emit a parent row at depth d for the new group starting at leafIdx.
    // Look ahead to find this group's end (next leaf where prefix at d changes).
    let endIdx = leafIdx;
    while (endIdx + 1 < rows.length) {
      const a = rows[endIdx + 1].keys;
      const b = rows[leafIdx].keys;
      let same = true;
      for (let i = 0; i <= d; i++) {
        if (a[i] !== b[i]) {
          same = false;
          break;
        }
      }
      if (!same) break;
      endIdx++;
    }
    const slice = rows.slice(leafIdx, endIdx + 1);
    const { value, count } = rollupForTree(aggFn, slice);
    const displays = new Array<string>(categoryDepth).fill("");
    for (let i = 0; i <= d; i++) displays[i] = rows[leafIdx].displays[i];
    out.push({
      kind: "parent",
      depth: d,
      prefixKey: rows[leafIdx].keys.slice(0, d + 1).join(" "),
      displays,
      value,
      count,
      isParent: true,
    });
  };

  for (let i = 0; i < rows.length; i++) {
    const cur = rows[i];
    // Determine deepest parent depth that newly opens at this leaf.
    if (i === 0) {
      // Open all parent levels.
      for (let d = 0; d < categoryDepth - 1; d++) {
        emitParentBefore(i, d);
        leafRuns[d] = i;
      }
    } else {
      const prev = rows[i - 1];
      // Find first differing depth in [0..categoryDepth-2].
      let firstDiff = categoryDepth - 1;
      for (let d = 0; d < categoryDepth - 1; d++) {
        if (cur.keys[d] !== prev.keys[d]) {
          firstDiff = d;
          break;
        }
      }
      if (firstDiff < categoryDepth - 1) {
        for (let d = firstDiff; d < categoryDepth - 1; d++) {
          emitParentBefore(i, d);
          leafRuns[d] = i;
        }
      }
    }
    out.push({
      kind: "leaf",
      depth: categoryDepth - 1,
      prefixKey: cur.keys.join(" "),
      displays: cur.displays,
      value: cur.value,
      count: cur.count,
      isParent: false,
    });
  }

  void leafRuns;
  return out;
}

// A row is hidden if any of its ancestor prefixes is in `collapsed`.
function isRowHidden(
  node: TreeNode,
  collapsed: Set<string>,
): boolean {
  // ancestors: prefixes at depth 0..node.depth-1
  const fullKeys = node.prefixKey.split(" ");
  for (let d = 0; d < node.depth; d++) {
    const prefix = fullKeys.slice(0, d + 1).join(" ");
    if (collapsed.has(prefix)) return true;
  }
  // The node itself is visible iff none of its STRICT ancestors are collapsed.
  // A parent row at its own depth is visible even if collapsed (it's the toggle).
  return false;
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
  const [categoryCols, setCategoryCols] = useState<number[]>([bounds.c1]);
  const [valueCol, setValueCol] = useState<number>(() =>
    pickDefaultValueCol(sheet, bounds, bounds.c1),
  );
  const [viewMode, setViewMode] = useState<"tree" | "flat">("tree");
  const [includeSubtotals, setIncludeSubtotals] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [copyFormat, setCopyFormat] = useState<CopyFormat>(readStoredCopyFormat);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(COPY_FORMAT_KEY, copyFormat);
    } catch {
      // ignore
    }
  }, [copyFormat]);

  // Reset on bounds shape change.
  useEffect(() => {
    setCategoryCols([bounds.c1]);
    setValueCol(pickDefaultValueCol(sheet, bounds, bounds.c1));
    setAggFn("sum");
    setViewMode("tree");
    setIncludeSubtotals(false);
    setCollapsed(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey]);

  const categoryColsKey = categoryCols.join(",");

  // Reset collapse on categoryCols change — prefix keys invalidated.
  useEffect(() => {
    setCollapsed(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryColsKey]);

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

  const fieldsByCol = useMemo(() => {
    const m = new Map<number, FieldDescriptor>();
    for (const f of resolved.fields) m.set(f.col, f);
    return m;
  }, [resolved.fields]);

  // Keep current picks valid against resolved fields.
  useEffect(() => {
    setCategoryCols((arr) => {
      const filtered = arr.filter((c) => fieldsByCol.has(c));
      if (filtered.length === 0 && resolved.fields[0]) {
        return [resolved.fields[0].col];
      }
      return filtered.length !== arr.length ? filtered : arr;
    });
    setValueCol((cur) => {
      if (fieldsByCol.has(cur)) return cur;
      const fallback = resolved.fields.find((f) => !categoryCols.includes(f.col));
      return fallback ? fallback.col : (resolved.fields[0]?.col ?? cur);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldsByCol]);

  const headerInsideSelection =
    headerRow !== null &&
    headerRow >= bounds.r1 &&
    headerRow <= bounds.r2;

  const result = useMemo(
    () =>
      computeGroupBySummary(sheet, bounds, {
        aggFn,
        categoryCols,
        valueCol,
        excludeRow: resolved.excludeRow,
        includeSubtotals,
      }),
    [
      sheet,
      bounds,
      aggFn,
      categoryColsKey,
      valueCol,
      resolved.excludeRow,
      includeSubtotals,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ],
  );

  const catLabels = categoryCols.map(
    (c) => fieldsByCol.get(c)?.label ?? columnLetter(c),
  );
  const valueLabel = fieldsByCol.get(valueCol)?.label ?? "Value";
  const valueHeader = buildValueHeader(aggFn, valueLabel);

  const handleCopyMarkdown = useCallback(async () => {
    if (result.rows.length === 0) {
      toast.message("Nothing to copy");
      return;
    }
    try {
      const text = formatGroupByMarkdown(result, catLabels, valueHeader);
      await navigator.clipboard.writeText(text);
      const suffix = result.truncated ? " (truncated)" : "";
      toast.success(
        `Copied ${result.totalGroups} group${result.totalGroups === 1 ? "" : "s"} as markdown${suffix}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Copy failed", { description: msg });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, catLabels.join("|"), valueHeader]);

  const handleCopyTSV = useCallback(async () => {
    if (result.rows.length === 0) {
      toast.message("Nothing to copy");
      return;
    }
    try {
      const text = formatGroupByTSV(result, catLabels, valueHeader);
      await navigator.clipboard.writeText(text);
      const suffix = result.truncated ? " (truncated)" : "";
      toast.success(
        `Copied ${result.totalGroups} group${result.totalGroups === 1 ? "" : "s"} as TSV${suffix}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Copy failed", { description: msg });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, catLabels.join("|"), valueHeader]);

  const handleCopyImage = useCallback(async () => {
    if (result.rows.length === 0 || result.tooLarge) {
      toast.message("Nothing to copy");
      return;
    }
    const node = tableContainerRef.current;
    if (!node) {
      toast.error("Copy failed", { description: "Table not ready" });
      return;
    }

    const originalMaxHeight = node.style.maxHeight;
    const originalOverflow = node.style.overflow;
    node.style.maxHeight = "none";
    node.style.overflow = "visible";

    try {
      const res = await copyNodeAsImage(node);
      if (res.ok) {
        const suffix = result.truncated ? " (truncated)" : "";
        toast.success(
          `Copied ${result.totalGroups} group${result.totalGroups === 1 ? "" : "s"} as image${suffix}`,
        );
      } else {
        toast.error("Copy failed", {
          description: res.error ?? "Unknown error",
        });
      }
    } finally {
      node.style.maxHeight = originalMaxHeight;
      node.style.overflow = originalOverflow;
    }
  }, [result]);

  const effectiveCopyFormat: CopyFormat =
    copyFormat === "image" && result.tooLarge ? "markdown" : copyFormat;

  const handleCopySelected = useCallback(() => {
    if (effectiveCopyFormat === "markdown") void handleCopyMarkdown();
    else if (effectiveCopyFormat === "tsv") void handleCopyTSV();
    else void handleCopyImage();
  }, [
    effectiveCopyFormat,
    handleCopyMarkdown,
    handleCopyTSV,
    handleCopyImage,
  ]);

  const onPickCopyFormat = useCallback(
    (next: CopyFormat) => {
      setCopyFormat(next);
      if (next === "markdown") void handleCopyMarkdown();
      else if (next === "tsv") void handleCopyTSV();
      else void handleCopyImage();
    },
    [handleCopyMarkdown, handleCopyTSV, handleCopyImage],
  );

  // Category picker handlers.
  const updateCategoryCol = useCallback((idx: number, newCol: number) => {
    setCategoryCols((arr) => arr.map((c, i) => (i === idx ? newCol : c)));
  }, []);

  const removeCategoryCol = useCallback((idx: number) => {
    setCategoryCols((arr) => {
      if (arr.length <= 1) return arr;
      return arr.filter((_, i) => i !== idx);
    });
  }, []);

  const addCategoryCol = useCallback(() => {
    setCategoryCols((arr) => {
      if (arr.length >= MAX_CATEGORY_FIELDS) return arr;
      const used = new Set(arr);
      const next = resolved.fields.find((f) => !used.has(f.col));
      if (!next) return arr;
      return [...arr, next.col];
    });
  }, [resolved.fields]);

  const toggleCollapsed = useCallback((prefixKey: string) => {
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(prefixKey)) next.delete(prefixKey);
      else next.add(prefixKey);
      return next;
    });
  }, []);

  // Tree rows (built for tree view).
  const treeRows = useMemo(() => {
    if (viewMode !== "tree") return [];
    return buildTreeRows(
      result.rows,
      aggFn,
      categoryCols.length,
      includeSubtotals,
    );
  }, [viewMode, result.rows, aggFn, categoryCols.length, includeSubtotals]);

  const visibleTreeRows = useMemo(
    () => treeRows.filter((n) => !isRowHidden(n, collapsed)),
    [treeRows, collapsed],
  );

  if (!hasMultipleCols || !hasMultipleRows) return null;

  const canAddCategory =
    categoryCols.length < MAX_CATEGORY_FIELDS &&
    categoryCols.length < resolved.fields.length;

  return (
    <div
      data-testid="summary-panel"
      className="flex shrink-0 flex-col border-t border-border bg-card/30"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-start gap-2 px-3 py-2 border-b border-border/60">
        <Sigma className="h-3.5 w-3.5 text-foreground/70 mt-1.5" />
        <span className="text-xs font-medium text-foreground/80 mt-1.5 whitespace-nowrap">
          Group-by summary
        </span>

        <div className="flex flex-col gap-1 ml-2">
          {/* Aggregate row */}
          <div className="flex items-center gap-1.5">
            <FieldPicker
              label="Aggregate"
              current={AGG_LABELS[aggFn]}
              options={AGG_OPTIONS.map((a) => ({
                value: a,
                label: AGG_LABELS[a],
              }))}
              value={aggFn}
              onChange={(v) => setAggFn(v as AggFn)}
            />
            <FieldPicker
              label="of"
              current={valueLabel}
              options={resolved.fields.map((f) => ({
                value: String(f.col),
                label: f.label,
              }))}
              value={String(valueCol)}
              onChange={(v) => setValueCol(Number(v))}
            />
          </div>

          {/* Category rows */}
          {categoryCols.map((col, idx) => {
            const used = new Set(categoryCols);
            const opts = resolved.fields
              .filter((f) => !used.has(f.col) || f.col === col)
              .map((f) => ({ value: String(f.col), label: f.label }));
            return (
              <div key={idx} className="flex items-center gap-1.5">
                <FieldPicker
                  label={idx === 0 ? "Group by" : `Sub ${idx}`}
                  current={fieldsByCol.get(col)?.label ?? columnLetter(col)}
                  options={opts}
                  value={String(col)}
                  onChange={(v) => updateCategoryCol(idx, Number(v))}
                />
                {categoryCols.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeCategoryCol(idx)}
                    title="Remove this category"
                    aria-label="Remove category"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}

          {canAddCategory && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={addCategoryCol}
              className="self-start text-muted-foreground"
              title={`Add sub-category (up to ${MAX_CATEGORY_FIELDS - 1})`}
            >
              <Plus className="h-3 w-3" />
              <span>Add sub-category</span>
            </Button>
          )}
        </div>

        <div className="ml-auto flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="inline-flex rounded-md border border-border overflow-hidden text-[11px]">
              <button
                type="button"
                onClick={() => setViewMode("tree")}
                className={`px-2 py-0.5 ${
                  viewMode === "tree"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
                title="Collapsible tree view"
              >
                Tree
              </button>
              <button
                type="button"
                onClick={() => setViewMode("flat")}
                className={`px-2 py-0.5 ${
                  viewMode === "flat"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
                title="Hierarchical flat view (Excel-style indent)"
              >
                Flat
              </button>
            </div>

            <label
              className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer select-none"
              title="Show subtotal rows for parent groups"
            >
              <input
                type="checkbox"
                checked={includeSubtotals}
                onChange={(e) => setIncludeSubtotals(e.target.checked)}
                disabled={categoryCols.length < 2}
                className="h-3 w-3 accent-primary"
              />
              Subtotals
            </label>

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
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-stretch overflow-hidden rounded-md border border-border">
              <Button
                data-testid="summary-copy-btn"
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleCopySelected}
                disabled={
                  result.rows.length === 0 ||
                  (effectiveCopyFormat === "image" && result.tooLarge)
                }
                className="rounded-none border-0"
                title={`Copy as ${
                  effectiveCopyFormat === "markdown"
                    ? "Markdown"
                    : effectiveCopyFormat === "tsv"
                      ? "TSV"
                      : "Image"
                }`}
              >
                {effectiveCopyFormat === "image" ? (
                  <ImageDown className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                <span>
                  Copy{" "}
                  {effectiveCopyFormat === "markdown"
                    ? "Markdown"
                    : effectiveCopyFormat === "tsv"
                      ? "TSV"
                      : "Image"}
                </span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={result.rows.length === 0}
                    className="rounded-none border-0 border-l border-border"
                    title="Choose copy format"
                    aria-label="Choose copy format"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-36 min-w-36"
                >
                  <DropdownMenuRadioGroup
                    value={copyFormat}
                    onValueChange={(v) => onPickCopyFormat(v as CopyFormat)}
                  >
                    <DropdownMenuRadioItem
                      value="markdown"
                      className="text-xs"
                    >
                      <Copy className="size-3" /> Markdown
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="tsv" className="text-xs">
                      <Copy className="size-3" /> TSV
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="image"
                      disabled={result.tooLarge}
                      className="text-xs"
                    >
                      <ImageDown className="size-3" /> Image
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
      </div>

      <div ref={tableContainerRef} className="max-h-64 overflow-auto">
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
        ) : viewMode === "tree" ? (
          <TreeTable
            rows={visibleTreeRows}
            catLabels={catLabels}
            valueHeader={valueHeader}
            collapsed={collapsed}
            onToggle={toggleCollapsed}
          />
        ) : (
          <FlatTable
            rows={result.rows}
            catLabels={catLabels}
            valueHeader={valueHeader}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1.5 border-t border-border/60 text-[11px] text-muted-foreground">
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
              showing top {Math.min(result.totalGroups, 200)} of{" "}
              {result.totalGroups}
            </span>
          </>
        )}
        {result.truncated && includeSubtotals && (
          <>
            <span>·</span>
            <span title="Subtotal values reflect the visible leaves only">
              subtotals over visible leaves only
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Render helpers ──────────────────────────────────────────────────────────

interface FlatTableProps {
  rows: GroupByRow[];
  catLabels: string[];
  valueHeader: string;
}

function FlatTable({ rows, catLabels, valueHeader }: FlatTableProps) {
  // For each row, blank out displays[d] when same as previous row's displays[d]
  // (Excel pivot "compact" indent style). Subtotal rows render as-is and reset
  // the blank-out tracking.
  let prev: string[] = [];
  return (
    <table data-testid="summary-table" className="w-full text-xs">
      <thead className="sticky top-0 bg-muted/40 backdrop-blur-sm">
        <tr className="text-foreground/70">
          {catLabels.map((l, i) => (
            <th
              key={i}
              className="text-left font-medium px-3 py-1.5 border-b border-border/60"
            >
              {l}
            </th>
          ))}
          <th className="text-right font-medium px-3 py-1.5 border-b border-border/60 tabular-nums">
            {valueHeader}
          </th>
          <th className="text-right font-medium px-3 py-1.5 border-b border-border/60 tabular-nums w-16">
            N
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => {
          const isSubtotal =
            r.subtotalDepth !== undefined && r.subtotalDepth >= 0;
          let cells: string[];
          if (isSubtotal) {
            cells = r.displays.map((d, i) =>
              i === r.subtotalDepth ? d + SUBTOTAL_LABEL_SUFFIX : d,
            );
            prev = []; // Reset blank-out after subtotal break.
          } else {
            cells = r.displays.map((d, i) => (prev[i] === d ? "" : d));
            prev = r.displays.slice();
          }
          const key = `${idx}:${r.keys.join(" ")}:${r.subtotalDepth ?? "L"}`;
          return (
            <tr
              key={key}
              className={
                isSubtotal
                  ? "bg-muted/30 font-medium text-foreground/90"
                  : "hover:bg-muted/30"
              }
            >
              {cells.map((c, i) => (
                <td key={i} className="px-3 py-1 text-foreground/90">
                  {c}
                </td>
              ))}
              <td className="px-3 py-1 text-right font-mono tabular-nums">
                {formatStatNumber(r.value)}
              </td>
              <td className="px-3 py-1 text-right font-mono tabular-nums text-muted-foreground">
                {r.count}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface TreeTableProps {
  rows: TreeNode[];
  catLabels: string[];
  valueHeader: string;
  collapsed: Set<string>;
  onToggle: (prefixKey: string) => void;
}

function TreeTable({
  rows,
  catLabels,
  valueHeader,
  collapsed,
  onToggle,
}: TreeTableProps) {
  return (
    <table data-testid="summary-table" className="w-full text-xs">
      <thead className="sticky top-0 bg-muted/40 backdrop-blur-sm">
        <tr className="text-foreground/70">
          <th
            colSpan={catLabels.length}
            className="text-left font-medium px-3 py-1.5 border-b border-border/60"
          >
            {catLabels.join(" › ")}
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
        {rows.map((n, idx) => {
          const isOpen = !collapsed.has(n.prefixKey);
          const isToggleable = n.isParent;
          // Label = the deepest non-empty display cell.
          let label = "";
          for (let i = n.displays.length - 1; i >= 0; i--) {
            if (n.displays[i]) {
              label = n.displays[i];
              break;
            }
          }
          return (
            <tr
              key={`${idx}:${n.prefixKey}:${n.kind}:${n.depth}`}
              className={
                n.kind === "subtotal"
                  ? "bg-muted/30 font-medium text-foreground/90"
                  : n.kind === "parent"
                    ? "bg-muted/20 font-medium text-foreground/90 hover:bg-muted/40 cursor-pointer"
                    : "hover:bg-muted/30"
              }
              onClick={
                isToggleable ? () => onToggle(n.prefixKey) : undefined
              }
            >
              <td
                colSpan={catLabels.length}
                className="px-3 py-1 text-foreground/90"
                style={{ paddingLeft: 12 + n.depth * TREE_INDENT_PX }}
              >
                <span className="inline-flex items-center gap-1">
                  {isToggleable ? (
                    isOpen ? (
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )
                  ) : (
                    <span className="inline-block w-3" />
                  )}
                  {label}
                </span>
              </td>
              <td className="px-3 py-1 text-right font-mono tabular-nums">
                {formatStatNumber(n.value)}
              </td>
              <td className="px-3 py-1 text-right font-mono tabular-nums text-muted-foreground">
                {n.count}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
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
