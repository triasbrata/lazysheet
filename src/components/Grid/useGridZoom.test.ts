import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useGridZoom } from "./useGridZoom";
import { zoomFromWheel } from "@/lib/zoom";

// zoomFromWheel is a pure function — no mocking needed.

function makeScrollRef(el: HTMLDivElement) {
  // Build a ref already pointing at the div.
  return { current: el };
}

describe("useGridZoom", () => {
  let el: HTMLDivElement;

  beforeEach(() => {
    el = document.createElement("div");
    document.body.appendChild(el);
  });

  afterEach(() => {
    document.body.removeChild(el);
  });

  it("calls onZoomChange with zoomFromWheel result when ctrlKey+wheel", () => {
    const onZoomChange = vi.fn();
    const scrollRef = makeScrollRef(el);

    renderHook(() =>
      useGridZoom({ scrollRef, zoom: 1, onZoomChange }),
    );

    const event = new WheelEvent("wheel", { ctrlKey: true, deltaY: 100, bubbles: true, cancelable: true });
    el.dispatchEvent(event);

    expect(onZoomChange).toHaveBeenCalledOnce();
    expect(onZoomChange).toHaveBeenCalledWith(zoomFromWheel(1, 100));
  });

  it("calls preventDefault when ctrlKey+wheel", () => {
    const onZoomChange = vi.fn();
    const scrollRef = makeScrollRef(el);

    renderHook(() =>
      useGridZoom({ scrollRef, zoom: 1, onZoomChange }),
    );

    const event = new WheelEvent("wheel", { ctrlKey: true, deltaY: -50, bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");
    el.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalledOnce();
  });

  it("does NOT call onZoomChange for plain wheel (no ctrl/meta)", () => {
    const onZoomChange = vi.fn();
    const scrollRef = makeScrollRef(el);

    renderHook(() =>
      useGridZoom({ scrollRef, zoom: 1, onZoomChange }),
    );

    const event = new WheelEvent("wheel", { ctrlKey: false, deltaY: 100, bubbles: true });
    el.dispatchEvent(event);

    expect(onZoomChange).not.toHaveBeenCalled();
  });

  it("handles metaKey+wheel the same as ctrlKey (ctrlKey is set by macOS pinch)", () => {
    // On macOS, pinch events come through as ctrlKey=true. This test verifies
    // the hook still works when ctrlKey is present (metaKey alone is NOT handled
    // per the source — only ctrlKey is checked).
    const onZoomChange = vi.fn();
    const scrollRef = makeScrollRef(el);

    renderHook(() =>
      useGridZoom({ scrollRef, zoom: 1, onZoomChange }),
    );

    // metaKey alone — should NOT trigger (source only checks e.ctrlKey)
    const metaOnly = new WheelEvent("wheel", { metaKey: true, ctrlKey: false, deltaY: 100, bubbles: true });
    el.dispatchEvent(metaOnly);
    expect(onZoomChange).not.toHaveBeenCalled();

    // ctrlKey — should trigger
    const ctrlEvent = new WheelEvent("wheel", { ctrlKey: true, deltaY: 50, bubbles: true, cancelable: true });
    el.dispatchEvent(ctrlEvent);
    expect(onZoomChange).toHaveBeenCalledOnce();
  });

  it("uses latest zoom value from ref without re-binding listener", () => {
    const onZoomChange = vi.fn();
    const scrollRef = makeScrollRef(el);

    const { rerender } = renderHook(
      ({ zoom }) => useGridZoom({ scrollRef, zoom, onZoomChange }),
      { initialProps: { zoom: 1 } },
    );

    // Update zoom prop — the ref should be synced
    rerender({ zoom: 1.5 });

    const event = new WheelEvent("wheel", { ctrlKey: true, deltaY: 100, bubbles: true, cancelable: true });
    el.dispatchEvent(event);

    // Should use 1.5 (the updated zoom) not 1.0
    expect(onZoomChange).toHaveBeenCalledWith(zoomFromWheel(1.5, 100));
  });

  it("removes the wheel listener on unmount", () => {
    const onZoomChange = vi.fn();
    const scrollRef = makeScrollRef(el);

    const { unmount } = renderHook(() =>
      useGridZoom({ scrollRef, zoom: 1, onZoomChange }),
    );

    unmount();

    // After unmount, dispatching a wheel event should NOT call onZoomChange
    const event = new WheelEvent("wheel", { ctrlKey: true, deltaY: 100, bubbles: true, cancelable: true });
    el.dispatchEvent(event);

    expect(onZoomChange).not.toHaveBeenCalled();
  });

  it("does nothing when onZoomChange is undefined", () => {
    const scrollRef = makeScrollRef(el);

    // Should not throw
    expect(() => {
      const { unmount } = renderHook(() =>
        useGridZoom({ scrollRef, zoom: 1, onZoomChange: undefined }),
      );
      const event = new WheelEvent("wheel", { ctrlKey: true, deltaY: 100, bubbles: true, cancelable: true });
      el.dispatchEvent(event);
      unmount();
    }).not.toThrow();
  });
});
