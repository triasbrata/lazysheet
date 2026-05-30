---
phase: implement
date: 2026-05-30
plan: ./rpi-plan.md
---

# Implementation Progress

| Step | Status | Notes |
|------|--------|-------|
| 1: OS detection lib | ✅ Done | os.ts + 14 tests |
| 2: Release parse/classify lib | ✅ Done | releases.ts + 37 tests |
| 3: Server fn (fetch+cache+UA) | ✅ Done | releases.server.ts. 51 tests pass total |
| 4: Client hook + hero button | ✅ Done | use-os-arch.ts + download-button.tsx, no new tsc errors |
| 5: Wire index.tsx hero | ✅ Done | loader + DownloadButton; removed RELEASES_URL + unused AppleMark import |
| 6: Wire download.tsx table | ✅ Done | loader + dynamic cards from groupByOS; fallback card; detected-OS highlight |
| 7: Final verification | ✅ Done | see Final Verification below |

## Deviations
- **D1 (Step 2):** `parseRelease` guard tightened with `typeof rel !== 'object'` so primitive garbage → null (matches intent). Approved.
- **D2 (Step 3):** Added `vitest.config.ts` (NOT in change map) — `@cloudflare/vite-plugin` crashes the vitest runner at startup; standalone config (node env + `#` alias) required for tests to run. Justified infra. Approved.
- Pre-existing tsc error in `src/components/site/icons.tsx` (FontAwesome `CSSVariables`) — present before changes, untouched.
- **D3 (Steps 5/6):** Plan put the server fn in `releases.server.ts` AND imported it into routes — contradictory: TanStack's `import-protection` blocks any `*.server.*` import from client-reachable code. **Resolved** by renaming `releases.server.ts` → `releases-data.ts` (no `.server.` segment). `createServerFn` already handles client/server splitting, so the suffix-protection was redundant. Single shared `getDownloadData`, imported directly in both routes — no duplication, no double-wrapping. Build confirms handler extracted to server bundle, zero server-code leak in client bundle.
- **D4 (Step 7):** Added `src/features/download/download-button.test.tsx` (jsdom render test) beyond plan's "components not unit-tested" — high-value happy-path verification since no live release exists to eyeball. Justified.

## Final Verification

- **`pnpm test`** → **54 passed** (3 files): 14 os + 37 releases + 3 DownloadButton render.
- **`pnpm build`** → SUCCESS (client + SSR/Cloudflare). `releases-data` chunk in `dist/server/` only.
- **Client bundle leak check** → 0 hits for `lazysheet-landing` (UA), `getRequestHeader`, `caches.default`, `api.github.com`. Server bundle has them. Clean isomorphic split.
- **Live SSR smoke** (`pnpm dev`, curl per-UA):
  - macOS UA → `Download for macOS` + `fa-apple` ✓
  - Windows UA → `Download for Windows` + `fa-windows` ✓
  - Linux UA → `Download for Linux` ✓
  - unknown/curl UA → `Download` (generic) ✓
  - `/download` (0 releases) → fallback card `View Releases` → releases page ✓
  - All hrefs fall back to `releases/latest` page (graceful, repo has 0 releases today) ✓
- **Change Map cross-check** — all 9 planned files done (#5 renamed per D3); +2 justified extras (`vitest.config.ts` D2, render test D4).
- **Behavior today:** graceful fallback everywhere (no releases). **Auto-activates** to real per-asset URLs within ≤1h edge-cache lag once the first release is published — no code change/redeploy needed.
