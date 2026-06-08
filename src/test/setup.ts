import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// @tanstack/virtual-core schedules a debounced isScrollingReset callback via
// window.setTimeout and never cancels it on unmount. If the jsdom environment
// is torn down before it fires, the callback reaches react-dom and throws an
// uncaught "ReferenceError: window is not defined". Track timers scheduled on
// window and clear any still pending after each test so none outlive the
// environment.
const pendingWindowTimeouts = new Set<number>();
if (typeof window !== "undefined") {
  const origSetTimeout = window.setTimeout.bind(window);
  const origClearTimeout = window.clearTimeout.bind(window);
  window.setTimeout = ((...args: Parameters<typeof window.setTimeout>) => {
    const id = origSetTimeout(...args);
    pendingWindowTimeouts.add(id);
    return id;
  }) as typeof window.setTimeout;
  window.clearTimeout = ((id?: number) => {
    if (id !== undefined) pendingWindowTimeouts.delete(id);
    origClearTimeout(id);
  }) as typeof window.clearTimeout;
}

// With globals:false RTL does not auto-register cleanup; unmount after each test
// so the jsdom DOM does not accumulate (otherwise "found multiple elements").
afterEach(() => {
  cleanup();
  if (typeof window !== "undefined") {
    for (const id of pendingWindowTimeouts) {
      window.clearTimeout(id);
    }
  }
  pendingWindowTimeouts.clear();
});

// window.matchMedia polyfill
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// ResizeObserver polyfill
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// IntersectionObserver polyfill
if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class IntersectionObserver {
    readonly root: Element | null = null;
    readonly rootMargin: string = "";
    readonly thresholds: ReadonlyArray<number> = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  };
}

// Element.prototype.scrollTo polyfill
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function () {};
}

// Element.prototype.scrollIntoView polyfill
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}

// Element.prototype.scrollBy polyfill (jsdom gap; used by Grid auto-scroll)
if (!Element.prototype.scrollBy) {
  Element.prototype.scrollBy = function () {};
}

// document.elementFromPoint polyfill — jsdom lacks it; Grid's auto-scroll RAF
// loop may fire as a microtask after a test completes and would otherwise throw
// an unhandled "elementFromPoint is not a function" (fails the process exit code).
if (typeof document !== "undefined" && !document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

// Radix UI Select/Popover pointer capture stubs (jsdom gap)
if (!HTMLElement.prototype.hasPointerCapture) {
  HTMLElement.prototype.hasPointerCapture = () => false;
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = () => {};
}
if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => {};
}

// ClipboardItem polyfill
if (!globalThis.ClipboardItem) {
  globalThis.ClipboardItem = class ClipboardItem {
    constructor(_data: Record<string, unknown>) {}
  } as unknown as typeof ClipboardItem;
}

// navigator.clipboard polyfill
if (typeof navigator !== "undefined") {
  const hasClipboard =
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function" &&
    typeof navigator.clipboard.write === "function";

  if (!hasClipboard) {
    const clipboardStub = {
      writeText: async (_text: string): Promise<void> => Promise.resolve(),
      write: async (_data: unknown[]): Promise<void> => Promise.resolve(),
      readText: async (): Promise<string> => Promise.resolve(""),
      read: async (): Promise<unknown[]> => Promise.resolve([]),
    };

    try {
      Object.defineProperty(navigator, "clipboard", {
        value: clipboardStub,
        writable: true,
        configurable: true,
      });
    } catch {
      // ignore if already defined and non-configurable
    }
  }
}

// document.fonts polyfill
if (typeof document !== "undefined" && !document.fonts) {
  Object.defineProperty(document, "fonts", {
    value: {
      ready: Promise.resolve(undefined as unknown as FontFaceSet),
      load: () => Promise.resolve([]),
      check: () => true,
    },
    writable: true,
    configurable: true,
  });
}

// requestAnimationFrame / cancelAnimationFrame polyfill
if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number =>
    setTimeout(() => callback(Date.now()), 0) as unknown as number;
}

if (!globalThis.cancelAnimationFrame) {
  globalThis.cancelAnimationFrame = (handle: number): void => {
    clearTimeout(handle);
  };
}
