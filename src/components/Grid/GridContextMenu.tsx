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
  // Autofit + manual-input. Labels surface multi-target count when caller
  // signals a range selection (e.g. "Autofit 5 columns").
  multiColCount?: number;
  multiRowCount?: number;
  onAutofitCol?: () => void;
  onAutofitRow?: () => void;
  onOpenColWidthDialog?: () => void;
  onOpenRowHeightDialog?: () => void;
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
  multiColCount,
  multiRowCount,
  onAutofitCol,
  onAutofitRow,
  onOpenColWidthDialog,
  onOpenRowHeightDialog,
}: GridContextMenuContentProps) {
  if (!ctx) return null;

  if (ctx.type === "col") {
    const colLabel =
      multiColCount && multiColCount > 1
        ? `Autofit ${multiColCount} columns`
        : "Autofit column width";
    return (
      <ContextMenuContent>
        {onAutofitCol && (
          <ContextMenuItem onSelect={() => onAutofitCol()}>
            {colLabel}
          </ContextMenuItem>
        )}
        {onOpenColWidthDialog && (
          <ContextMenuItem onSelect={() => onOpenColWidthDialog()}>
            Column width…
          </ContextMenuItem>
        )}
        {(onAutofitCol || onOpenColWidthDialog) && <ContextMenuSeparator />}
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
  const rowLabel =
    multiRowCount && multiRowCount > 1
      ? `Autofit ${multiRowCount} rows`
      : "Autofit row height";

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

      {/* Cell-context resize submenu — operates on the clicked cell's col/row. */}
      {ctx.type === "cell" &&
        (onAutofitCol ||
          onAutofitRow ||
          onOpenColWidthDialog ||
          onOpenRowHeightDialog) && (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>Resize</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {onAutofitCol && (
                  <ContextMenuItem onSelect={() => onAutofitCol()}>
                    Autofit column width
                  </ContextMenuItem>
                )}
                {onAutofitRow && (
                  <ContextMenuItem onSelect={() => onAutofitRow()}>
                    Autofit row height
                  </ContextMenuItem>
                )}
                {(onAutofitCol || onAutofitRow) &&
                  (onOpenColWidthDialog || onOpenRowHeightDialog) && (
                    <ContextMenuSeparator />
                  )}
                {onOpenColWidthDialog && (
                  <ContextMenuItem onSelect={() => onOpenColWidthDialog()}>
                    Column width…
                  </ContextMenuItem>
                )}
                {onOpenRowHeightDialog && (
                  <ContextMenuItem onSelect={() => onOpenRowHeightDialog()}>
                    Row height…
                  </ContextMenuItem>
                )}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}

      {isRow && (
        <>
          <ContextMenuSeparator />
          {onAutofitRow && (
            <ContextMenuItem onSelect={() => onAutofitRow()}>
              {rowLabel}
            </ContextMenuItem>
          )}
          {onOpenRowHeightDialog && (
            <ContextMenuItem onSelect={() => onOpenRowHeightDialog()}>
              Row height…
            </ContextMenuItem>
          )}
          {(onAutofitRow || onOpenRowHeightDialog) && <ContextMenuSeparator />}
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
