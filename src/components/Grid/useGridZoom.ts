import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { zoomFromWheel } from "@/lib/zoom";

export function useGridZoom(opts: {
  scrollRef: RefObject<HTMLDivElement | null>;
  zoom: number;
  onZoomChange: ((next: number) => void) | undefined;
}): void {
  const { scrollRef, zoom, onZoomChange } = opts;

  // Latest zoom held in a ref so the wheel listener reads the current value
  // without re-binding on every zoom tick (effect deps stay [onZoomChange]).
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // ── Ctrl+wheel / pinch zoom ───────────────────────────────────────────────
  // macOS translates touchpad pinch into `wheel` events with ctrlKey=true, so
  // this ONE native listener covers both Ctrl+scroll and pinch-to-zoom. It must
  // be a native listener with { passive: false } — React's synthetic onWheel is
  // passive and cannot preventDefault(), which is required to block the Tauri
  // WKWebView's built-in native page zoom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !onZoomChange) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // normal scroll passes through untouched
      e.preventDefault(); // blocks WKWebView native page zoom (and pinch zoom)
      onZoomChange(zoomFromWheel(zoomRef.current, e.deltaY));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [onZoomChange]);
}
