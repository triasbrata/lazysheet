/**
 * preload.ts — bun test preload module (registered in bunfig.toml [test].preload).
 *
 * Execution order guaranteed by bun: runs once before any test file.
 *
 * CRITICAL design notes:
 *
 * 1. ALL imports that depend on globalThis.document must use require() so they execute
 *    AFTER GlobalRegistrator.register(). ES module static `import` statements are hoisted
 *    and evaluated before the module body, meaning @testing-library/dom's `screen` would
 *    see `typeof document === 'undefined'` and bake a broken stub.
 *
 * 2. bun test intercepts "vitest" imports at the runtime level with its own bun:test compat
 *    module. tsconfig paths cannot override this. The bun vi object is missing:
 *      stubGlobal, unstubAllGlobals, stubEnv, unstubAllEnvs, mocked, doMock, importFresh,
 *      toHaveBeenCalledOnce (matcher).
 *    Fix: EXTEND the bun vi object in-place in preload so all test files see the extended vi.
 *
 * 3. @testing-library/react auto-registers beforeAll/afterAll/afterEach at module load time.
 *    It must be loaded at preload module body level (not inside a test/afterEach callback),
 *    but AFTER happy-dom is set up (so document.body exists and screen works correctly).
 *    Use require() for all @testing-library imports.
 *
 * Order:
 * 1. happy-dom globals (GlobalRegistrator.register) — MUST be first
 * 2. Extend bun:test vi object with missing vitest APIs
 * 3. Env defaults
 * 4. IS_REACT_ACT_ENVIRONMENT
 * 5. jest-dom matchers extend (dynamic require — after DOM globals live)
 * 6. polyfills
 * 7. Load @testing-library/react (dynamic require — after DOM, so screen works)
 * 8. afterEach cleanup (C1 hygiene)
 */

// ── 1. happy-dom globals — MUST be first ─────────────────────────────────────
// Use require() to ensure it runs in module body order (not hoisted like ES imports).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GlobalRegistrator } = require("@happy-dom/global-registrator") as typeof import("@happy-dom/global-registrator");
GlobalRegistrator.register();

// ── 2. Extend bun vi with missing vitest APIs ─────────────────────────────────
// bun intercepts "vitest" imports at runtime with its own compat module (bun:test vi subset).
// tsconfig paths + mock.module cannot override this for static ES imports.
// Solution: mutate the bun vi object so all test files see the full API.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bunTest = require("bun:test") as typeof import("bun:test");
const { expect, afterEach } = bunTest;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vitestMod = require("vitest") as { vi: Record<string, unknown> };
const bunVi = vitestMod.vi as Record<string, unknown>;

// ── Stub tracking maps ────────────────────────────────────────────────────────
const _globalStubs = new Map<string, { had: boolean; value: unknown; descriptor?: PropertyDescriptor }>();
const _envStubs = new Map<string, { had: boolean; value: string | undefined }>();
let _resetCounter = 0;

