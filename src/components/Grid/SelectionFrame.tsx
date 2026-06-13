import {
  selectionRowSpan,
  type Bounds,
  type Selection,
} from "./grid-utils";

export interface SelectionFrameProps {
  bounds: Bounds | null;
  mode: Selection["mode"] | null;
  widths: number[];
  cumColX: number[];
  visiblePos: Map<number, number>;
  measurements: ReadonlyArray<{
    index: number;
    start: number;
    end: number;
    size: number;
  }>;
  leftOffset: number;
}

export function SelectionFrame({
  bounds,
  mode,
  widths,
  cumColX,
  visiblePos,
  measurements,
  leftOffset,
}: SelectionFrameProps) {
  if (!bounds || !mode) return null;

  const span = selectionRowSpan(bounds.r1, bounds.r2, visiblePos, measurements);
  if (!span) return null;
  const top = span.top;
  const height = Math.max(0, span.bottom - top);

  const left = leftOffset + (cumColX[bounds.c1] ?? 0);
  const width = widths
    .slice(bounds.c1, bounds.c2 + 1)
    .reduce((a, b) => a + b, 0);

  const w = Math.round(width);
  const h = Math.round(height);
  const bottomY = h - 2; // nudge bottom edge up so it clears the next-row gridline
  const rightX = w - 2; // nudge right edge left so it clears the next-col gridline

  return (
    <svg
      aria-hidden
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{
        position: "absolute",
        top: Math.round(top),
        left: Math.round(left),
        // Pin to exact px in CSS too — a global `svg` reset can stretch the
        // element, scaling its coord system non-uniformly (long+thick horizontal
        // dashes, short+thin vertical). Explicit px + matching viewBox = 1:1.
        width: w,
        height: h,
        display: "block",
        pointerEvents: "none",
        zIndex: 18,
        overflow: "visible",
      }}
    >
      {/* Single rect inset so the 2px stroke stays inside the viewport (no
          right/bottom clipping) and clears the next row/col gridline.
          non-scaling-stroke keeps dashes uniform on all edges. */}
      <rect
        className="selection-ants"
        vectorEffect="non-scaling-stroke"
        x={1}
        y={1}
        width={Math.max(0, rightX - 1)}
        height={Math.max(0, bottomY - 1)}
      />
    </svg>
  );
}
