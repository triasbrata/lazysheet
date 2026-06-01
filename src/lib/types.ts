export type CellValue =
  | { t: "Empty" }
  | { t: "Text"; c: string }
  | { t: "Number"; c: number }
  | { t: "Integer"; c: number }
  | { t: "Bool"; c: boolean }
  | { t: "Date"; c: string }
  | { t: "Error"; c: string };

export interface CellStyle {
  bg?: string;
  fg?: string;
  bold?: boolean;
  italic?: boolean;
  wrap?: boolean;
  align_h?: string;
  align_v?: string;
  font_size?: number;
  font_name?: string;
}

export interface CellModel {
  v: CellValue;
  s?: CellStyle;
  h?: string;
  /** Formula source incl. leading "=", e.g. "=SUM(A1:A5)". Present only for formula cells (xlsx/xlsm). */
  f?: string;
}

export interface MergeRange {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export interface SheetSummary {
  name: string;
  index: number;
}

export interface SheetModel {
  name: string;
  rows: CellModel[][];
  col_widths: number[];
  row_heights: number[];
  merges: MergeRange[];
  frozen_rows: number;
  frozen_cols: number;
  max_col: number;
}

export interface WorkbookModel {
  path: string;
  file_name: string;
  sheets: SheetSummary[];
  active_sheet: SheetModel;
}

export function cellText(c: CellModel): string {
  switch (c.v.t) {
    case "Empty":
      return "";
    case "Text":
    case "Date":
    case "Error":
      return c.v.c;
    case "Number":
      return formatNumber(c.v.c);
    case "Integer":
      return String(c.v.c);
    case "Bool":
      return c.v.c ? "TRUE" : "FALSE";
  }
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}
