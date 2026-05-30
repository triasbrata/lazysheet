#!/usr/bin/env -S deno run -A
/**
 * Local deploy script.
 *
 * Flow: load .env -> build changelog from commits since latest tag ->
 * ask Claude Code to decide the semantic version bump -> bump version files ->
 * commit -> create annotated tag (message = changelog) -> push.
 *
 * The pushed tag triggers .github/workflows/release.yml which builds the
 * cross-platform artifacts and publishes the release.
 *
 * Usage:
 *   deno task app:deploy            # interactive, asks for confirmation
 *   deno task app:deploy --yes      # skip confirmation
 *   deno task app:deploy --dry-run  # print the plan, no git writes / push
 */

import { $ } from "jsr:@david/dax@^0.43.0";
import dotenv from "npm:dotenv@^17.4.2";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname!, "..");
const args = new Set(Deno.args);
const DRY_RUN = args.has("--dry-run");
const SKIP_CONFIRM = args.has("--yes") || args.has("-y");

function die(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  Deno.exit(1);
}

function log(msg: string) {
  console.log(msg);
}

/** Load .env from the repo root into the environment via dotenv. */
function loadEnv(path: string) {
  if (!existsSync(path)) {
    log(`⚠ ${path} not found — relying on existing environment.`);
    return;
  }
  dotenv.config({ path, quiet: true });
}

type Bump = "major" | "minor" | "patch";

function bumpVersion(version: string, bump: Bump): string {
  const [maj, min, pat] = version.split(".").map((n) => parseInt(n, 10));
  if ([maj, min, pat].some((n) => Number.isNaN(n))) {
    die(`current version "${version}" is not valid semver`);
  }
  if (bump === "major") return `${maj + 1}.0.0`;
  if (bump === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

function isGreater(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return true;
    if (pa[i] < pb[i]) return false;
  }
  return false;
}

const TYPE_HEADINGS: Record<string, string> = {
  feat: "### Features",
  fix: "### Fixes",
  perf: "### Performance",
  refactor: "### Refactor",
  docs: "### Documentation",
  test: "### Tests",
  build: "### Build",
  ci: "### CI",
  chore: "### Chores",
};

/** Group conventional-commit subjects into a markdown changelog. */
function buildChangelog(commits: { subject: string; hash: string }[]): string {
  const groups = new Map<string, string[]>();
  for (const { subject, hash } of commits) {
    const m = subject.match(/^(\w+)(?:\([^)]*\))?!?:\s*(.+)$/);
    const type = m ? m[1].toLowerCase() : "other";
    const text = m ? m[2] : subject;
    const heading = TYPE_HEADINGS[type] ?? "### Other";
    if (!groups.has(heading)) groups.set(heading, []);
    groups.get(heading)!.push(`- ${text} (${hash})`);
  }
  const order = [
    ...Object.values(TYPE_HEADINGS),
    "### Other",
  ];
  const sections: string[] = [];
  for (const heading of order) {
    const items = groups.get(heading);
    if (items?.length) sections.push(`${heading}\n${items.join("\n")}`);
  }
  return sections.join("\n\n");
}

/** Ask Claude Code to decide the semver bump from the commit list. */
async function decideBump(
  currentVersion: string,
  commits: { subject: string }[],
): Promise<{ bump: Bump; version: string }> {
  if (!Deno.env.get("CLAUDE_CODE_OAUTH_TOKEN") && !Deno.env.get("ANTHROPIC_API_KEY")) {
    die(
      "no CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY in env — check .env",
    );
  }
  const subjects = commits.map((c) => `- ${c.subject}`).join("\n");
  const prompt = [
    `You are deciding the next semantic version for a release.`,
    `Current version: ${currentVersion}`,
    ``,
    `Commits since the last release:`,
    subjects,
    ``,
    `Rules: breaking change -> major; new feature (feat) -> minor; fixes/chores/docs only -> patch.`,
    `Respond with ONLY a single JSON object, no prose, no code fence:`,
    `{"bump":"major|minor|patch","version":"X.Y.Z"}`,
    `where version is ${currentVersion} bumped per your decision.`,
  ].join("\n");

  async function run(): Promise<{ bump: Bump; version: string } | null> {
    const out =
      await $`claude -p ${prompt} --output-format json`.quiet().text();
    let resultText: string;
    try {
      const wrapper = JSON.parse(out);
      resultText = typeof wrapper.result === "string" ? wrapper.result : out;
    } catch {
      resultText = out;
    }
    const jsonMatch = resultText.match(/\{[^{}]*"bump"[^{}]*\}/);
    if (!jsonMatch) return null;
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const bump = parsed.bump as Bump;
      if (!["major", "minor", "patch"].includes(bump)) return null;
      let version =
        typeof parsed.version === "string" && /^\d+\.\d+\.\d+$/.test(parsed.version)
          ? parsed.version
          : bumpVersion(currentVersion, bump);
      return { bump, version };
    } catch {
      return null;
    }
  }

  let decision = await run();
  if (!decision) {
    log("⚠ Claude returned unparseable output, retrying once...");
    decision = await run();
  }
  if (!decision) die("could not get a valid version decision from Claude");
  if (!isGreater(decision.version, currentVersion)) {
    decision.version = bumpVersion(currentVersion, decision.bump);
  }
  return decision;
}

