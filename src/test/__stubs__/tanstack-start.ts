/**
 * Stub for @tanstack/react-start and @tanstack/react-start/server in the
 * browser e2e project. The real modules require Vite plugin context
 * (#tanstack-router-entry / #tanstack-start-entry) that is not present
 * in the minimal browser project. All usages in source files are mocked
 * by vi.mock() in the test files anyway.
 */

export function createServerFn(_opts?: unknown) {
  return {
    handler: (_fn: unknown) => {
      return () => Promise.resolve(null)
    },
  }
}

export function getRequestHeader(_name: string): string | undefined {
  return undefined
}