if (!bunVi["stubGlobal"]) {
  bunVi["stubGlobal"] = function stubGlobal(name: string, value: unknown): void {
    if (!_globalStubs.has(name)) {
      const had = Object.prototype.hasOwnProperty.call(globalThis, name);
      const origDescriptor = Object.getOwnPropertyDescriptor(globalThis, name);
      _globalStubs.set(name, {
        had,
        value: (globalThis as Record<string, unknown>)[name],
        // Store descriptor so we can restore configurable/writable state
        descriptor: origDescriptor,
      } as { had: boolean; value: unknown; descriptor?: PropertyDescriptor });
    }
    try {
      (globalThis as Record<string, unknown>)[name] = value;
    } catch {
      // Property is read-only/non-configurable — use defineProperty to force override
      Object.defineProperty(globalThis, name, {
        value,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
  };
}

if (!bunVi["unstubAllGlobals"]) {
  bunVi["unstubAllGlobals"] = function unstubAllGlobals(): void {
    for (const [name, entry] of _globalStubs) {
      const { had, value, descriptor } = entry as { had: boolean; value: unknown; descriptor?: PropertyDescriptor };
      if (!had) {
        try { delete (globalThis as Record<string, unknown>)[name]; } catch { /* ignore */ }
      } else if (descriptor) {
        try { Object.defineProperty(globalThis, name, descriptor); } catch {
          try { (globalThis as Record<string, unknown>)[name] = value; } catch { /* ignore */ }
        }
      } else {
        try { (globalThis as Record<string, unknown>)[name] = value; } catch { /* ignore */ }
      }
    }
    _globalStubs.clear();
  };
}

if (!bunVi["stubEnv"]) {
  bunVi["stubEnv"] = function stubEnv(name: string, value: string): void {
    if (!_envStubs.has(name)) {
      const had = Object.prototype.hasOwnProperty.call(process.env, name);
      _envStubs.set(name, { had, value: process.env[name] });
    }
    process.env[name] = value;
  };
}

if (!bunVi["unstubAllEnvs"]) {
  bunVi["unstubAllEnvs"] = function unstubAllEnvs(): void {
    for (const [name, { had, value }] of _envStubs) {
      if (had) {
        process.env[name] = value;
      } else {
        delete process.env[name];
      }
    }
    _envStubs.clear();
  };
}

if (!bunVi["resetModules"]) {
  bunVi["resetModules"] = function resetModules(): void {
    _resetCounter++;
  };
}

if (!bunVi["importFresh"]) {
  bunVi["importFresh"] = async function importFresh<T = unknown>(specifier: string): Promise<T> {
    const repoRoot = new URL("../../..", import.meta.url).pathname.replace(/\/$/, "");
    const expanded = specifier.startsWith("@/")
      ? `${repoRoot}/src/${specifier.slice(2)}`
      : specifier;
    const resolved = Bun.resolveSync(expanded, repoRoot);
    return import(resolved + "?reset=" + _resetCounter) as Promise<T>;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!bunVi["mocked"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bunVi["mocked"] = function mocked<T extends (...args: any[]) => any>(fn: T) {
    return fn;
  };
}

if (!bunVi["doMock"]) {
  bunVi["doMock"] = function doMock(id: string, factory?: () => unknown): void {
    if (factory !== undefined) {
      bunTest.mock.module(id, factory as () => Record<string, unknown>);
    } else {
      bunTest.mock.module(id, () => ({}));
    }
  };
}

// Also patch vi.mock to delegate to mock.module (bun's vi.mock is already there but double-check)
if (!bunVi["mock"] || typeof bunVi["mock"] !== "function") {
  bunVi["mock"] = function mockModule(id: string, factory?: () => unknown): void {
    if (factory !== undefined) {
      bunTest.mock.module(id, factory as () => Record<string, unknown>);
    } else {
      bunTest.mock.module(id, () => ({}));
    }
  };
}

// ── 3. Env defaults (replaces vitest test.env) ────────────────────────────────
process.env["VITE_FF_MULTI_LANG"] ??= "true";

// ── 4. IS_REACT_ACT_ENVIRONMENT ───────────────────────────────────────────────
(globalThis as unknown as Record<string, unknown>)["IS_REACT_ACT_ENVIRONMENT"] = true;

// ── 5. jest-dom matchers (require — after happy-dom globals are live) ─────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rawMatchers = require("@testing-library/jest-dom/matchers") as Record<string, unknown>;
const matchers =
  (rawMatchers as { default?: Record<string, unknown> }).default ?? rawMatchers;
expect.extend(matchers as Parameters<typeof expect.extend>[0]);

// Vitest-extended matchers
expect.extend({
  toHaveBeenCalledOnce(received: unknown) {
    const mockObj = received as { mock?: { calls?: unknown[][] } };
    const callCount = mockObj?.mock?.calls?.length ?? 0;
    const pass = callCount === 1;
    return {
      pass,
      message: () =>
        pass
          ? `Expected mock to NOT have been called once, but it was called ${callCount} time(s).`
          : `Expected mock to have been called once, but it was called ${callCount} time(s).`,
    };
  },
});

// Fix: bun's resolves.not.toThrow() treats non-function resolved values as "thrown".
// Vitest semantics: resolves.not.toThrow() just checks the promise doesn't reject.
// Override toThrow to pass (not-throwing) when the received value is not callable.
expect.extend({
  toThrow(received: unknown, expected?: unknown) {
    if (typeof received !== "function") {
      // Non-function resolved value: treat as "did not throw" (vitest .resolves.not.toThrow semantics)
      return {
        pass: false,
        message: () =>
          `Expected non-callable value to throw, but it is not a function (type: ${typeof received})`,
      };
    }
    // Function: actually call it and check
    try {
      (received as () => unknown)();
      // Did not throw
      return {
        pass: false,
        message: () => "Expected function to throw but it did not",
      };
    } catch (e) {
      if (expected !== undefined) {
        if (typeof expected === "string") {
          const msg = e instanceof Error ? e.message : String(e);
          const matches = msg.includes(expected);
          return {
            pass: matches,
            message: () =>
              matches
                ? `Expected function NOT to throw "${expected}" but it did`
                : `Expected function to throw "${expected}" but got: ${msg}`,
          };
        }
        if (expected instanceof RegExp) {
          const msg = e instanceof Error ? e.message : String(e);
          const matches = expected.test(msg);
          return {
            pass: matches,
            message: () =>
              matches
                ? `Expected function NOT to throw matching ${expected} but it did`
                : `Expected function to throw matching ${expected} but got: ${msg}`,
          };
        }
        if (typeof expected === "function") {
          const isInstance = e instanceof expected;
          return {
            pass: isInstance,
            message: () =>
              isInstance
                ? `Expected function NOT to throw ${(expected as { name?: string }).name ?? expected} but it did`
                : `Expected function to throw ${(expected as { name?: string }).name ?? expected} but got: ${String(e)}`,
          };
        }
      }
      return {
        pass: true,
        message: () => "Expected function NOT to throw but it threw",
      };
    }
  },
});

// ── 6. Polyfills ─────────────────────────────────────────────────────────────
// Guard each: only fill gaps — do NOT overwrite happy-dom natives.

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
  } as unknown as typeof ResizeObserver;
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
    takeRecords(): IntersectionObserverEntry[] { return []; }
  } as unknown as typeof IntersectionObserver;
}

// Element.prototype scrollTo/scrollIntoView/scrollBy polyfills
if (typeof Element !== "undefined" && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function () {};
}
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}
if (typeof Element !== "undefined" && !Element.prototype.scrollBy) {
  Element.prototype.scrollBy = function () {};
}

// document.elementFromPoint polyfill
if (typeof document !== "undefined" && !document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

// Radix UI pointer capture stubs
if (typeof HTMLElement !== "undefined") {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = () => {};
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => {};
  }
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
    } catch { /* ignore if non-configurable */ }
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
  globalThis.cancelAnimationFrame = (handle: number): void => clearTimeout(handle);
}

