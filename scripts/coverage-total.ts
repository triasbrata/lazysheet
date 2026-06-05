// Prints one bottom-line total coverage % from vitest's json-summary report.
import { readFileSync } from "node:fs";
const SUMMARY = "coverage/unit/coverage-summary.json";

let raw: string;
try {
  raw = readFileSync(SUMMARY, "utf8");
} catch {
  console.error(`No coverage summary at ${SUMMARY}. Run vitest with --coverage first.`);
  process.exit(1);
}

const { total } = JSON.parse(raw) as {
  total: Record<"lines" | "statements" | "functions" | "branches", { pct: number }>;
};

const pct = (n: number) => `${n.toFixed(2)}%`;
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const color = total.lines.pct >= 80 ? GREEN : total.lines.pct >= 50 ? YELLOW : RED;

console.log(
  `\n${BOLD}Total coverage: ${color}${pct(total.lines.pct)}${RESET}${BOLD} lines${RESET}` +
    `  (stmts ${pct(total.statements.pct)} · funcs ${pct(total.functions.pct)} · branch ${pct(total.branches.pct)})`,
);
