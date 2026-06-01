import type { CSSProperties, ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import type { CellModel } from "@/lib/types";
import { cellText } from "@/lib/types";
import { openExternal } from "@/lib/tauri-api";
import { FormulaBadge } from "./FormulaBadge";

// Normalize CRLF / lone CR to LF so `white-space: pre-wrap` doesn't produce
// double line breaks on Windows-authored files.
function normalizeNewlines(s: string): string {
  return s.replace(/\r\n?/g, "\n");
}

interface CellProps {
  cell: CellModel | undefined;
  width: number;
  minHeight: number;
  rowSpan?: number;
  colSpan?: number;
  spanWidth?: number;
  spanHeight?: number;
  isMerged?: boolean;
  placeholder?: boolean;
  absolute?: boolean;
  absoluteTop?: number;
  absoluteLeft?: number;
  // Force overflow:hidden on wrap content (safety net for absolute merge anchors
  // whose declared geometry may be smaller than wrapped text height).
  clipOverflow?: boolean;
  highlight?: "anchor" | "selected" | "match" | null;
  // Cell sits in the user-marked "header row" — draws a top accent stripe.
  inHeaderRow?: boolean;
  // Selection coords (0-indexed) used by Grid event delegation for click → select.
  dataRow?: number;
  dataCol?: number;
  // Right-pinned slot rendered after content (used for the header filter funnel).
  trailing?: ReactNode;
}

export function Cell({
  cell,
  width,
  minHeight,
  rowSpan = 1,
  colSpan = 1,
  spanWidth,
  spanHeight,
  isMerged = false,
  placeholder = false,
  absolute = false,
  absoluteTop,
  absoluteLeft,
  clipOverflow = false,
  highlight = null,
  inHeaderRow = false,
  dataRow,
  dataCol,
  trailing,
}: CellProps) {
  const w = spanWidth ?? width;
  const minH = spanHeight ?? minHeight;

  // Placeholder: reserve column space, no visible borders/content.
  // Used for absorbed-merge slots so the row's flex layout stays aligned.
  if (placeholder) {
    return (
      <div
        style={{
          width: w,
          minWidth: w,
          maxWidth: w,
          minHeight: minH,
          boxSizing: "border-box",
        }}
      />
    );
  }

  const s = cell?.s;
  const text = cell ? normalizeNewlines(cellText(cell)) : "";
  const isNumeric = cell?.v.t === "Number" || cell?.v.t === "Integer";
  const wrap = !!s?.wrap;

  const alignH = s?.align_h || (isNumeric ? "right" : "left");
  const alignV = s?.align_v || (isMerged ? "middle" : "middle");

  const justify =
    alignH === "center"
      ? "center"
      : alignH === "right"
        ? "flex-end"
        : "flex-start";

  const items =
    alignV === "top"
      ? "flex-start"
      : alignV === "bottom"
        ? "flex-end"
        : "center";

  const wrapClipped = wrap && clipOverflow;
  const baseStyle: CSSProperties = {
    width: w,
    minWidth: w,
    maxWidth: w,
    minHeight: minH,
    background: s?.bg,
    color: s?.fg,
    fontWeight: s?.bold ? 600 : undefined,
    fontStyle: s?.italic ? "italic" : undefined,
    fontSize: s?.font_size ? `${s.font_size}px` : undefined,
    fontFamily: s?.font_name,
    boxSizing: "border-box",
    // Keep in sync with measure.ts DEFAULT_PADDING_X/Y (halfX=10, halfY=6).
    padding: "6px 10px",
    borderRight: "1px solid var(--border)",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: items,
    justifyContent: justify,
    textAlign: alignH as CSSProperties["textAlign"],
    overflow: wrap ? (clipOverflow ? "hidden" : "visible") : "hidden",
    // Stacking only matters for absolute-positioned merge anchors (over row map).
    // In-flow merged cells participate in normal flex flow and need no z-index.
    zIndex: absolute && isMerged ? 15 : undefined,
  };

  if (absolute) {
    baseStyle.position = "absolute";
    baseStyle.top = absoluteTop;
    baseStyle.left = absoluteLeft;
  } else {
    baseStyle.position = "relative";
  }

  if (highlight === "anchor") {
    // Single-cell selection — marching-ants frame (z-index 18) draws the border;
    // no bg tint, and NO z-index bump: a raised anchor cell would paint over the
    // frame and hide it (the frame's edges sit on this single cell's bounds).
  } else if (highlight === "selected") {
    // No background tint — the animated marching-ants frame marks the range.
  } else if (highlight === "match") {
    baseStyle.background = "color-mix(in oklab, var(--primary) 10%, transparent)";
  }

  // Header-row accent — top stripe. Skip when an outline highlight already
  // dominates the cell (anchor outline / range frame) to avoid stacked borders.
  if (inHeaderRow && highlight !== "anchor") {
    baseStyle.borderTop =
      "2px solid color-mix(in oklab, var(--primary) 45%, transparent)";
    if (!baseStyle.background) {
      baseStyle.background =
        "color-mix(in oklab, var(--primary) 6%, transparent)";
    }
  }

  const innerStyle: CSSProperties = {
    // Flex item that fills available width but shrinks when a `trailing` slot
    // (header funnel) shares the row, keeping the funnel visible.
    flex: "1 1 0",
    minWidth: 0,
    whiteSpace: wrap ? "pre-wrap" : "nowrap",
    overflow: wrap ? (wrapClipped ? "hidden" : "visible") : "hidden",
    textOverflow: wrap ? undefined : "ellipsis",
    wordBreak: wrap ? "break-word" : undefined,
    lineHeight: wrap ? 1.35 : undefined,
  };

  const content = cell?.h ? (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openExternal(cell.h!).catch(() => undefined);
      }}
      className={`inline-flex items-start gap-1 text-left underline decoration-dotted underline-offset-2 ${
        wrap ? "" : "truncate"
      }`}
      style={{
        color: s?.fg ?? "var(--primary)",
        maxWidth: "100%",
        whiteSpace: wrap ? "pre-wrap" : "nowrap",
        wordBreak: wrap ? "break-word" : undefined,
      }}
      title={cell.h}
    >
      <span
        style={{
          whiteSpace: wrap ? "pre-wrap" : "nowrap",
          overflow: wrap ? "visible" : "hidden",
          textOverflow: wrap ? undefined : "ellipsis",
        }}
      >
        {text}
      </span>
      <ExternalLink className="mt-[3px] h-2.5 w-2.5 shrink-0 opacity-50" />
    </button>
  ) : (
    <span style={innerStyle}>{text}</span>
  );

  return (
    <div
      style={baseStyle}
      data-row-span={rowSpan > 1 ? rowSpan : undefined}
      data-col-span={colSpan > 1 ? colSpan : undefined}
      data-r={dataRow}
      data-c={dataCol}
    >
      {content}
      {cell?.f ? <FormulaBadge formula={cell.f} /> : null}
      {trailing != null && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            alignSelf: "center",
            marginLeft: "auto",
            flexShrink: 0,
          }}
        >
          {trailing}
        </span>
      )}
    </div>
  );
}
