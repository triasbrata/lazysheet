# E2E Handoff — macOS WebKit bring-up

State as of 2026-06-04. E2E suite now runs end-to-end on macOS (was 100% failing).

## What was broken → fixed

1. **Binary path** — `CARGO_TARGET_DIR=/Users/triasbratayudhana/dev/tauri-cache` (set in
   `.envrc`) redirects cargo output, but `wdio.conf.js` hardcoded
   `src-tauri/target/debug/lazysheet` → `No such file or directory (os error 2)`.
   Fix: `wdio.conf.js` `resolveAppBinary()` now honors `CARGO_TARGET_DIR`
   (and `LAZYSHEET_E2E_BIN` override). *(Has a leftover `console.log({realPath})` — remove.)*

2. **Blank window / `localhost:1420` not connecting** — plain `cargo build --features webdriver`
   is a Tauri **dev** build (`dev = !custom-protocol` in tauri build.rs) → app loads `devUrl`
   instead of embedded `dist/`. Fix: `src-tauri/Cargo.toml` `webdriver` feature now pulls
   `tauri/custom-protocol`, forcing the embedded frontend.

3. **`openFixture` / `readClipboard` "unsupported type"** — `__E2E__.open`/`readClipboard`
   return Promises; `execute/sync` can't serialize a Promise on WebKit. Fix: `e2e/helpers/app.js`
   now uses `executeAsync` to await browser-side and return a serializable value.

## How to run

```sh
cd /Users/triasbratayudhana/dev/lazysheet
# build once (frontend instrumented + debug app w/ webdriver+custom-protocol):
VITE_E2E=true deno task build:web
cargo build --manifest-path src-tauri/Cargo.toml --features webdriver
# run specs (kill stray drivers first):
pkill -f tauri-webdriver; pkill -f 'tauri-cache/debug/lazysheet'
deno task e2e:run
```
Full gate (build+specs+coverage 95%): `deno task test:e2e`.

## Current score: 4 passed, 10 failed (14 total)

GREEN: 02-grid-render, 03-sheet-tabs, 04-find, 10-command-palette.
PARTIAL: 01-open-file (3/4), 07-copy (1/2), 11/12/14 (1 each).

## Remaining failures — grouped by suspected root cause

This suite was Docker/Linux-only before; **first run on macOS WebKit** → first-exposure
spec/helper bugs, not regressions. Note Ctrl+F, Ctrl+K, Ctrl+W DO work, so basic key events fire.

| Cluster | Specs | Hypothesis |
|---|---|---|
| Keyboard + modifiers | 06 (Ctrl+Shift+Y), 07 (Ctrl+C multi-cell), 12 (ArrowDown/Right, Ctrl+A) | selection-move + clipboard combos not dispatching; check if app expects Cmd (meta) vs Ctrl on macOS, or key event target/focus |
| Context menu (right-click) | 08 (md-export), 13 (context-menu) | WebKit driver `contextmenu` event not firing — may need synthetic dispatch via `browser.execute` |
| Hover/pointer dropdowns (Radix) | 05 (filter trigger), 11 (theme toggle), 14 (lang menu) | `[role=menuitem]` "still not displayed" — Radix menus need real pointer-move/hover; investigate trigger interaction |
| Dialog | 09 (resize) | likely downstream of a trigger above |
| Lenient assert | 01 (non-existent path error state) | assertion too strict — quick win |

### Suggested attack order
1. 01 lenient assert (quick) → relax expectation.
2. Keyboard cluster (06/07/12) — shared helper, biggest win. Check Ctrl-vs-Cmd + focus.
3. Context-menu (08/13) + Radix hover (05/11/14) — shared pointer-dispatch root.
4. 09 resize last.

## Files touched this session
- `e2e/wdio.conf.js` — `resolveAppBinary()` (+ stray console.log to remove)
- `src-tauri/Cargo.toml` — `webdriver` feature adds `tauri/custom-protocol`
- `e2e/helpers/app.js` — `openFixture` + `readClipboard` use `executeAsync`
