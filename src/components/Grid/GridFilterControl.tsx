import { Filter } from "lucide-react";
import { motion } from "motion/react";
import { ColumnFilterDropdown } from "./ColumnFilterDropdown";
import { columnLetter, FUNNEL_ICON_PX } from "./grid-utils";
import { zoomScaledPx } from "@/lib/zoom";
import type { ColumnFilter } from "@/lib/grid-filter";

export interface GridFilterControlProps {
  /** 0-indexed column index. */
  col: number;
  /** Whether the filter dropdown is currently open for this col+source. */
  isOpen: boolean;
  /** Called when the dropdown open state changes. */
  onOpenChange: (open: boolean) => void;
  /** The committed filter for this column (undefined = no filter). */
  colFilter: ColumnFilter | undefined;
  /** Distinct values shown in the filter panel (only populated when open). */
  distinctValues: string[];
  /** Called with the new filter when the user clicks OK. */
  onApply: (col: number, filter: ColumnFilter) => void;
  /** Optional icon colour (inherits if omitted). */
  iconColor?: string;
}

export function GridFilterControl({
  col,
  isOpen,
  onOpenChange,
  colFilter,
  distinctValues,
  onApply,
  iconColor,
}: GridFilterControlProps) {
  const filterIsActive =
    colFilter != null &&
    (colFilter.condition.op !== "none" || colFilter.excluded.length > 0);

  const funnelIconStyle = {
    width: zoomScaledPx(FUNNEL_ICON_PX),
    height: zoomScaledPx(FUNNEL_ICON_PX),
  } as const;

  return (
    <ColumnFilterDropdown
      open={isOpen}
      onOpenChange={(o) => onOpenChange(o)}
      columnLabel={columnLetter(col)}
      distinctValues={isOpen ? distinctValues : []}
      value={colFilter ?? { condition: { op: "none", operand: "" }, excluded: [] }}
      onApply={(f) => onApply(col, f)}
    >
      <button
        type="button"
        aria-label="Filter column"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onOpenChange(true); }}
        className="inline-flex items-center justify-center rounded transition-opacity hover:opacity-60"
        // Icon box + padding scale with zoom so the funnel matches the
        // FUNNEL_ALLOWANCE_X autofit reservation (logical px × zoom).
        style={{
          padding: zoomScaledPx(2),
          ...(iconColor ? { color: iconColor } : undefined),
        }}
      >
        {filterIsActive ? (
          <motion.span
            className="inline-flex"
            animate={{ scale: [1, 1.18, 1], opacity: [1, 0.55, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Filter style={funnelIconStyle} fill="currentColor" />
          </motion.span>
        ) : (
          <Filter style={funnelIconStyle} fill="currentColor" />
        )}
      </button>
    </ColumnFilterDropdown>
  );
}
