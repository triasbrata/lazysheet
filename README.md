<div align="center">

<img src="src-tauri/icons/128x128@2x.png" alt="LazySheet" width="96" height="96" />

# LazySheet

### Fast. Simple. Spreadsheet Viewer.

Connect to Excel and CSV files, browse sheets, and run pivot-style summaries with ease.

<img src="website/example/lazy/application%20summary.png" alt="LazySheet screenshot" width="820" />

</div>

## Features

- **Wide format support** — open `.xlsx`, `.xlsm`, `.xls`, `.csv`, and `.tsv` files.
- **Multi-sheet navigation** — switch between sheets with tabs at the bottom of the window.
- **Formatting preserved** — background colors, font colors, bold, italic, text wrap, and alignment carry over from the source file.
- **Rich cell features** — merged cells, frozen panes, and clickable hyperlinks that open externally.
- **Group-by summary** — pivot-style aggregates (SUM / AVG / MIN / MAX / COUNT) by category × value field, with sub-categories, tree/flat views, and subtotals.
- **Range selection stats** — select a range and read sum, average, min, max, and count from the status bar.
- **Copy as image** — export the summary panel straight to your clipboard as an image.
- **Drag & drop** — drop files onto the window to open them instantly.
- **macOS "Open With"** — registers as a default viewer for spreadsheet files.
- **Recent files** — jump back to recently opened documents.
- **Light / dark / system theme** — follows your OS appearance or set it manually.
- **Virtualized rendering** — large sheets stay smooth via on-demand row/column rendering.

## Install

Prebuilt binaries for each platform are attached to every [GitHub Release](https://github.com/triasbrata/lazysheet/releases). Download the one for your OS, or build from source below.

### macOS — first launch

macOS builds are **unsigned**, so Gatekeeper marks a freshly downloaded app as
`"LazySheet" is damaged and can't be opened`. The app is fine — macOS just
quarantines unsigned downloads. Remove the quarantine flag once:

```bash
xattr -dr com.apple.quarantine "/Applications/LazySheet.app"
```

(Point the path at wherever the `.app` lives if you haven't moved it to
`/Applications`.) Then open it normally.

## Build from source

#### macOS

```bash
git clone https://github.com/triasbrata/lazysheet.git
cd lazysheet
bun install
bun run tauri build
```

The `.app` / `.dmg` lands in `src-tauri/target/release/bundle/`.

#### Windows

```bash
git clone https://github.com/triasbrata/lazysheet.git
cd lazysheet
bun install
bun run tauri build
```

The installer (`.msi` / `.exe`) lands in `src-tauri/target/release/bundle/`.

#### Linux & other platforms

```bash
git clone https://github.com/triasbrata/lazysheet.git
cd lazysheet
bun install
bun run tauri build
```

The `.deb` / `.AppImage` lands in `src-tauri/target/release/bundle/`.

> Requires [Bun 1.x](https://bun.sh) and the [Rust toolchain](https://rustup.rs) with [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS.

## Auto-Update (OTA)

LazySheet ships over-the-air updates via the [Tauri updater](https://v2.tauri.app/plugin/updater/). On launch the app checks the latest GitHub Release for a newer signed build and, if found, offers to download, install, and relaunch. You can also trigger a check manually from the command palette (`Cmd/Ctrl+K` → **Check for Updates**).

Updates are verified with a [minisign](https://jedisct1.github.io/minisign/) signature — separate from OS code-signing. Maintainers need a signing keypair before cutting a release.

### Generate the signing key (one time)

```bash
bun run tauri signer generate -w ~/.tauri/lazysheet.key
```

This prints two things:

- a **private key** (written to `~/.tauri/lazysheet.key`) and the **password** you set — these sign release artifacts.
- a **public key** string — this is embedded in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey` so installed apps can verify updates.

Keep the private key and password safe and **offline-backed-up**. Rotating the key invalidates auto-update for every existing install (they pin the old public key).

### Register CI secrets

Add these as GitHub Actions secrets on the `lazysheet-app` repo so the release workflow can sign artifacts:

| Secret | Value |
|--------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | contents of `~/.tauri/lazysheet.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | the password you set during `signer generate` |

On the next tagged release the workflow builds signed updater bundles plus a `latest.json` manifest and attaches them to the [GitHub Release](https://github.com/triasbrata/lazysheet/releases). The app's updater endpoint points at `releases/latest/download/latest.json`.

### Caveats

- **macOS** builds are unsigned/un-notarized, so auto-update is best-effort — if an in-place update is blocked, download the latest build manually.
- Only **Apple Silicon (arm64)** macOS builds are produced; Intel Macs receive no update entry.
- The **first updater-enabled release must be installed manually once** — earlier installs predate the updater plugin and cannot self-update into it.

## Supported Formats

- [CSV](https://en.wikipedia.org/wiki/Comma-separated_values) — `.csv`
- [TSV](https://en.wikipedia.org/wiki/Tab-separated_values) — `.tsv`
- [Excel (legacy)](https://en.wikipedia.org/wiki/Microsoft_Excel) — `.xls`
- [Excel (OOXML)](https://en.wikipedia.org/wiki/Office_Open_XML) — `.xlsx`, `.xlsm`

## Tech Stack

- **Shell:** [Tauri v2](https://v2.tauri.app)
- **Backend:** Rust — [`umya-spreadsheet`](https://crates.io/crates/umya-spreadsheet) (`.xlsx`/`.xlsm`), [`calamine`](https://crates.io/crates/calamine) (`.xls`), [`csv`](https://crates.io/crates/csv) (`.csv`/`.tsv`)
- **Frontend:** [React 19](https://react.dev) + TypeScript + [Vite](https://vite.dev)
- **UI:** [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- **Grid:** [TanStack Virtual](https://tanstack.com/virtual)

## Develop

```bash
bun install
bun run tauri dev
```

## Project Layout

```
src/                React frontend
src-tauri/          Rust backend + Tauri config
  src/parser/       Per-format parsers (xlsx, xls, csv)
  src/model.rs      Serde-shared data model
  src/commands.rs   Tauri IPC handlers
  src/lib.rs        App entry, plugins, RunEvent
```

## License

Released under the [MIT License](LICENSE).
