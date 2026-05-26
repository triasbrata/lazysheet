import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";

export type GridContextMenuTarget =
  | { type: "row"; row: number }
  | { type: "cell"; row: number; col: number }
  | { type: "col"; col: number }
  | null;

interface GridContextMenuContentProps {
  ctx: GridContextMenuTarget;
  headerRow: number | null;
  canCopy: boolean;
  canSummarize?: boolean;
  onMarkHeader: (row: number | null) => void;
  onCopyMarkdown: () => void;
  onCopyMarkdownTitle: () => void;
  onCopyMarkdownTable: () => void;
  onCopyAscii: () => void;
  onSummarize?: () => void;
  // Resize-related
  hasColOverride?: boolean;
  hasRowOverride?: boolean;
  hasAnyOverride?: boolean;
  onResetColWidth?: () => void;
  onResetRowHeight?: () => void;
  onResetAllDimensions?: () => void;
}

export function GridContextMenuContent({
  ctx,
  headerRow,
  canCopy,
  canSummarize,
  onMarkHeader,
  onCopyMarkdown,
  onCopyMarkdownTitle,
  onCopyMarkdownTable,
  onCopyAscii,
  onSummarize,
  hasColOverride,
  hasRowOverride,
  hasAnyOverride,
  onResetColWidth,
  onResetRowHeight,
  onResetAllDimensions,
}: GridContextMenuContentProps) {
  if (!ctx) return null;

  if (ctx.type === "col") {
    return (
      <ContextMenuContent>
        <ContextMenuItem
          disabled={!hasColOverride || !onResetColWidth}
          onSelect={() => onResetColWidth?.()}
        >
          Reset width
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          disabled={!hasAnyOverride || !onResetAllDimensions}
          onSelect={() => onResetAllDimensions?.()}
        >
          Reset all resized dimensions
        </ContextMenuItem>
      </ContextMenuContent>
    );
  }

  const isRow = ctx.type === "row";
  const isHeader = isRow && headerRow === ctx.row;

  return (
    <ContextMenuContent>
      {isRow && (
        <ContextMenuItem
          onSelect={() => onMarkHeader(isHeader ? null : ctx.row)}
        >
          {isHeader ? "Unmark as header" : "Mark as header"}
        </ContextMenuItem>
      )}
      {isRow && canCopy && <ContextMenuSeparator />}
      {ctx.type === "cell" && canSummarize && onSummarize && (
        <>
          <ContextMenuItem onSelect={() => onSummarize()}>
            Summarize range…
          </ContextMenuItem>
          {canCopy && <ContextMenuSeparator />}
        </>
      )}
      {canCopy && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>Copy as markdown</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onSelect={() => onCopyMarkdown()}>
              Inline
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onCopyMarkdownTitle()}>
              Title
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onCopyMarkdownTable()}>
              Table
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onCopyAscii()}>
              ASCII
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}
      {isRow && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            disabled={!hasRowOverride || !onResetRowHeight}
            onSelect={() => onResetRowHeight?.()}
          >
            Reset height
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!hasAnyOverride || !onResetAllDimensions}
            onSelect={() => onResetAllDimensions?.()}
          >
            Reset all resized dimensions
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  );
}
