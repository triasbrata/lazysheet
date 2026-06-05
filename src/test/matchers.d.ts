/**
 * matchers.d.ts — augments bun:test Matchers with:
 *   1. @testing-library/jest-dom matchers (toBeInTheDocument, toHaveValue, etc.)
 *   2. Vitest-extended matchers used in this codebase (toHaveBeenCalledOnce, etc.)
 *
 * @testing-library/jest-dom ships types/bun.d.ts with the exact Matchers<T>
 * augmentation for bun:test. We reference it via triple-slash.
 */

/// <reference path="../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />

declare module "bun:test" {
  // Vitest-extended matchers used in this codebase
  interface Matchers<T = unknown> {
    /**
     * Assert that a mock function was called exactly once.
     * Equivalent to .toHaveBeenCalledTimes(1) — aliased here for vitest-extended compat.
     */
    toHaveBeenCalledOnce(): void;

    /**
     * Loosened toBe overload: accepts `unknown` to match vitest's more permissive
     * type signature. Fixes pre-existing test files that pass partial objects to toBe.
     */
    toBe(expected: unknown): void;
  }
}
