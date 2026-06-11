# LazySheet — agent notes

Tauri spreadsheet viewer. React 19 + TypeScript frontend (Vite, Tailwind v4,
shadcn/radix), Rust backend in `src-tauri/`. Package manager is **bun**.

## Commands

```bash
bun run dev              # Vite dev server (web only)
bun run run:dev          # tauri dev (full app)
bun run build:web        # tsc + vite build (use this to type-check)
bun run test             # vitest run + coverage gate
bun run test:watch       # vitest watch mode
bun run test:e2e         # e2e suite (builds app first via scripts/e2e.ts)
bun run app:deploy       # cut a release (see Release flow below)
```

Run `bun run build:web` and `bun run test` before declaring a change done.

## Project structure

- `src/components/ui/` — shadcn-style primitives (button, dialog, switch, …).
- `src/components/` — feature components (SettingsModal, CommandPalette, …).
- `src/components/Grid/` — spreadsheet grid (tanstack table + virtual).
- `src/hooks/` — shared hooks; `src/lib/` — utilities.
- `src/locales/` + `src/i18n/` — i18next. All user-facing strings go through
  `t()`; add keys to every locale file.
- `src-tauri/` — Rust commands, file parsing (xlsx). Frontend talks to it via
  `@tauri-apps/api` invoke.
- `e2e/` — WebDriver e2e tests; `scripts/` — deploy/tooling.

## React conventions

**Component-based approach is mandatory. Maximize reuse.**

- Before writing any UI, check `src/components/ui/` for an existing primitive
  and `src/components/` for an existing feature component. Reuse or extend it;
  do not duplicate. New primitives follow the shadcn pattern (cva variants,
  `cn()` from `src/lib`).
- Build screens by composing small, single-purpose components. If a component
  grows past ~200 lines or holds more than one concern, split it.
- If the same markup/logic appears twice, extract it into a shared component
  (or hook, for logic) instead of copy-pasting.
- `App.tsx` is already too large — do **not** add new UI inline there; create
  a component file and compose it in.
- Props over internal state where the parent already owns the data; keep
  components presentational when possible and lift state to hooks.
- One component per file, named export matching the filename.

## Testing

- Vitest + Testing Library. Every component has a colocated `*.test.tsx` —
  keep that invariant when adding components.
- Coverage is gated (`scripts/coverage-total.ts`); don't drop it.
- Test behavior through the rendered UI, not implementation details.

## Workflow rules

- TypeScript strict; no `any` unless unavoidable and commented.
- User-facing change → drop a bullet in `RELEASE_NOTES_NEXT.md` (see below).
- Never commit directly to `main`; branch + PR.
- Don't edit `changelog-app.log` by hand — deploy.ts/CI own it.

## Release & changelog flow

Releases are RC-first: `bun run app:deploy` (`scripts/deploy.ts`) cuts an RC
tag, CI builds artifacts, and on success promotes it to the final tag and
publishes the GitHub release. The single source of truth for a release's notes
is the **annotated tag message** — not any file in the tree.

Key pieces, and how they fit together:

- **`RELEASE_NOTES_NEXT.md`** — holding area for hand-written, user-facing
  bullets as you land changes. Put a `## Section` + `- bullet` under it; the
  `# ` title, prose preamble, and `<!-- ... -->` engineering comments are
  ignored. On the next `app:deploy` these bullets are folded into the generated
  release notes, then the file is **reset to an empty template** so they don't
  leak into the next release. Don't paste them into the tag by hand anymore —
  deploy.ts does it.

- **`scripts/deploy.ts`** (`app:deploy`) — fresh cycle: asks Claude for the
  semver bump, generates release notes (Claude opus, with `RELEASE_NOTES_NEXT.md`
  bullets injected as must-include), bumps version files, **prepends the entry
  to `changelog-app.log`**, resets `RELEASE_NOTES_NEXT.md`, commits
  `chore: release vX.Y.Z`, then creates + pushes `vX.Y.Z-rc.N`. Mid-cycle
  (RC re-run after CI failure): new RC tag only, no commit, no re-bump.
  Version files always hold the bare base version; the `-rc.N` suffix lives
  only in the git tag.

- **`changelog-app.log`** — committed changelog history, newest on top. Format
  per entry: `## vX.Y.Z (YYYY-MM-DD)` + tag-annotation body + `---`. It is
  **gitignored** (`*.log`), so it must be `git add -f`'d. deploy.ts prepends to
  it locally and bakes it into the release commit; CI's `update-changelog` job
  then finds the entry already present (guard: `grep "^## <tag> "`) and skips
  its own write — so there's never a duplicate entry.

- **`.github/workflows/release.yml`** — triggers on `v*` tags. Builds all
  platforms, promotes RC→final, mirrors the tag + release to the public
  `triasbrata/lazysheet` repo, generates `latest.json` for the Tauri updater,
  and (if deploy.ts didn't already) appends to `changelog-app.log`.

When adding a user-facing change: drop a bullet in `RELEASE_NOTES_NEXT.md`. When
cutting a release: just run `app:deploy` — everything else is automatic.

The idempotency guard (`^## v<version> `) on the changelog keeps deploy and CI
from double-writing; preserve it if you touch either side.
