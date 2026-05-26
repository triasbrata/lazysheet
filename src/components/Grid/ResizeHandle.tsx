import { useCallback, useEffect, useRef, useState } from "react";
import { clampResize } from "@/components/Grid/grid-utils";

export type ResizeOrientation = "col" | "row";

interface DragState {
  pointerId: number;
  start: number;
  startSize: number;
  lastSize: number;
}

interface ResizeHandleProps {
  orientation: ResizeOrientation;
  index: number;
  currentSize: number;
  disabled?: boolean;
  onPreview: (
    orientation: ResizeOrientation,
    index: number,
    size: number,
  ) => void;
  onCommit: (
    orientation: ResizeOrientation,
    index: number,
    size: number,
  ) => void;
}

export function ResizeHandle({
  orientation,
  index,
  currentSize,
  disabled,
  onPreview,
  onCommit,
}: ResizeHandleProps) {
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);

  const setBodyCursor = useCallback(
    (cursor: string) => {
      document.body.style.cursor = cursor;
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.button !== 0) return; // primary button only
      e.stopPropagation();
      e.preventDefault();
      const start = orientation === "col" ? e.clientX : e.clientY;
      dragRef.current = {
        pointerId: e.pointerId,
        start,
        startSize: currentSize,
        lastSize: currentSize,
      };
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      setBodyCursor(orientation === "col" ? "col-resize" : "row-resize");
      setDragging(true);
    },
    [disabled, orientation, currentSize, setBodyCursor],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const ds = dragRef.current;
      if (!ds) return;
      const point = orientation === "col" ? e.clientX : e.clientY;
      const delta = point - ds.start;
      const next = clampResize(ds.startSize + delta);
      if (next === ds.lastSize) return;
      ds.lastSize = next;
      onPreview(orientation, index, next);
    },
    [orientation, index, onPreview],
  );

  const finishDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, commit: boolean) => {
      const ds = dragRef.current;
      if (!ds) return;
      try {
        (e.currentTarget as HTMLDivElement).releasePointerCapture(ds.pointerId);
      } catch {
        // already released
      }
      const finalSize = ds.lastSize;
      const startSize = ds.startSize;
      dragRef.current = null;
      setBodyCursor("");
      setDragging(false);
      if (commit) {
        onCommit(orientation, index, finalSize);
      } else {
        // revert preview to original size
        onPreview(orientation, index, startSize);
      }
    },
    [orientation, index, onCommit, onPreview, setBodyCursor],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => finishDrag(e, true),
    [finishDrag],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => finishDrag(e, false),
    [finishDrag],
  );

  useEffect(() => {
    return () => {
      if (dragRef.current) {
        document.body.style.cursor = "";
      }
    };
  }, []);

  const handleStyle: React.CSSProperties =
    orientation === "col"
      ? {
          position: "absolute",
          right: -3,
          top: 0,
          width: 6,
          height: "100%",
          cursor: "col-resize",
          zIndex: 40,
          touchAction: "none",
        }
      : {
          position: "absolute",
          left: 0,
          bottom: -3,
          width: "100%",
          height: 6,
          cursor: "row-resize",
          zIndex: 40,
          touchAction: "none",
        };

  const lineClass =
    orientation === "col"
      ? `absolute inset-y-0 left-1/2 w-px -translate-x-1/2 ${
          dragging ? "bg-primary" : "bg-transparent hover:bg-primary/50"
        }`
      : `absolute inset-x-0 top-1/2 h-px -translate-y-1/2 ${
          dragging ? "bg-primary" : "bg-transparent hover:bg-primary/50"
        }`;

  return (
    <div
      role="separator"
      aria-orientation={orientation === "col" ? "vertical" : "horizontal"}
      aria-disabled={disabled || undefined}
      style={handleStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div className={lineClass} />
    </div>
  );
}
