// feature-flags.ts — Build-time feature flags via Vite environment variables.
//
// Convention: all feature-flag env vars use the VITE_FF_ prefix, e.g. VITE_FF_AUTO_UPDATE.
// Vite statically replaces `import.meta.env.VITE_*` at build time, so flags have zero
// runtime overhead and unused branches can be removed by the bundler.
//
// Polarity — default is per-flag via parseFlag's second argument (defaultValue):
//   The conventional default is ON (defaultValue = true), meaning:
//     Absent (env var not set)        → enabled  (true)
//     Set to "false", "0", or "off"   → disabled (false)
//     Set to anything else (incl. "") → enabled  (true)
//
//   A flag may opt into default-OFF by passing false as the second argument.
//   Example: multiLang is default-OFF (absent → disabled, set to e.g. "true" → enabled).
//
// Setting flags:
//   - In a .env file:       VITE_FF_AUTO_UPDATE=false
//   - Inline at build time: VITE_FF_AUTO_UPDATE=false bun run build:web
//
// IMPORTANT — static member access only:
//   Vite replaces `import.meta.env.VITE_FF_X` at build time ONLY when the key is a
//   static literal member access. Dynamic access (`import.meta.env[name]`) is NOT
//   replaced and silently produces `undefined` in production builds. Always read flags
//   via a static key, either through this registry or directly in consuming code.
//
// Tree-shake / dead-code elimination note:
//   For whole-feature dead-code elimination (e.g. removing an entire feature from the
//   bundle), gate the call site with an inline literal comparison:
//     if (import.meta.env.VITE_FF_X !== "false") { ... }
//   esbuild constant-folds the literal string comparison and removes the dead branch.
//   It does NOT inline `parseFlag` across module boundaries, so `flags.x && ...` keeps
//   both branches alive in the bundle even when the flag is disabled at build time.

/**
 * Parse a raw Vite env string into a boolean feature-flag value.
 *
 * Rules:
 * - `undefined` (variable absent)       → `defaultValue` (default: `true`)
 * - `"false"`, `"0"`, `"off"` (any case, any surrounding whitespace) → `false`
 * - anything else (including `""`)       → `true`
 *
 * Pass `defaultValue = false` for flags that should be OFF when absent.
 */
export function parseFlag(raw: string | undefined, defaultValue = true): boolean {
  if (raw === undefined) return defaultValue;
  const normalized = raw.trim().toLowerCase();
  return normalized !== "false" && normalized !== "0" && normalized !== "off";
}

/**
 * Build-time feature-flag registry.
 *
 * Add flags here using static `import.meta.env` member access:
 *
 * @example
 * // example: autoUpdate: parseFlag(import.meta.env.VITE_FF_AUTO_UPDATE),
 *
 * Each entry is evaluated once at module load (build-time constant after Vite
 * replacement). Consumers read e.g. `flags.autoUpdate`.
 */
export const flags = {
  multiLang: parseFlag(import.meta.env.VITE_FF_MULTI_LANG, false),
} as const satisfies Readonly<Record<string, boolean>>;
