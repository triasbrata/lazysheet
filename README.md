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

LazySheet has no published binaries yet. Build it from source for your platform.

#### macOS

```bash
git clone https://github.com/triasbrata/lazysheet.git
cd lazysheet
deno install
deno task tauri build
```

The signed `.app` / `.dmg` lands in `src-tauri/target/release/bundle/`.

#### Windows

```bash
git clone https://github.com/triasbrata/lazysheet.git
cd lazysheet
deno install
deno task tauri build
```

The installer (`.msi` / `.exe`) lands in `src-tauri/target/release/bundle/`.

#### Linux & other platforms

```bash
git clone https://github.com/triasbrata/lazysheet.git
cd lazysheet
deno install
deno task tauri build
```

The `.deb` / `.AppImage` lands in `src-tauri/target/release/bundle/`.

> Requires [Deno](https://deno.com) and the [Rust toolchain](https://rustup.rs) with [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS.

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
deno install
deno task tauri dev
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
