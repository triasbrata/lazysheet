#!/usr/bin/env bun
/**
 * Native (no-Docker) e2e runner — cross-platform: macOS / Linux / Windows.
 *
 * Drives the REAL Tauri app (real Rust backend + native WebView) via
 * tauri-webdriver + tauri-plugin-webdriver (an embedded W3C WebDriver server,
 * compiled into debug builds only). Replaces the old Docker + tauri-driver flow,
 * which could not run on macOS.
 *
 * Steps:
 *   1. bun install             frontend deps (vite / vitest)
 *   2. e2e:fixtures            generate multi.xlsx, legacy.xls
 *   3. VITE_E2E build:web      istanbul-instrumented static frontend
 *   4. cargo build (debug)     app + webdriver plugin (cfg(debug_assertions))
 *   5. bun install (e2e)       wdio + nyc
 *   6. wdio run                xvfb-run on Linux; direct on macOS/Windows
 *   7. vitest --coverage       unit coverage
 *   8. merge + HARD GATE       frontend line coverage must be >= 95%
 *   9. cargo llvm-cov report   backend coverage (report-only, best-effort)
 *
 * Prerequisites (installed once):
 *   cargo install tauri-webdriver --locked
 *   Bun 1.x (https://bun.sh)
 *   Linux only: xvfb + webkit2gtk build libs
 */
import { $ } from "bun";
import { resolve } from "node:path";
import { copyFileSync, existsSync, writeFileSync } from "node:fs";

const ROOT = resolve(import.meta.dirname!, "..");
const E2E = resolve(ROOT, "e2e");
const IS_LINUX = process.platform === "linux";

function die(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function log(m: string) {
  console.log(`\n▶ ${m}`);
}

/** Parse `export KEY=VALUE` lines emitted by `cargo llvm-cov show-env`. */
function parseExports(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^export\s+([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith("'") && val.endsWith("'")) ||
      (val.startsWith('"') && val.endsWith('"'))
    ) {
      val = val.slice(1, -1);
    }
    env[m[1]] = val;
  }
  return env;
}

/**
 * Reduce raw wdio output to the spec-reporter report: per-test results,
 * failure messages/stacks, and the final "Spec Files:" summary. Drops
 * webdriver DEBUG/INFO command spam and per-worker log lines.
 */
function extractWdioReport(out: string): string {
  const start = out.indexOf('"spec" Reporter:');
  if (start !== -1) return out.slice(start).trimEnd();
  // Fallback (reporter section missing — e.g. crash before specs ran):
  // filter known noise lines and show the tail.
  const lines = out.split("\n").filter(
    (l) =>
      !/^\s*\[\d+-\d+\]\s+(DEBUG|INFO|WARN)\b/.test(l) &&
      !/^(DEBUG|INFO)\b/.test(l) &&
      !/webdriver: (COMMAND|DATA|RESULT|BIDI)/.test(l),
  );
  return lines.slice(-100).join("\n").trimEnd();
}

// Backend coverage instrumentation (report-only — never gates the build).
// Best-effort: if cargo-llvm-cov isn't installed we skip backend coverage and
// build the app uninstrumented. The frontend 95% gate is unaffected.
let llvmEnv: Record<string, string> = {};
let backendCov = false;
try {
  const show = await $`cargo llvm-cov show-env --export-prefix`
    .cwd(ROOT)
    .quiet()
    .text();
  llvmEnv = parseExports(show);
  backendCov = Object.keys(llvmEnv).length > 0;
} catch {
  log("cargo-llvm-cov not installed — backend coverage skipped (report-only).");
}

log("Installing frontend deps (bun install)");
await $`bun install`.cwd(ROOT);

log("Generating e2e fixtures");
await $`bun run e2e:fixtures`.cwd(ROOT);

log("Building instrumented frontend (VITE_E2E=true)");
await $`bun run build:web`.cwd(ROOT).env({ ...process.env, VITE_E2E: "true" });

log("Building debug app (--features webdriver)");
await $`cargo build --manifest-path src-tauri/Cargo.toml --features webdriver`
  .cwd(ROOT)
  .env({ ...process.env, ...llvmEnv });

log("Installing e2e runner deps (bun)");
try {
  await $`bun install --frozen-lockfile`.cwd(E2E);
} catch {
  await $`bun install`.cwd(E2E);
}

log("Running e2e specs (wdio + tauri-webdriver)");
// Capture wdio output instead of streaming: deploy output stays clean, and on
// failure we print only the spec report (what failed + why). Full raw log is
// always written to e2e/wdio.log.
const wdioLogPath = resolve(E2E, "wdio.log");
const wdioEnv = { ...process.env, E2E_COVERAGE: "true" };
let wdioOut = "";
let wdioFailed = false;
try {
  const res = IS_LINUX
    ? await $`xvfb-run -a bun run test`.cwd(E2E).env(wdioEnv).quiet()
    : await $`bun run test`.cwd(E2E).env(wdioEnv).quiet();
  wdioOut = res.stdout.toString() + res.stderr.toString();
} catch (err) {
  wdioFailed = true;
  const e = err as { stdout?: Buffer; stderr?: Buffer };
  wdioOut = (e.stdout?.toString() ?? "") + (e.stderr?.toString() ?? "");
}
writeFileSync(wdioLogPath, wdioOut);
console.log(extractWdioReport(wdioOut));
if (wdioFailed) {
  die(`E2E specs failed — see report above; full wdio output: ${wdioLogPath}`);
}

log("Collecting unit coverage (vitest)");
await $`bun run test:coverage`.cwd(ROOT);

const unitSrc = resolve(ROOT, "coverage/unit/coverage-final.json");
const unitDst = resolve(ROOT, ".nyc_output/unit-final.json");
if (existsSync(unitSrc)) {
  copyFileSync(unitSrc, unitDst);
} else {
  log("⚠ unit coverage file missing — gate will use e2e coverage only.");
}

log("Merging coverage + enforcing 95% frontend line gate");
try {
  await $`bun run coverage`.cwd(E2E);
} catch {
  die("Frontend line coverage below 95% — gate failed (no release).");
}

if (backendCov) {
  log("Backend coverage report (report-only)");
  await $`cargo llvm-cov report --manifest-path src-tauri/Cargo.toml --summary-only`
    .cwd(ROOT)
    .env({ ...process.env, ...llvmEnv })
    .nothrow();
}

log("✔ E2E gate passed.");
