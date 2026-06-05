// zoom.ts — Pure zoom math utilities for grid zoom level management.
// Handles clamping, smooth wheel/pinch zoom via exponential curve, step zoom,
// and display formatting. No side effects; all functions are pure.

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.0;
export const ZOOM_STEP = 0.1;
export const DEFAULT_ZOOM = 1.0;

/** Clamp z to [ZOOM_MIN, ZOOM_MAX], rounded to 2 decimal places. */
export function clampZoom(z: number): number {
  const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  return Math.round(clamped * 100) / 100;
}

/**
 * Compute next zoom from a wheel/trackpad deltaY event.
 *
 * Uses an exponential curve so pinch gestures (small deltas) and discrete
 * mouse wheel notches (~±100) both feel natural:
 *   factor = Math.exp(-deltaY * 0.0015)
 *
 * Negative deltaY = scroll up = zoom IN.
 * Snaps to exactly 1.0 when the result is within 0.02 of 1 to avoid floating
 * point drift at the 100% mark.
 */
export function zoomFromWheel(current: number, deltaY: number): number {
  const factor = Math.exp(-deltaY * 0.0015);
  let next = current * factor;
  if (Math.abs(next - 1) < 0.02) next = 1;
  return clampZoom(next);
}

/**
 * Step zoom by one ZOOM_STEP increment in the given direction.
 * direction: 1 = zoom in, -1 = zoom out.
 * Rounds to one decimal place to avoid floating point accumulation.
 */
export function stepZoom(current: number, direction: 1 | -1): number {
  return clampZoom(Math.round((current + direction * ZOOM_STEP) * 10) / 10);
}

/** Format a zoom level as a percentage string, e.g. 1 → "100%". */
export function formatZoomPercent(z: number): string {
  return `${Math.round(z * 100)}%`;
}

/**
 * CSS length that scales a logical px value by the grid zoom CSS var,
 * e.g. 12 → "calc(12px * var(--grid-zoom, 1))". Keeps render in sync with
 * measurement math, which stays in logical px.
 */
export function zoomScaledPx(px: number): string {
  return `calc(${px}px * var(--grid-zoom, 1))`;
}
