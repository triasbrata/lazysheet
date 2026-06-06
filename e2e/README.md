# LazySheet E2E Tests

End-to-end tests using [WebdriverIO](https://webdriver.io/) driving the **real Tauri app** (real Rust backend + native WebView) via [tauri-webdriver](https://github.com/Choochmeque/tauri-webdriver) + [tauri-plugin-webdriver](https://github.com/Choochmeque/tauri-plugin-webdriver).

> **Cross-platform, no Docker.** Unlike `tauri-driver` (Linux/Windows only), `tauri-plugin-webdriver` embeds a W3C WebDriver server inside the app and talks to the native WebView directly — **WKWebView on macOS, WebKitGTK on Linux, WebView2 on Windows**. The plugin is an **optional dependency gated behind the `webdriver` cargo feature** — compiled in only for e2e builds (`cargo build --features webdriver`) and never by `tauri build` (release), so it never ships in production.

---

## Prerequisites

- Bun 1.x (https://bun.sh)
- Rust stable + `cargo` (to build the app and install the driver)
- The intermediary driver, installed once:

  ```sh
  cargo install tauri-webdriver --locked
  ```

- **Linux only:** `xvfb` (headless display) + the usual `libwebkit2gtk-4.1-dev` build libs. No `WebKitWebDriver` / `webkit2gtk-driver` needed.

---

## How to Run

### One command (recommended)

```sh
bun run test:e2e
```

Cross-platform. This runs the full native flow: fixtures → instrumented frontend build (`VITE_E2E=true`) → debug app build → `bun install` → wdio specs (auto-wrapped in `xvfb-run` on Linux) → unit coverage → **95% frontend line-coverage gate** → backend coverage report. Exits non-zero if any spec fails or coverage is below 95%.

### Manual / iterating on specs

```sh
# 1. Generate fixture files (only needed once)
bun run e2e:fixtures

# 2. Build the app with the E2E hook + instrumentation enabled
bun run e2e:build-app        # VITE_E2E=true build:web && cargo build (debug)

# 3. Run the specs (driver is spawned automatically by wdio.conf.js)
bun run e2e:run              # cd e2e && bun run test
```

On Linux, prefix step 3 with `xvfb-run -a`.

### Deploy gate (local only)

E2E is **not** wired into GitHub Actions. It runs locally as a gate inside `bun run app:deploy`: `scripts/deploy.ts` calls `bun run test:e2e` after the version-bump confirmation and **aborts the release (no git writes) if any spec fails or coverage is below 95%**. Bypass in an emergency with `bun run app:deploy --skip-e2e`.

---

## How it connects

```
WebdriverIO ──HTTP :4444──> tauri-webdriver (CLI, spawned in beforeSession)
                                  │ launches the debug app binary
                                  └──HTTP :4445──> tauri-plugin-webdriver (in-app)
                                                        └─> native WebView (WKWebView / WebKitGTK / WebView2)
```

- `wdio.conf.js` `beforeSession` spawns `tauri-webdriver --port 4444 --native-port 4445`; `afterSession` kills it.
- `tauri:options.application` points at the debug binary (`src-tauri/target/debug/lazysheet`, override with `LAZYSHEET_E2E_BIN`).
- Override the driver binary with `TAURI_WEBDRIVER` if it's not on `PATH`.

---

## Fixture Files

Fixtures live in `e2e/fixtures/`:

| File | Description |
|------|-------------|
| `simple.csv` | Minimal CSV with header row + 3 data rows |
| `data.tsv` | Tab-separated, header + 3 rows |
| `multi.xlsx` | Multi-sheet, formula cell, merged range (generated) |
| `legacy.xls` | Legacy BIFF8 format (generated; optional) |

Regenerate binary fixtures:

```sh
bun run e2e:fixtures
```

---

## Spec Files

| Spec | Feature |
|------|---------|
| `01-open-file.e2e.js` | Open CSV/XLSX via file picker + drag-drop |
| `02-grid-render.e2e.js` | Column headers, cell values, virtual scroll |
| `03-sheet-tabs.e2e.js` | Sheet switching |
| `04-find.e2e.js` | Find bar, match count, navigation |
| `05-column-filter.e2e.js` | Column filter panel |
| `06-summary.e2e.js` | Summary panel + copy |
| `07-copy.e2e.js` | Copy range + copy formula |
| `08-markdown-export.e2e.js` | Markdown table copy |
| `09-resize.e2e.js` | Column resize dialog |
| `10-command-palette.e2e.js` | Command palette (Ctrl+K) |
| `11-theme.e2e.js` | Light/Dark theme toggle |
| `12-keyboard-shortcuts.e2e.js` | Arrow navigation, Ctrl+A, Ctrl+W |
| `13-context-menu.e2e.js` | Row/column context menu |
| `14-i18n.e2e.js` | Language toggle (en/id) |

---

## Troubleshooting

**`tauri-webdriver: command not found` / `ECONNREFUSED` on `:4444`**
The intermediary isn't installed or not on `PATH`. Install it:
```sh
cargo install tauri-webdriver --locked
```
Or point at it explicitly: `TAURI_WEBDRIVER=/path/to/tauri-webdriver`.

**`__E2E__` hook missing**
The app wasn't built with `VITE_E2E=true`. Rebuild:
```sh
bun run e2e:build-app
```

**WebDriver server not reachable on `:4445`**
The app was built without the plugin. Confirm you built with the feature: `cargo build --features webdriver` (or `bun run e2e:build-app`). Cargo does **not** support gating deps by `cfg(debug_assertions)`, which is why the plugin is a `webdriver` feature instead.

**Locale / language selector failures**
Tests force `lazysheet-language=en` via `prepareApp()`. If specs still see non-English text, ensure the app was opened freshly after `prepareApp()` and that no other test left stale localStorage state.

**Linux: `xvfb-run: command not found` or no display**
Install `xvfb` (`sudo apt-get install -y xvfb`). `bun run test:e2e` wraps wdio in `xvfb-run` automatically on Linux.

---

## Coverage

### Frontend coverage (hard gate — >=95% lines)

Frontend coverage is the **merge of two istanbul sources**:

1. **E2E coverage** — collected from `window.__coverage__` (injected by the babel-istanbul Bun plugin, `scripts/istanbul-plugin.ts`, when the app is built with `VITE_E2E=true`). During each test run, `dumpCoverage()` in `helpers/app.js` reads `window.__coverage__` from the browser and writes a uniquely-named JSON chunk to `.nyc_output/` at the repo root. The wdio `afterTest` and `after` hooks also call `dumpCoverage()`. Coverage is always captured **before** `location.reload()` in `prepareApp()`, because a reload resets `window.__coverage__`.

2. **Unit coverage** — produced by `bun test --coverage` (lcov reporter, written to `coverage/unit/lcov.info`).

After the specs finish, `scripts/e2e.ts` runs:

```sh
bun run scripts/coverage-merge.ts
```

Which merges the e2e istanbul chunks, writes the HTML + text-summary report, folds the e2e line coverage into the unit lcov line map (hits = max of the two suites), and exits non-zero when merged line coverage is below 95%. That propagates through `scripts/e2e.ts` and aborts the deploy gate in `scripts/deploy.ts` — **no git writes happen if coverage is below 95%**.

### Where reports land

| Path | Contents |
|------|----------|
| `.nyc_output/` | Raw e2e coverage chunks (e2e-*.json) — gitignored |
| `coverage/unit/lcov.info` | Unit lcov report from `bun test --coverage` — gitignored |
| `coverage/html/` | HTML report for the e2e map (open `index.html`) — gitignored |
| Console (text-summary) | e2e per-metric percentages + merged line total |

### Rust backend coverage (report-only)

Backend coverage is collected via `cargo-llvm-cov` (instrumented with `llvm-tools-preview`) when it's installed, and reported after the wdio run. It is **not** gated — a low backend number does not fail the deploy. If `cargo-llvm-cov` is absent, the app is built uninstrumented and backend coverage is skipped; the frontend 95% gate is unaffected.

```sh
cargo install cargo-llvm-cov --locked   # optional, enables backend report
```
