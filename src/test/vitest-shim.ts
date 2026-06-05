/**
 * vitest-shim.ts — maps the bare "vitest" specifier to bun:test equivalents.
 *
 * Resolution mechanism: tsconfig.json compilerOptions.paths maps
 *   "vitest" → ["./src/test/vitest-shim.ts"]
 * Bun 1.x respects tsconfig paths for module resolution in bun test.
 *
 * All 58 test files keep their unchanged:
 *   import { describe, it, expect, vi, ... } from "vitest"
 */

import {
  describe,
  it,
  test,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  jest,
  mock,
  spyOn,
  vi as _bunVi,
  type Mock,
} from "bun:test";

// Re-export test lifecycle primitives unchanged
export {
  describe,
  it,
  test,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
};

// ─── Stub tracking maps ───────────────────────────────────────────────────────
const _globalStubs = new Map<
  string,
  { had: boolean; value: unknown }
>();
const _envStubs = new Map<string, { had: boolean; value: string | undefined }>();

// ─── resetModules counter (for importFresh query-busting) ─────────────────────
let _resetCounter = 0;

// ─── advanceTimersByTimeAsync via native bun timer + microtask drain ─────────
// bun:test jest.advanceTimersByTime exists natively; async variant needs a
// small helper that ticks + drains microtasks so async test callbacks resolve.
async function _advanceTimersByTimeAsync(ms: number): Promise<void> {
  jest.advanceTimersByTime(ms);
  // Drain any queued microtasks so promise callbacks attached to fake timers fire
  await new Promise<void>((r) => setTimeout(r, 0));
}

// ─── The vi object ────────────────────────────────────────────────────────────
export const vi = {
  // ── Mock functions ─────────────────────────────────────────────────────────
  fn: jest.fn,
  spyOn,

  // ── Module mocking ─────────────────────────────────────────────────────────
  /**
   * Mock a module. Delegates to bun:test mock.module().
   * NOTE: bun mock.module is NOT hoisted (unlike vitest vi.mock hoisting).
   * Call vi.mock() at module scope before any import that depends on it, or
   * use dynamic import in the test body. For the 3 files using resetModules,
   * use vi.importFresh() instead.
   */
  mock(id: string, factory?: () => unknown): void {
    if (factory !== undefined) {
      mock.module(id, factory as () => Record<string, unknown>);
    } else {
      mock.module(id, () => ({}));
    }
  },

  // ── Mock lifecycle ─────────────────────────────────────────────────────────
  clearAllMocks: jest.clearAllMocks,
  resetAllMocks: jest.resetAllMocks,
  restoreAllMocks: jest.restoreAllMocks,

  // ── Fake timers (native bun:test, supplemented with async variant) ─────────
  useFakeTimers: _bunVi.useFakeTimers,
  useRealTimers: _bunVi.useRealTimers,
  advanceTimersByTime: jest.advanceTimersByTime,
  advanceTimersByTimeAsync: _advanceTimersByTimeAsync,
  advanceTimersToNextTimer: jest.advanceTimersToNextTimer,
  runAllTimers: jest.runAllTimers,
  runOnlyPendingTimers: jest.runOnlyPendingTimers,
  getTimerCount: jest.getTimerCount,
  clearAllTimers: jest.clearAllTimers,
  isFakeTimers: jest.isFakeTimers,

  // ── Global stubs ──────────────────────────────────────────────────────────
  stubGlobal(name: string, value: unknown): void {
    if (!_globalStubs.has(name)) {
      const had = Object.prototype.hasOwnProperty.call(globalThis, name);
      _globalStubs.set(name, { had, value: (globalThis as Record<string, unknown>)[name] });
    }
    (globalThis as Record<string, unknown>)[name] = value;
  },
  unstubAllGlobals(): void {
    for (const [name, { had, value }] of _globalStubs) {
      if (had) {
        (globalThis as Record<string, unknown>)[name] = value;
      } else {
        delete (globalThis as Record<string, unknown>)[name];
      }
    }
    _globalStubs.clear();
  },

  // ── Env stubs ─────────────────────────────────────────────────────────────
  stubEnv(name: string, value: string): void {
    if (!_envStubs.has(name)) {
      const had = Object.prototype.hasOwnProperty.call(process.env, name);
      _envStubs.set(name, { had, value: process.env[name] });
    }
    process.env[name] = value;
  },
  unstubAllEnvs(): void {
    for (const [name, { had, value }] of _envStubs) {
      if (had) {
        process.env[name] = value;
      } else {
        delete process.env[name];
      }
    }
    _envStubs.clear();
  },

  // ── Module reset (for importFresh pattern) ────────────────────────────────
  resetModules(): void {
    _resetCounter++;
  },

  /**
   * vi.doMock — runtime mock (not hoisted), same as vi.mock in the shim
   * since mock.module() is already runtime-only (no hoisting in bun).
   */
  doMock(id: string, factory?: () => unknown): void {
    if (factory !== undefined) {
      mock.module(id, factory as () => Record<string, unknown>);
    } else {
      mock.module(id, () => ({}));
    }
  },

  /**
   * vi.mocked — type-cast utility: returns fn cast as a bun:test Mock type.
   * Pure type helper; at runtime just returns the argument unchanged.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mocked<T extends (...args: any[]) => any>(fn: T): Mock<T> {
    return fn as unknown as Mock<T>;
  },

  /**
   * Import a fresh (uncached) module instance.
   * Expands "@/" alias to "<repo>/src/", resolves via Bun.resolveSync,
   * then appends "?reset=N" to bust bun's module cache.
   */
  async importFresh<T = unknown>(specifier: string): Promise<T> {
    const repoRoot = new URL("../../..", import.meta.url).pathname.replace(/\/$/, "");
    const expanded = specifier.startsWith("@/")
      ? `${repoRoot}/src/${specifier.slice(2)}`
      : specifier;
    const resolved = Bun.resolveSync(expanded, repoRoot);
    return import(resolved + "?reset=" + _resetCounter) as Promise<T>;
  },
};
