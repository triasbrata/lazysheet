#!/usr/bin/env bun
/**
 * Local deploy script — RC-first flow.
 *
 * Flow: load .env -> build changelog from commits since last stable tag ->
 * ask Claude Code to decide the semantic version bump (fresh cycle only) ->
 * bump version files + commit "chore: release vX.Y.Z" (fresh cycle only) ->
 * create annotated RC tag vX.Y.Z-rc.N (message = changelog) -> push.
 *
 * CI (release.yml) receives the RC tag, builds all platform artifacts,
 * and on success creates the final tag vX.Y.Z at the same commit using
 * GITHUB_TOKEN (which intentionally does not re-trigger the workflow),
 * then publishes the GitHub release under the final tag name.
 *
 * On CI failure: fix the code, re-run `bun run app:deploy`. deploy.ts
 * detects the in-progress RC cycle and creates vX.Y.Z-rc.(N+1) without
 * re-bumping version files or creating another release commit.
 *
 * Version files always hold the bare base version (e.g. 0.5.0) — the
 * rc suffix lives only in the git tag, never in package.json or Cargo.toml.
 *
 * Usage:
 *   bun run app:deploy            # interactive, asks for confirmation
 *   bun run app:deploy --yes      # skip confirmation
 *   bun run app:deploy --dry-run  # print the plan, no git writes / push
 *   bun run app:deploy --skip-e2e # bypass the e2e gate (emergency escape hatch)
 */

import { $ } from "bun";
import dotenv from "dotenv";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname!, "..");
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const SKIP_CONFIRM = args.has("--yes") || args.has("-y");
const SKIP_E2E = args.has("--skip-e2e");

function die(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
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

/** Merge commits and the prior release-bump commit are noise in a summary. */
function isNoiseCommit(subject: string): boolean {
  if (/^Merge /i.test(subject)) return true;
  if (/^chore(\([^)]*\))?:\s*release\b/i.test(subject)) return true;
  return false;
}

/** Group conventional-commit subjects into a markdown changelog. */
function buildChangelog(
  commits: { subject: string; hash: string }[],
  opts: { withHash?: boolean } = {},
): string {
  const withHash = opts.withHash ?? true;
  const groups = new Map<string, string[]>();
  for (const { subject, hash } of commits) {
    if (isNoiseCommit(subject)) continue;
    const m = subject.match(/^(\w+)(?:\([^)]*\))?!?:\s*(.+)$/);
    const type = m ? m[1].toLowerCase() : "other";
    const text = m ? m[2] : subject;
    const heading = TYPE_HEADINGS[type] ?? "### Other";
    if (!groups.has(heading)) groups.set(heading, []);
    groups.get(heading)!.push(withHash ? `- ${text} (${hash})` : `- ${text}`);
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
  if (!sections.length) return "### Chores\n- maintenance release";
  return sections.join("\n\n");
}

/**
 * Run claude headless with the release config: Opus model, max effort,
 * and thinking mode enabled (MAX_THINKING_TOKENS for headless runs).
 * Returns the result text from the JSON wrapper, or raw stdout on parse failure.
 */
async function runClaude(prompt: string): Promise<string> {
  const out = await $`claude -p ${prompt} --model opus --effort max --output-format json`
    .env({ ...process.env, MAX_THINKING_TOKENS: "32000" })
    .quiet()
    .text();
  try {
    const wrapper = JSON.parse(out);
    return typeof wrapper.result === "string" ? wrapper.result : out;
  } catch {
    return out;
  }
}