function bumpVersionFiles(newVersion: string) {
  // package.json
  const pkgPath = resolve(ROOT, "package.json");
  const pkg = readFileSync(pkgPath, "utf8");
  const pkgNew = pkg.replace(
    /("version"\s*:\s*)"[^"]+"/,
    `$1"${newVersion}"`,
  );
  writeFileSync(pkgPath, pkgNew);

  // src-tauri/tauri.conf.json
  const confPath = resolve(ROOT, "src-tauri/tauri.conf.json");
  const conf = readFileSync(confPath, "utf8");
  const confNew = conf.replace(
    /("version"\s*:\s*)"[^"]+"/,
    `$1"${newVersion}"`,
  );
  writeFileSync(confPath, confNew);

  // src-tauri/Cargo.toml — only the [package] version (first one)
  const cargoPath = resolve(ROOT, "src-tauri/Cargo.toml");
  const cargo = readFileSync(cargoPath, "utf8");
  const cargoNew = cargo.replace(
    /^(version\s*=\s*)"[^"]+"/m,
    `$1"${newVersion}"`,
  );
  writeFileSync(cargoPath, cargoNew);

  // src-tauri/Cargo.lock — the lazysheet package entry, so the lock stays in
  // sync with Cargo.toml and the working tree is clean after the release.
  const lockPath = resolve(ROOT, "src-tauri/Cargo.lock");
  if (existsSync(lockPath)) {
    const lock = readFileSync(lockPath, "utf8");
    const lockNew = lock.replace(
      /(name = "lazysheet"\nversion = )"[^"]+"/,
      `$1"${newVersion}"`,
    );
    writeFileSync(lockPath, lockNew);
  }
}

async function main() {
  loadEnv(resolve(ROOT, ".env"));

  // 1. clean working tree
  const status = (await $`git status --porcelain`.cwd(ROOT).quiet().text()).trim();
  if (status && !DRY_RUN) {
    die("working tree not clean — commit or stash changes before deploying");
  }

  // 2. resolve commit range
  let latestTag: string | null = null;
  try {
    latestTag = (
      await $`git describe --tags --abbrev=0`.cwd(ROOT).quiet().text()
    ).trim();
  } catch {
    latestTag = null;
  }

  // 3. collect commits
  const range = latestTag ? `${latestTag}..HEAD` : "HEAD";
  const logOut = (
    await $`git log ${range} --pretty=format:%s%x1f%h`.cwd(ROOT).quiet().text()
  ).trim();
  if (!logOut) {
    die(
      latestTag
        ? `no new commits since ${latestTag}`
        : "no commits found",
    );
  }
  const commits = logOut.split("\n").map((line) => {
    const [subject, hash] = line.split("\x1f");
    return { subject, hash };
  });

  // 4. current version
  const currentVersion = JSON.parse(
    readFileSync(resolve(ROOT, "package.json"), "utf8"),
  ).version as string;

  log(`\nCurrent version: ${currentVersion}`);
  log(`Commits in range (${latestTag ?? "initial"}..HEAD): ${commits.length}`);

  // 5. changelog + version decision
  const changelog = buildChangelog(commits);
  log(`\nAsking Claude to decide version bump...`);
  const { bump, version } = await decideBump(currentVersion, commits);
  const tag = `v${version}`;

  log(`\n${"=".repeat(50)}`);
  log(`Bump: ${bump}   ${currentVersion} -> ${version}   (tag ${tag})`);
  log(`${"=".repeat(50)}`);
  log(`\n${changelog}\n`);

  if (DRY_RUN) {
    log("--dry-run: no files changed, no tag created, no push.");
    return;
  }

  // 6. confirm
  if (!SKIP_CONFIRM) {
    const answer = prompt(`Create and push ${tag}? (y/N)`)?.trim().toLowerCase();
    if (answer !== "y" && answer !== "yes") die("aborted by user");
  }

  // 7. bump version files
  bumpVersionFiles(version);

  // 8. commit
  await $`git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock`
    .cwd(ROOT);
  await $`git commit -m ${`chore: release ${tag}`}`.cwd(ROOT);

  // 9. annotated tag with changelog as message
  await $`git tag -a ${tag} -m ${changelog}`.cwd(ROOT);

  // 10. push commit + tag
  await $`git push origin HEAD`.cwd(ROOT);
  await $`git push origin ${tag}`.cwd(ROOT);

  log(`\n✔ Pushed ${tag}. Release workflow will build and publish artifacts.`);
}

main().catch((err) => die(err?.message ?? String(err)));
