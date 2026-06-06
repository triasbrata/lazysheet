// Prints one bottom-line total coverage % from bun test's lcov report and
// enforces the 95% line threshold (mirrors the old vitest json-summary gate).
//
// bun 1.3.x cannot exclude files from coverage (no coveragePathIgnorePatterns,
// see rpi-progress.md D4), so the entry-point/untestable excludes that lived in
// vitest.config.ts coverage.exclude are applied here when computing totals.
import { readFileSync } from "node:fs";

const LCOV = "coverage/unit/lcov.info";
const THRESHOLD_LINES = 95;

// Parity with the old vitest coverage.exclude list (src/test/** and *.test.*
// are already dropped by bunfig coverageSkipTestFiles + preload location).
const EXCLUDE = [
  /(^|\/)src\/main\.tsx$/,
  /(^|\/)src\/lib\/copy-as-image\.ts$/,
  /(^|\/)src\/test\//,
  /\.test\.(ts|tsx)$/,
  /\.d\.ts$/,
];

let raw: string;
try {
  raw = readFileSync(LCOV, "utf8");
} catch {
  console.error(`No lcov report at ${LCOV}. Run \`bun test --coverage\` first.`);
  process.exit(1);
}

interface Tally {
  found: number;
  hit: number;
}
const lines: Tally = { found: 0, hit: 0 };
const funcs: Tally = { found: 0, hit: 0 };
const branches: Tally = { found: 0, hit: 0 };

let currentFile = "";
let skip = false;
for (const line of raw.split("\n")) {
  if (line.startsWith("SF:")) {
    currentFile = line.slice(3).trim();
    skip = EXCLUDE.some((re) => re.test(currentFile));
    continue;
  }
  if (skip) continue;
  if (line.startsWith("LF:")) lines.found += Number(line.slice(3));
  else if (line.startsWith("LH:")) lines.hit += Number(line.slice(3));
  else if (line.startsWith("FNF:")) funcs.found += Number(line.slice(4));
  else if (line.startsWith("FNH:")) funcs.hit += Number(line.slice(4));
  else if (line.startsWith("BRF:")) branches.found += Number(line.slice(4));
  else if (line.startsWith("BRH:")) branches.hit += Number(line.slice(4));
}

if (lines.found === 0) {
  console.error(`lcov report at ${LCOV} contains no line data.`);
  process.exit(1);
}

const pctOf = (t: Tally) => (t.found === 0 ? 100 : (t.hit / t.found) * 100);
const pct = (n: number) => `${n.toFixed(2)}%`;

const linesPct = pctOf(lines);
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const color = linesPct >= 80 ? GREEN : linesPct >= 50 ? YELLOW : RED;

console.log(
  `\n${BOLD}Total coverage: ${color}${pct(linesPct)}${RESET}${BOLD} lines${RESET}` +
    `  (funcs ${pct(pctOf(funcs))} · branch ${pct(pctOf(branches))})`,
);

if (linesPct < THRESHOLD_LINES) {
  console.error(
    `${RED}${BOLD}Coverage gate failed:${RESET} ${pct(linesPct)} lines < ${THRESHOLD_LINES}% threshold.`,
  );
  process.exit(1);
}