/** Ask Claude Code to decide the semver bump from the commit list. */
async function decideBump(
  currentVersion: string,
  commits: { subject: string }[],
): Promise<{ bump: Bump; version: string }> {
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN && !process.env.ANTHROPIC_API_KEY) {
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
    const resultText = await runClaude(prompt);
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

/**
 * Ask Claude Code (opus, max effort, thinking) to write the release notes
 * used as the annotated tag message — CI publishes it as the GitHub release
 * body. Falls back to the mechanical changelog if Claude's output is unusable.
 */
async function generateReleaseNotes(
  version: string,
  commits: { subject: string; hash: string }[],
): Promise<string> {
  const subjects = commits
    .filter((c) => !isNoiseCommit(c.subject))
    .map((c) => `- ${c.subject}`)
    .join("\n");
  const prompt = [
    `Write GitHub release notes for lazysheet v${version} (a Tauri spreadsheet app).`,
    ``,
    `Commits since the last release:`,
    subjects,
    ``,
    `Rules:`,
    `- Markdown only, no code fence around the whole output, no preamble or closing remarks.`,
    `- Group changes under "### Features", "### Fixes", and other conventional headings as relevant.`,
    `- Rewrite commit subjects into clear, user-facing sentences; merge related commits into one bullet.`,
    `- Do not include commit hashes, PR numbers, or a version heading.`,
    `- Skip internal-only noise (CI tweaks, release chores) unless user-relevant.`,
    `- Judge by user impact, not commit type prefix: toolchain/test/coverage work is internal even when labeled "feat:", and a commit without a type prefix can still be a headline feature.`,
    `- A feature shipped behind a feature flag that is OFF by default is NOT yet user-facing — do not list it under "### Features". If worth a mention, note it briefly under an experimental/upcoming line; otherwise omit it.`,
  ].join("\n");

  try {
    const notes = (await runClaude(prompt)).trim();
    // Sanity check: must be non-empty markdown with at least one bullet/heading.
    if (notes && /(^|\n)(###|-)\s/.test(notes)) return notes;
    log("⚠ Claude release notes looked malformed — falling back to mechanical changelog.");
  } catch {
    log("⚠ Claude release notes generation failed — falling back to mechanical changelog.");
  }
  return buildChangelog(commits, { withHash: false });
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

/**
 * Extract the rc counter N from a tag name like "v0.5.0-rc.3".
 * Returns null if the tag is not an rc tag.
 */
function parseRcNumber(tagName: string): number | null {
  const m = tagName.match(/^v\d+\.\d+\.\d+-rc\.(\d+)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Given a base version (e.g. "0.5.0") and a list of existing tag names,
 * return the next rc tag string: "v0.5.0-rc.{maxN+1}", or "v0.5.0-rc.1"
 * if no rc tags exist for that base version.
 */
function nextRcTag(baseVersion: string, existingTags: string[]): string {
  const prefix = `v${baseVersion}-rc.`;
  let maxN = 0;
  for (const tag of existingTags) {
    if (!tag.startsWith(prefix)) continue;
    const n = parseRcNumber(tag);
    if (n !== null && n > maxN) maxN = n;
  }
  return `${prefix}${maxN + 1}`;
}

/**
 * Return the most recent stable (non-rc) tag reachable from HEAD, or null
 * if no stable tag exists. Uses --exclude to skip all rc tags.
 */
async function resolveLastStableTag(): Promise<string | null> {
  try {
    const tag = (
      await $`git describe --tags --abbrev=0 --exclude ${"*-rc.*"}`.cwd(ROOT).quiet().text()
    ).trim();
    return tag || null;
  } catch {
    return null;
  }
}

async function main() {
  loadEnv(resolve(ROOT, ".env"));

  // 1. clean working tree
  const status = (await $`git status --porcelain`.cwd(ROOT).quiet().text()).trim();
  if (status && !DRY_RUN) {
    die("working tree not clean — commit or stash changes before deploying");
  }

  // 2. resolve commit range — use last stable (non-rc) tag as baseline
  const lastStableTag = await resolveLastStableTag();

  // 3. collect commits
  const range = lastStableTag ? `${lastStableTag}..HEAD` : "HEAD";
  const logOut = (
    await $`git log ${range} --pretty=format:%s%x1f%h`.cwd(ROOT).quiet().text()
  ).trim();
  if (!logOut) {
    die(
      lastStableTag
        ? `no new commits since ${lastStableTag}`
        : "no commits found",
    );
  }
  const commits = logOut.split("\n").map((line) => {
    const [subject, hash] = line.split("\x1f");
    return { subject, hash };
  });

  // 4. current version from package.json (always the bare base version)
  const currentVersion = JSON.parse(
    readFileSync(resolve(ROOT, "package.json"), "utf8"),
  ).version as string;

  // Derive the stable version string from the last stable tag (strip leading "v")
  const lastStableVersion = lastStableTag ? lastStableTag.replace(/^v/, "") : null;

  log(`\nCurrent version: ${currentVersion}`);
  log(`Commits in range (${lastStableTag ?? "initial"}..HEAD): ${commits.length}`);

  // 5. Determine baseVersion and whether this is a fresh or mid-cycle run.
  //    Mid-cycle: last stable tag exists AND package.json version has already
  //    been bumped ahead of it (i.e. an RC cycle is in progress).
  let baseVersion: string;
  let freshCycle: boolean;

  if (lastStableVersion !== null && currentVersion !== lastStableVersion) {
    // RC cycle already in progress — package.json was bumped in the prior run.
    baseVersion = currentVersion;
    freshCycle = false;
    log(`\nRC cycle in progress for v${baseVersion} — skipping version bump.`);
  } else {
    // Fresh cycle: ask Claude to decide the bump.
    log(`\nAsking Claude to decide version bump...`);
    const { bump, version } = await decideBump(currentVersion, commits);
    baseVersion = version;
    freshCycle = true;

    log(`\n${"=".repeat(50)}`);
    log(`Bump: ${bump}   ${currentVersion} -> ${baseVersion}`);
    log(`${"=".repeat(50)}`);
  }

  // 6. Compute rc tag for this run.
  const existingRcTagsOut = (
    await $`git tag -l ${`v${baseVersion}-rc.*`}`.cwd(ROOT).quiet().text()
  ).trim();
  const existingRcTags = existingRcTagsOut
    ? existingRcTagsOut.split("\n").filter((t) => t.trim() !== "")
    : [];
  const rcTag = nextRcTag(baseVersion, existingRcTags);

  log(`Planned RC tag:   ${rcTag}`);
  log(`Target final tag: v${baseVersion}`);

  // 7. Release notes (Claude, opus/max-effort/thinking) — generated BEFORE the
  //    confirmation prompt so what you approve is exactly what ships as the
  //    tag message / GitHub release body. Falls back to the mechanical
  //    changelog on failure.
  log(`\nGenerating release notes with Claude...`);
  const tagMessage = await generateReleaseNotes(baseVersion, commits);
  log(`\n${tagMessage}\n`);

  if (DRY_RUN) {
    log(`\n--dry-run: would${freshCycle ? " bump version files, commit chore: release v" + baseVersion + "," : ""} create tag ${rcTag}, push HEAD + ${rcTag}.`);
    log("--dry-run: no files changed, no tag created, no push.");
    return;
  }

  // 8. confirm
  if (!SKIP_CONFIRM) {
    const answer = prompt(
      `Create and push ${rcTag}? CI will promote to v${baseVersion} on success. (y/N)`,
    )?.trim().toLowerCase();
    if (answer !== "y" && answer !== "yes") die("aborted by user");
  }

  // 9. e2e gate
  if (!SKIP_E2E && !DRY_RUN) {
    log("Running e2e gate (native tauri-webdriver)…");
    try {
      await $`bun run scripts/e2e.ts`.cwd(ROOT);
    } catch {
      die("E2E gate failed — release aborted (no git writes made). Fix tests, or re-run with --skip-e2e to override.");
    }
  }

  // 10. Fresh cycle only: bump version files + commit.
  //     The commit message uses the final version (no rc suffix) because
  //     version files always hold the bare base version.
  if (freshCycle) {
    bumpVersionFiles(baseVersion);
    await $`git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock`
      .cwd(ROOT);
    await $`git commit -m ${`chore: release v${baseVersion}`}`.cwd(ROOT);
  }

  // 11. annotated RC tag — message is the Claude release notes from step 7.
  // --cleanup=whitespace: default cleanup strips lines starting with "#",
  // which deletes the "### Features" markdown headings from the tag message.
  await $`git tag -a ${rcTag} --cleanup=whitespace -m ${tagMessage}`.cwd(ROOT);

  // 12. push commit (harmless no-op if HEAD is already up to date) + rc tag
  await $`git push origin HEAD`.cwd(ROOT);
  await $`git push origin ${rcTag}`.cwd(ROOT);

  log(`\n✔ Pushed ${rcTag}. CI will build, and on success promote to v${baseVersion} and publish the release.`);
}

main().catch((err) => die(err?.message ?? String(err)));
