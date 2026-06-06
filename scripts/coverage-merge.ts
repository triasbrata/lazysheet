// Merges e2e istanbul coverage chunks (.nyc_output/e2e-*.json, dumped from
// window.__coverage__ by e2e/helpers/app.ts) with the unit lcov report
// (coverage/unit/lcov.info, produced by `bun test --coverage`), writes an HTML
// report for the e2e map, and enforces the 95% merged frontend line gate.
// Replaces the old nyc merge/report/check-coverage pipeline (nyc removed).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import libCoverage from "istanbul-lib-coverage";
import libReport from "istanbul-lib-report";
import reports from "istanbul-reports";

const ROOT = resolve(import.meta.dir, "..");
const NYC_OUTPUT = resolve(ROOT, ".nyc_output");
const UNIT_LCOV = resolve(ROOT, "coverage/unit/lcov.info");
const HTML_DIR = resolve(ROOT, "coverage/html");
const THRESHOLD_LINES = 95;

// Same exclude list as scripts/coverage-total.ts (vitest-config parity).
const EXCLUDE = [
  /(^|\/)src\/main\.tsx$/,
  /(^|\/)src\/lib\/copy-as-image\.ts$/,
  /(^|\/)src\/test\//,
  /\.test\.(ts|tsx)$/,
  /\.d\.ts$/,
];

// C7: babel-istanbul emits absolute paths, bun's lcov may emit repo-relative —
// canonicalize both to repo-relative before keying the merge map.
function relPath(p: string): string {
  const abs = p.startsWith("/") ? p : resolve(ROOT, p);
  return relative(ROOT, abs);
}

// file (repo-relative) → line → hits; merge strategy: hits = max(unit, e2e).
// max (not sum) — the gate is "is this line exercised at all", and summing
// double-counts lines covered by both suites.
const mergedLines = new Map<string, Map<number, number>>();

function addLine(file: string, line: number, hits: number): void {
  let lines = mergedLines.get(file);
  if (!lines) {
    lines = new Map();
    mergedLines.set(file, lines);
  }
  lines.set(line, Math.max(lines.get(line) ?? 0, hits));
}

// ── 1. Merge e2e istanbul chunks ──────────────────────────────────────────────
const map = libCoverage.createCoverageMap({});
let chunkCount = 0;
if (existsSync(NYC_OUTPUT)) {
  for (const name of readdirSync(NYC_OUTPUT)) {
    if (!/^e2e-.*\.json$/.test(name)) continue;
    map.merge(JSON.parse(readFileSync(resolve(NYC_OUTPUT, name), "utf8")));
    chunkCount++;
  }
}
if (chunkCount === 0) {
  console.warn("⚠ no .nyc_output/e2e-*.json chunks found — gate uses unit coverage only.");
}

// ── 2. HTML + summary report for the e2e map ──────────────────────────────────
if (chunkCount > 0) {
  const context = libReport.createContext({ dir: HTML_DIR, coverageMap: map });
  reports.create("html").execute(context);
  reports.create("text-summary").execute(context);
  console.log(`e2e HTML report: ${relative(ROOT, HTML_DIR)}/index.html`);
}

// ── 3. Fold e2e line coverage into the merge map ──────────────────────────────
for (const file of map.files()) {
  const rel = relPath(file);
  if (EXCLUDE.some((re) => re.test(rel))) continue;
  const lineCoverage = map.fileCoverageFor(file).getLineCoverage();
  for (const [line, hits] of Object.entries(lineCoverage)) {
    addLine(rel, Number(line), hits);
  }
}

// ── 4. Fold unit lcov line records into the merge map ─────────────────────────
if (existsSync(UNIT_LCOV)) {
  let currentFile = "";
  let skip = false;
  for (const line of readFileSync(UNIT_LCOV, "utf8").split("\n")) {
    if (line.startsWith("SF:")) {
      currentFile = relPath(line.slice(3).trim());
      skip = EXCLUDE.some((re) => re.test(currentFile));
    } else if (!skip && line.startsWith("DA:")) {
      const [lineNo, hits] = line.slice(3).split(",");
      addLine(currentFile, Number(lineNo), Number(hits));
    }
  }
} else {
  console.warn(`⚠ unit lcov missing at ${relative(ROOT, UNIT_LCOV)} — gate uses e2e coverage only.`);
}

if (mergedLines.size === 0) {
  console.error("No coverage data found (no e2e chunks AND no unit lcov). Gate failed.");
  process.exit(1);
}

// ── 5. Total + gate ───────────────────────────────────────────────────────────
let found = 0;
let hit = 0;
for (const lines of mergedLines.values()) {
  for (const hits of lines.values()) {
    found++;
    if (hits > 0) hit++;
  }
}
const pct = (hit / found) * 100;

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const color = pct >= THRESHOLD_LINES ? GREEN : RED;
console.log(
  `\n${BOLD}Merged frontend coverage (unit + e2e): ${color}${pct.toFixed(2)}%${RESET}${BOLD} lines${RESET}` +
    `  (${hit}/${found} lines, ${mergedLines.size} files, ${chunkCount} e2e chunks)`,
);

if (pct < THRESHOLD_LINES) {
  console.error(
    `${RED}${BOLD}Coverage gate failed:${RESET} ${pct.toFixed(2)}% lines < ${THRESHOLD_LINES}% threshold.`,
  );
  process.exit(1);
}
