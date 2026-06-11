// themes.ts — Theme preset registry.
//
// A preset combines two facets:
//   1. palette identity  → applied via data-theme="<id>" on <html> (palette presets only)
//   2. light/dark base   → applied via .light / .dark class on <html>
//
// The "light" and "dark" presets are the built-in defaults (no data-theme attr).
// All other presets are palette presets that override a small set of CSS color vars.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThemeBase = "light" | "dark";

export interface ThemePreset {
  /** Unique identifier; stored in localStorage; e.g. "palenight". */
  id: string;
  /** Drives the .dark / .light class on <html>. */
  base: ThemeBase;
  /** true → set data-theme=id on <html> and has a CSS block; false → default light/dark. */
  palette: boolean;
  /** For non-palette presets: i18n key, e.g. "theme.light". */
  labelKey?: string;
  /** For palette presets: proper-noun display name, e.g. "Palenight". Not translated. */
  name?: string;
  /** oklch string for the UI swatch dot. */
  swatch: string;
}

/** A preset id string (what is stored in localStorage). */
export type ThemeId = string;

/** What is stored / passed to setTheme. "system" means follow OS preference. */
export type ThemeSelection = ThemeId | "system";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STORAGE_KEY = "lazysheet-theme";

export const DEFAULT_SELECTION: ThemeSelection = "system";

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const THEME_PRESETS: ThemePreset[] = [
  // Defaults — no data-theme attribute, no palette CSS block.
  { id: "light",  base: "light", palette: false, labelKey: "theme.light",  swatch: "oklch(1 0 0)" },
  { id: "dark",   base: "dark",  palette: false, labelKey: "theme.dark",   swatch: "oklch(0.205 0 0)" },

  // Material Theme named schemes (23 full-palette presets).
  // Swatch = background color of each scheme.
  { id: "oceanic",       name: "Oceanic",        base: "dark",  palette: true, swatch: "oklch(0.309 0.019 229.8)" },
  { id: "darker",        name: "Darker",         base: "dark",  palette: true, swatch: "oklch(0.248 0.0 89.9)" },
  { id: "lighter",       name: "Lighter",        base: "light", palette: true, swatch: "oklch(0.985 0.0 89.9)" },
  { id: "palenight",     name: "Palenight",      base: "dark",  palette: true, swatch: "oklch(0.301 0.031 274.1)" },
  { id: "deepocean",     name: "Deep Ocean",     base: "dark",  palette: true, swatch: "oklch(0.18 0.019 274.6)" },
  { id: "forest",        name: "Forest",         base: "dark",  palette: true, swatch: "oklch(0.243 0.042 194.8)" },
  { id: "skyblue",       name: "Sky Blue",       base: "light", palette: true, swatch: "oklch(0.97 0.0 89.9)" },
  { id: "sandybeach",    name: "Sandy Beach",    base: "light", palette: true, swatch: "oklch(0.982 0.016 79.4)" },
  { id: "volcano",       name: "Volcano",        base: "dark",  palette: true, swatch: "oklch(0.216 0.089 29.2)" },
  { id: "space",         name: "Space",          base: "dark",  palette: true, swatch: "oklch(0.262 0.057 272.0)" },
  { id: "monokaipro",    name: "Monokai Pro",    base: "dark",  palette: true, swatch: "oklch(0.29 0.008 317.7)" },
  { id: "dracula",       name: "Dracula",        base: "dark",  palette: true, swatch: "oklch(0.288 0.022 277.5)" },
  { id: "github",        name: "GitHub",         base: "light", palette: true, swatch: "oklch(0.979 0.003 264.5)" },
  { id: "githubdark",    name: "GitHub Dark",    base: "dark",  palette: true, swatch: "oklch(0.278 0.012 248.2)" },
  { id: "arcdark",       name: "Arc Dark",       base: "dark",  palette: true, swatch: "oklch(0.325 0.021 265.9)" },
  { id: "onedark",       name: "One Dark",       base: "dark",  palette: true, swatch: "oklch(0.293 0.016 264.3)" },
  { id: "onelight",      name: "One Light",      base: "light", palette: true, swatch: "oklch(0.967 0.0 89.9)" },
  { id: "solarizeddark", name: "Solarized Dark", base: "dark",  palette: true, swatch: "oklch(0.267 0.049 219.8)" },
  { id: "solarizedlight",name: "Solarized Light",base: "light", palette: true, swatch: "oklch(0.974 0.026 90.1)" },
  { id: "nightowl",      name: "Night Owl",      base: "dark",  palette: true, swatch: "oklch(0.193 0.045 244.0)" },
  { id: "lightowl",      name: "Light Owl",      base: "light", palette: true, swatch: "oklch(0.955 0.0 89.9)" },
  { id: "moonlight",     name: "Moonlight",      base: "dark",  palette: true, swatch: "oklch(0.267 0.034 279.0)" },
  { id: "synthwave84",   name: "Synthwave '84",  base: "dark",  palette: true, swatch: "oklch(0.27 0.045 300.7)" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Look up a preset by id. Returns undefined if not found.
 */
export function getPreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.id === id);
}

/**
 * Resolve a ThemeSelection to a concrete ThemePreset.
 *
 * Rules:
 * 1. "system" → light or dark based on `prefersDark`.
 * 2. Known preset id → that preset.
 * 3. Unknown id (stored from old version / typo) → fallback to light/dark.
 */
export function resolveBase(
  selection: ThemeSelection,
  prefersDark: boolean,
): ThemePreset {
  if (selection === "system") {
    // Non-null assertion: "light" and "dark" are always in the registry.
    return getPreset(prefersDark ? "dark" : "light")!;
  }
  const p = getPreset(selection);
  if (p) return p;
  // Fallback for unknown / stale ids.
  return getPreset(prefersDark ? "dark" : "light")!;
}
