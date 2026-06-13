import { useMemo, useState } from "react";
import {
  buildMergeInfo,
  expandBoundsForMerges,
  selectionBounds,
  type Bounds,
  type FilterSource,
  type MergeInfo,
  type Selection,
} from "./grid-utils";
import {
  buildMergedRowSet,
  columnDistinctValues,
  computeVisibleRows,
  headerGroups,
  type HeaderGroup,
  type SheetFilters,
} from "@/lib/grid-filter";
import type { SheetModel } from "@/lib/types";

export interface UseGridFiltersApi {
  merges: MergeInfo;
  filterGroups: HeaderGroup[];
  groupByAnchor: Map<number, HeaderGroup>;
  mergedRowSet: Set<number>;
  activeFilters: SheetFilters;
  visibleRowIndices: number[];
  visiblePos: Map<number, number>;
  openFilter: { col: number; source: FilterSource } | null;
  setOpenFilter: (v: { col: number; source: FilterSource } | null) => void;
  openFilterDistinct: string[];
  expandedBounds: Bounds | null;
}

export function useGridFilters(opts: {
  sheet: SheetModel;
  headerRow: number | null;
  totalRows: number;
  totalCols: number;
  filters: SheetFilters | undefined;
  selection: Selection | null | undefined;
}): UseGridFiltersApi {
  const { sheet, headerRow, totalRows, totalCols, filters, selection } = opts;

  // Merge map + header-group anchors — declared before the autofit orchestrator
  // because autofit reserves funnel space for funnel-bearing header columns.
  const merges = useMemo(() => buildMergeInfo(sheet.merges), [sheet.merges]);
  const filterGroups = useMemo(
    () => headerGroups(merges, headerRow, totalCols),
    [merges, headerRow, totalCols],
  );
  const groupByAnchor = useMemo(() => {
    const m = new Map<number, HeaderGroup>();
    for (const g of filterGroups) m.set(g.anchorCol, g);
    return m;
  }, [filterGroups]);

  // ── Filter-aware row visibility ─────────────────────────────────────────
  const mergedRowSet = useMemo(() => buildMergedRowSet(sheet.merges), [sheet.merges]);
  const activeFilters: SheetFilters = filters ?? {};
  const visibleRowIndices = useMemo(
    () => computeVisibleRows(sheet, mergedRowSet, headerRow, filterGroups, activeFilters, totalRows),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheet, mergedRowSet, headerRow, filterGroups, activeFilters, totalRows],
  );
  const visiblePos = useMemo(() => {
    const m = new Map<number, number>();
    visibleRowIndices.forEach((r, i) => m.set(r, i));
    return m;
  }, [visibleRowIndices]);

  // Which column's filter dropdown is currently open and from which trigger source.
  const [openFilter, setOpenFilter] = useState<{ col: number; source: FilterSource } | null>(null);

  // Distinct values for the currently-open column — computed lazily only when a dropdown is open.
  const openFilterDistinct = useMemo(() => {
    if (openFilter === null) return [];
    const g = groupByAnchor.get(openFilter.col);
    if (!g) return [];
    return columnDistinctValues(sheet, g, headerRow, totalRows, mergedRowSet);
  }, [openFilter, groupByAnchor, sheet, headerRow, totalRows, mergedRowSet]);

  // Expanded bounds — accounts for merges that intersect base selection.
  const expandedBounds: Bounds | null = useMemo(() => {
    if (!selection) return null;
    const base = selectionBounds(selection, totalRows, totalCols);
    return expandBoundsForMerges(base, merges);
  }, [selection, totalRows, totalCols, merges]);

  return {
    merges,
    filterGroups,
    groupByAnchor,
    mergedRowSet,
    activeFilters,
    visibleRowIndices,
    visiblePos,
    openFilter,
    setOpenFilter,
    openFilterDistinct,
    expandedBounds,
  };
}
