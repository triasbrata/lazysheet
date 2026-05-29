import type { CopyFormat } from "@/lib/markdown-export";

// App-global preference: which markdown format Cmd/Ctrl+C uses, and which
// copy sub-item shows the default star. Persisted across restarts in
// localStorage. Mirrors the pattern in SummaryPanel (copy-format dropdown).
export const DEFAULT_COPY_FORMAT_KEY = "lazysheet:default-copy-format";
export const DEFAULT_COPY_FORMAT: CopyFormat = "inline";

export function isCopyFormat(v: unknown): v is CopyFormat {
  return (
    v === "inline" || v === "title" || v === "table" || v === "ascii" ||
    v === "csv" || v === "tsv" || v === "plain"
  );
}
/** @deprecated use isCopyFormat */
export const isMarkdownFormat = isCopyFormat;

export function readStoredDefaultCopyFormat(): CopyFormat {
  try {
    const v = localStorage.getItem(DEFAULT_COPY_FORMAT_KEY);
    if (isCopyFormat(v)) return v;
  } catch {
    // Storage disabled or quota — fall back to default.
  }
  return DEFAULT_COPY_FORMAT;
}
