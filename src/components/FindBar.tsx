import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export interface FindBarProps {
  open: boolean;
  query: string;
  matchCount: number;
  activeIndex: number;
  focusNonce?: number;
  onQueryChange: (q: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export function FindBar({
  open,
  query,
  matchCount,
  activeIndex,
  focusNonce,
  onQueryChange,
  onNext,
  onPrev,
  onClose,
}: FindBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, focusNonce]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) onPrev();
      else onNext();
    }
  };

  const counterText =
    matchCount > 0
      ? activeIndex >= 0
        ? t("find.position", { current: activeIndex + 1, total: matchCount })
        : t("find.matches", { count: matchCount })
      : query
        ? t("find.noMatches")
        : "";

  const disabled = matchCount === 0;

  return (
    <div
      className={cn(
        "absolute top-12 right-4 z-40",
        "flex items-center gap-1.5 rounded-md border border-border bg-popover px-2 py-1.5 shadow-md",
      )}
      role="search"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Search className="h-3.5 w-3.5 text-muted-foreground" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t("find.placeholder")}
        className="w-56 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        aria-label={t("find.ariaFind")}
      />
      <span
        data-testid="find-match-count"
        className={cn(
          "min-w-[4.5rem] text-right text-[11px] tabular-nums",
          counterText === t("find.noMatches")
            ? "text-destructive"
            : "text-muted-foreground",
        )}
      >
        {counterText}
      </span>
      <button
        type="button"
        onClick={onPrev}
        disabled={disabled}
        aria-label={t("find.ariaPrev")}
        className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        aria-label={t("find.ariaNext")}
        className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("find.ariaClose")}
        className="rounded p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
