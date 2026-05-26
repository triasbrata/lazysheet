import { useState } from "react";
import { FileSpreadsheet, FolderOpen, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pickFile } from "@/lib/tauri-api";
import type { RecentFile } from "@/hooks/useWorkbook";

interface WelcomeProps {
  onOpen: (path: string) => void;
  recents: RecentFile[];
  dragOver: boolean;
}

export function Welcome({ onOpen, recents, dragOver }: WelcomeProps) {
  const [picking, setPicking] = useState(false);

  async function handlePick() {
    setPicking(true);
    try {
      const p = await pickFile();
      if (p) onOpen(p);
    } finally {
      setPicking(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 select-none">
      <div
        className={`flex w-full max-w-lg flex-col items-center rounded-2xl border-2 border-dashed p-12 transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border bg-card/30"
        }`}
      >
        <FileSpreadsheet
          className={`mb-4 h-14 w-14 transition-colors ${
            dragOver ? "text-primary" : "text-muted-foreground/60"
          }`}
          strokeWidth={1.25}
        />
        <h2 className="mb-1 text-lg font-medium">Open a spreadsheet</h2>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Drop a file here, or browse to open
          <br />
          <span className="text-xs">.xlsx · .xlsm · .xls · .csv · .tsv</span>
        </p>
        <Button onClick={handlePick} disabled={picking} size="sm">
          <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
          {picking ? "Opening…" : "Open File"}
        </Button>
      </div>

      {recents.length > 0 && (
        <div className="mt-8 w-full max-w-lg">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3 w-3" />
            Recent
          </div>
          <ul className="space-y-0.5">
            {recents.slice(0, 5).map((r) => (
              <li key={r.path}>
                <button
                  onClick={() => onOpen(r.path)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{r.fileName}</span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">
                    {r.path}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
