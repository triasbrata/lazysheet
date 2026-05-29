<div align="center">

<img src="src-tauri/icons/128x128@2x.png" alt="LazySheet" width="96" height="96" />

# LazySheet

A fast, native desktop viewer for Excel and CSV files — with pivot-style group-by summaries built in.

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