// ── 7. Load @testing-library/react at module level (after DOM is live) ────────
// This triggers RTL's auto-registration of afterEach(cleanup)/beforeAll/afterAll.
// Must be at module body level (not inside a test/afterEach callback) so that the
// beforeAll/afterAll calls happen outside any test context.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("@testing-library/react");

// ── 8. afterEach cleanup (C1 hygiene) ────────────────────────────────────────
// @tanstack/virtual-core schedules a debounced isScrollingReset callback via
// window.setTimeout and never cancels it on unmount. Left pending, it fires
// into an unmounted React tree during a later test (cross-file pollution; in
// vitest/jsdom it surfaced as uncaught "window is not defined" after env
// teardown). Track timers scheduled on window and clear leftovers afterEach.
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

afterEach(() => {
  // Clear window timers left pending by libraries (see note above).
  if (typeof window !== "undefined") {
    for (const id of pendingWindowTimeouts) {
      window.clearTimeout(id);
    }
  }
  pendingWindowTimeouts.clear();
  // C1 hygiene: clear localStorage/sessionStorage to prevent cross-file state leaks.
  // (bun test runs all 58 files in one process; vitest isolated per-file.)
  if (typeof localStorage !== "undefined") {
    try { localStorage.clear(); } catch { /* ignore */ }
  }
  if (typeof sessionStorage !== "undefined") {
    try { sessionStorage.clear(); } catch { /* ignore */ }
  }
  // Reset document body residue
  if (typeof document !== "undefined" && document.body) {
    document.body.innerHTML = "";
  }
});
