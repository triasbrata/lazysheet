---
phase: implement
date: 2026-06-11
plan: ./rpi-plan.md
---

# Implementation Progress

| Step | Status | Notes |
|------|--------|-------|
| 0: Pre-flight | ✅ Done | ModeToggle only in TitleBar.tsx + own files. matchMedia already polyfilled (setup.ts:38). Coverage threshold 95% lines. |
| 1: Registry + types | ✅ Done | 15 tests pass. 12 palette swatch oklch computed. |
| 2: ThemeProvider | ✅ Done | 7 tests pass. applyTheme + system matchMedia listener. afterEach cleanup added. |
| 3: CSS palette blocks | ✅ Done | 12 [data-theme] blocks after .dark. Vite build clean. Ring 500/400 oklch computed. |
| 4: ThemePicker (+ i18n keys) | ✅ Done | Picker maps registry; 4 locales updated; picker 100% cov. |
| 5: TitleBar wire + delete ModeToggle | ✅ Done | ModeToggle refs = 0. TitleBar uses ThemePicker. |
| 6: e2e | ✅ Done | Kept light/dark tests; added blue-dark data-theme test. e2e tsc clean. |

## R1 Verification (real Material Theme palettes)
- Registry: 23 palettes (palette:true) + light/dark defaults + system. Full var blocks.
- App.css: 23 [data-theme] full 31-var blocks. Vite build clean.
- i18n: theme.colors removed from all 4 locales; theme.customize kept.
- Tests: full suite **1869 pass / 0 fail**. e2e tsc clean.
- Palettes: oceanic, darker, lighter, palenight, deepocean, forest, skyblue, sandybeach, volcano, space, monokaipro, dracula, github, githubdark, arcdark, onedark, onelight, solarizeddark, solarizedlight, nightowl, lightowl, moonlight, synthwave84.

## Final Verification (v1 — superseded by R1)
- Unit suite: **1871 pass / 0 fail** (62 files).
- Vite build: clean (CSS compiles).
- e2e: `tsc --noEmit` clean (suite not run — needs webdriver+built app).
- Coverage (unit-only): branch **94.13%** vs clean origin/main **94.09%**. The 95% vitest threshold is ALREADY unmet on main (real gate merges e2e istanbul via nyc/coverage-total.ts). New files: themes.ts 100%, theme-picker.tsx 100%, theme-provider.tsx 96.96% (only unreachable useTheme throw + by-design lines uncovered). No regression — slight improvement.
- Change Map: all 15 entries done (4 create, 9 modify, 2 delete). ModeToggle grep = 0.
- Deviations: none.

## Notes
- Test runner: `vitest run` (npm test). Coverage istanbul, threshold lines:95.
- Tests import explicitly from "vitest" (globals:false).
- matchMedia polyfill present → no stub needed (plan risk retired).

## Replan Log (test-failure escalation)
| Step | Tier | Cycle/Attempt | Root cause found | Plan change |
|------|------|---------------|------------------|-------------|
| R1 | Scope deviation (user) | n/a | v1 shipped Material DESIGN accent-swaps; user wanted Material THEME named schemes (Palenight, Deep Ocean, …) | Plan §R1: 23 full-scheme palettes, full var blocks, registry `name` field, drop i18n colors. Generated deterministically. |

Counters: replan_cycles: 0/3 · opus_attempts: 0/5
