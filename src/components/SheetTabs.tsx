import type { SheetSummary } from "@/lib/types";

interface SheetTabsProps {
  sheets: SheetSummary[];
  activeName: string;
  onSwitch: (name: string) => void;
}

export function SheetTabs({ sheets, activeName, onSwitch }: SheetTabsProps) {
  if (sheets.length <= 1) return null;
  return (
    <div
      data-tauri-drag-region
      className="flex h-9 shrink-0 items-center gap-0 overflow-x-auto border-t border-border bg-card/50 px-1.5"
    >
      {sheets.map((s) => {
        const active = s.name === activeName;
        return (
          <button
            key={s.index}
            onClick={() => onSwitch(s.name)}
            className={`relative shrink-0 cursor-pointer px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.name}
            {active && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}
