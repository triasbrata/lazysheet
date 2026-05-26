# LazySheet

Native desktop app for viewing Excel and CSV files. Built with Tauri v2 + React + TypeScript.

## Features

- Open `.xlsx`, `.xlsm`, `.xls`, `.csv`, `.tsv`
- Multi-sheet navigation (tabs at bottom)
- Sticky header + row numbers
- Cell formatting preserved: background colors, font colors, bold, italic, text wrap, alignment
- Merged cells, frozen panes, hyperlinks (clickable, open externally)
- Drag & drop files onto the window
- macOS "Open With" — registers as default viewer
- Recent files
- Light / dark / system theme
- Virtualized rendering for large sheets
- Range selection stats (sum/avg/min/max/count in status bar)
- Group-by summary panel (pivot-style aggregates by category × value field)

## Stack

- **Shell:** Tauri v2
- **Backend:** Rust (`umya-spreadsheet` for `.xlsx`/`.xlsm`, `calamine` for `.xls`, `csv` crate for `.csv`/`.tsv`)
- **Frontend:** React 19 + TypeScript + Vite
- **UI:** Tailwind CSS v4 + shadcn/ui
- **Grid:** TanStack Virtual

## Develop

```bash
pnpm install
pnpm tauri dev
```

## Build

```bash
pnpm tauri build
```

Output: `src-tauri/target/release/bundle/`

## Project Layout

```
src/                React frontend
src-tauri/          Rust backend + Tauri config
  src/parser/       Per-format parsers (xlsx, xls, csv)
  src/model.rs      Serde-shared data model
  src/commands.rs   Tauri IPC handlers
  src/lib.rs        App entry, plugins, RunEvent
```
