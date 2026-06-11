import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface MarqueeProps {
  text: string;
  className?: string;
  title?: string;
  "data-testid"?: string;
  "data-tauri-drag-region"?: boolean | "";
  speedPxPerSec?: number;
  /** When true, never animate — always render the static truncate branch. */
  disabled?: boolean;
}

export function Marquee({
  text,
  className,
  title,
  "data-testid": dataTestId,
  "data-tauri-drag-region": dataTauriDragRegion,
  speedPxPerSec = 40,
  disabled = false,
}: MarqueeProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [durationS, setDurationS] = useState(8);

  function measure() {
    if (!containerRef.current || !measureRef.current) return;
    const contentW = measureRef.current.scrollWidth;
    const boxW = containerRef.current.clientWidth;
    const over = contentW > boxW + 1;
    setOverflow(over);
    if (over) {
      const clamped = Math.min(Math.max(contentW / speedPxPerSec, 4), 30);
      setDurationS(clamped);
    }
  }

  useEffect(() => {
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speedPxPerSec]);

  const outerProps = {
    className: cn("overflow-hidden whitespace-nowrap", className),
    title,
    "data-testid": dataTestId,
    "data-tauri-drag-region": dataTauriDragRegion,
    ref: containerRef,
  };

  if (overflow && !disabled) {
    return (
      <span {...outerProps}>
        <span
          className="inline-flex w-max animate-marquee"
          style={{ ["--marquee-duration"]: durationS + "s" } as React.CSSProperties}
        >
          <span ref={measureRef} className="pr-8 pointer-events-none select-none">
            {text}
          </span>
          <span aria-hidden className="pr-8 pointer-events-none select-none">
            {text}
          </span>
        </span>
      </span>
    );
  }

  return (
    <span {...outerProps}>
      <span ref={measureRef} className="block truncate pointer-events-none select-none">
        {text}
      </span>
    </span>
  );
}
